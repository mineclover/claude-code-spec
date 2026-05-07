/**
 * Claude fork runner.
 *
 * Implements the cache-preserving fork protocol against the Claude CLI:
 *
 *   1. Use the CLI's built-in `--resume <sourceId> --fork-session` to mint
 *      a new session ID without writing into the source's JSONL.
 *   2. Strip MCP and built-in tools from the fork's prefix so the summary
 *      turn cannot drift into tool calls or shell exploration. This breaks
 *      cache_read (the prefix is no longer bit-for-bit identical to the
 *      source) but is the trade-off the operator asked for: clean,
 *      bounded summarization beats accidental tool invocation.
 *   3. Cap the conversation to a single assistant turn (`--max-turns 1`).
 *   4. Capture the stream, parse the model JSON, and synthesize the
 *      `cacheInvariants` block from observed token counts. If MCP/tools
 *      were disabled, `cacheReadTokens` will typically be 0 — the GUI
 *      shows that and labels the fork accordingly.
 */

import { StreamParser, type StreamEvent } from '@context-action/code-api';
import {
  emptyCacheMetrics,
  type SummaryResult,
} from '@context-action/session-core';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseModelOutput } from './parseModelOutput';
import { buildSummarizePrompt } from './prompts';
import {
  RunnerUnavailableError,
  type CliRunner,
  type ForkContext,
  type ForkProgress,
  type RunnerCapability,
} from './types';

const TOOL_ID = 'claude' as const;

/** Empty MCP config used to override whatever the user has at the project / */
/** user level. Combined with `--strict-mcp-config`, this disables MCP for  */
/** the fork's lifetime without touching the host's settings.               */
const EMPTY_MCP_CONFIG = JSON.stringify({ mcpServers: {} });

async function isClaudeOnPath(): Promise<boolean> {
  return new Promise((resolve) => {
    const ps = spawn('which', ['claude'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    ps.stdout.on('data', (chunk) => {
      out += chunk.toString();
    });
    ps.on('close', (code) => resolve(code === 0 && out.trim().length > 0));
    ps.on('error', () => resolve(false));
  });
}

export interface ClaudeSpawnResult {
  events: StreamEvent[];
  resultText: string;
  forkSessionId: string | null;
  exitCode: number | null;
}

export interface ClaudeSpawnOpts {
  sourceSessionId: string;
  cwd: string;
  prompt: string;
  emptyMcpConfigPath: string;
  startedAt: number;
  emit: (e: ForkProgress) => void;
}

export async function spawnClaudeStream(
  opts: ClaudeSpawnOpts,
): Promise<ClaudeSpawnResult> {
  const { sourceSessionId, cwd, prompt, emptyMcpConfigPath, startedAt, emit } =
    opts;
  return new Promise((resolve, reject) => {
    const events: StreamEvent[] = [];
    const errs: string[] = [];
    let forkSessionId: string | null = null;
    let cumulativeCacheRead = 0;

    // Diagnostic: dump every stream event we receive to /tmp so we can
    // figure out which event types Claude actually emits with
    // `--include-partial-messages`. Toggle off via env when not needed.
    const traceEvents = process.env.SESSION_VIEWER_TRACE_FORK !== '0';
    const traceFile = '/tmp/session-viewer-fork-trace.jsonl';

    const parser = new StreamParser(
      (event) => {
        events.push(event);
        if (traceEvents) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require('node:fs').appendFileSync(
              traceFile,
              `${JSON.stringify({ t: Date.now() - startedAt, event })}\n`,
            );
          } catch {
            /* never let tracing break the runner */
          }
        }
        // Translate stream-json events into operator-facing progress.
        const evType = (event as { type?: string }).type;
        if (evType === 'system') {
          const subtype = (event as { subtype?: string }).subtype;
          if (subtype === 'init') {
            const sid = (event as { session_id?: string }).session_id;
            if (typeof sid === 'string') forkSessionId = sid;
            emit({
              sourceSessionId,
              phase: 'system-init',
              message: `fork session ${forkSessionId?.slice(0, 8) ?? '?'}…`,
              elapsedMs: Date.now() - startedAt,
              forkSessionId: forkSessionId ?? undefined,
            });
          }
        } else if (evType === 'assistant') {
          // Whole assistant event arrived (`--include-partial-messages` also
          // emits these). We surface the textual fragment as a delta so the
          // renderer can append it into the live transcript.
          const message = (event as { message?: { content?: unknown[] } })
            .message;
          if (message && Array.isArray(message.content)) {
            const text = message.content
              .filter(
                (c): c is { type: 'text'; text: string } =>
                  !!c &&
                  typeof c === 'object' &&
                  (c as { type?: string }).type === 'text' &&
                  typeof (c as { text?: string }).text === 'string',
              )
              .map((c) => c.text)
              .join('');
            const usage = (
              event as { message?: { usage?: { cache_read_input_tokens?: number } } }
            ).message?.usage;
            if (typeof usage?.cache_read_input_tokens === 'number') {
              cumulativeCacheRead = Math.max(
                cumulativeCacheRead,
                usage.cache_read_input_tokens,
              );
            }
            if (text) {
              emit({
                sourceSessionId,
                phase: 'assistant-streaming',
                elapsedMs: Date.now() - startedAt,
                forkSessionId: forkSessionId ?? undefined,
                textDelta: text,
                cacheReadTokens: cumulativeCacheRead || undefined,
              });
            }
          }
        } else if (evType === 'result') {
          emit({
            sourceSessionId,
            phase: 'assistant-complete',
            message: 'model turn finished',
            elapsedMs: Date.now() - startedAt,
            forkSessionId: forkSessionId ?? undefined,
            cacheReadTokens: cumulativeCacheRead || undefined,
          });
        }
      },
      (errMsg) => {
        errs.push(errMsg);
      },
    );

    // Order matters here only for readability; the CLI doesn't care.
    const args = [
      '--resume',
      sourceSessionId,
      // Branch the source without rewriting its JSONL — the CLI mints a
      // new session id and emits it in the system/init event below.
      '--fork-session',
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
      // Hard-cap to a single assistant turn so the model can't slide into
      // a tool-using exploration loop.
      '--max-turns',
      '1',
      // Stream partial chunks as they arrive — lets the GUI render the
      // model's response as it forms, instead of a static spinner until
      // the whole turn lands.
      '--include-partial-messages',
      // Disable every built-in tool. With "--tools \"\"" the model
      // physically cannot call Bash / Edit / Read / etc. on this turn.
      '--tools',
      '',
      // Override MCP with an empty config and forbid fallbacks. This is
      // what removes the "MCP is still triggering" foot-gun the operator
      // ran into — model has no MCP servers to invoke.
      '--mcp-config',
      emptyMcpConfigPath,
      '--strict-mcp-config',
      // Block agent / skill discovery so the model can't pivot into a
      // sub-agent run during the fork.
      '--disable-slash-commands',
      // NOTE: deliberately NOT using `--bare`. It would also gate auth to
      // ANTHROPIC_API_KEY / apiKeyHelper and break Claude-subscription
      // OAuth users. The combination of `--tools ""`, empty
      // `--mcp-config` + `--strict-mcp-config`, and `--max-turns 1` is
      // already enough to keep the fork honest.
    ];

    const child = spawn('claude', args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderrBuf = '';
    child.stdout?.on('data', (chunk: Buffer) => parser.processChunk(chunk));
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString('utf8');
    });

    child.on('error', (err) => {
      reject(new RunnerUnavailableError('claude', err.message));
    });

    child.on('close', (code) => {
      parser.flush();
      const resultEvent = events.find(
        (e): e is StreamEvent & { result: string } =>
          (e as { type?: string }).type === 'result' &&
          typeof (e as { result?: unknown }).result === 'string',
      );
      const resultText = resultEvent?.result ?? '';
      if (code !== 0 && !resultText) {
        reject(
          new Error(
            `claude exited with code ${code}; stderr=${stderrBuf.slice(0, 800)}; stream errors=${errs.slice(0, 3).join(' | ')}`,
          ),
        );
        return;
      }
      resolve({ events, resultText, forkSessionId, exitCode: code });
    });
  });
}

export interface FirstTurnUsage {
  inputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  durationMs: number;
  costUsd: number;
}

export function extractFirstTurnUsage(events: StreamEvent[]): FirstTurnUsage {
  for (const event of events) {
    if ((event as { type?: string }).type !== 'assistant') continue;
    const message = (event as { message?: { usage?: Record<string, number> } })
      .message;
    const usage = message?.usage;
    if (!usage) continue;
    const result = events.find((e) => (e as { type?: string }).type === 'result') as
      | { duration_ms?: number; total_cost_usd?: number }
      | undefined;
    return {
      inputTokens: usage.input_tokens ?? 0,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
      durationMs: result?.duration_ms ?? 0,
      costUsd: result?.total_cost_usd ?? 0,
    };
  }
  const empty = emptyCacheMetrics();
  return {
    inputTokens: empty.inputTokens,
    cacheReadTokens: empty.cacheReadInputTokens,
    cacheCreationTokens: empty.cacheCreationInputTokens,
    durationMs: 0,
    costUsd: 0,
  };
}

export async function withTempEmptyMcpConfig<T>(
  task: (path: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'session-viewer-mcp-'));
  const path = join(dir, 'mcp.json');
  await writeFile(path, EMPTY_MCP_CONFIG, 'utf8');
  try {
    return await task(path);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export const claudeRunner: CliRunner = {
  async capability(): Promise<RunnerCapability> {
    const ok = await isClaudeOnPath();
    return {
      toolId: TOOL_ID,
      available: ok,
      unavailableReason: ok ? undefined : '`claude` binary not found on PATH',
    };
  },

  async fork(ctx: ForkContext): Promise<SummaryResult> {
    if (ctx.toolId !== TOOL_ID) {
      throw new RunnerUnavailableError(ctx.toolId, 'claudeRunner only handles claude');
    }

    const prompt = buildSummarizePrompt({
      operatorOverride: ctx.promptOverride,
      language: ctx.language,
    });
    const startedAt = Date.now();
    const emit = (e: ForkProgress) => {
      try {
        ctx.onProgress?.(e);
      } catch {
        // Ignore progress-sink failures — they must never derail the fork.
      }
    };

    emit({
      sourceSessionId: ctx.sourceSessionId,
      phase: 'started',
      message: 'preparing fork',
      elapsedMs: 0,
    });

    return withTempEmptyMcpConfig(async (mcpConfigPath) => {
      emit({
        sourceSessionId: ctx.sourceSessionId,
        phase: 'cli-spawned',
        message: 'spawning claude --resume --fork-session',
        elapsedMs: Date.now() - startedAt,
      });

      let events: StreamEvent[];
      let resultText: string;
      let forkSessionId: string | null;
      try {
        const result = await spawnClaudeStream({
          sourceSessionId: ctx.sourceSessionId,
          cwd: ctx.cwd,
          prompt,
          emptyMcpConfigPath: mcpConfigPath,
          startedAt,
          emit,
        });
        events = result.events;
        resultText = result.resultText;
        forkSessionId = result.forkSessionId;
      } catch (err) {
        emit({
          sourceSessionId: ctx.sourceSessionId,
          phase: 'failed',
          elapsedMs: Date.now() - startedAt,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }

      let modelOutput;
      try {
        modelOutput = parseModelOutput(resultText);
      } catch (err) {
        emit({
          sourceSessionId: ctx.sourceSessionId,
          phase: 'failed',
          elapsedMs: Date.now() - startedAt,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
      const usage = extractFirstTurnUsage(events);
      const denom = usage.inputTokens + usage.cacheReadTokens;

      emit({
        sourceSessionId: ctx.sourceSessionId,
        phase: 'parsed',
        message: 'JSON validated',
        elapsedMs: Date.now() - startedAt,
        forkSessionId: forkSessionId ?? undefined,
        cacheReadTokens: usage.cacheReadTokens || undefined,
      });

      return {
        ...modelOutput,
        cacheInvariants: {
          forkSessionId: forkSessionId ?? '<unknown>',
          sourceSessionId: ctx.sourceSessionId,
          inputTokens: usage.inputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheCreationTokens: usage.cacheCreationTokens,
          prefixPreservedRatio: denom > 0 ? usage.cacheReadTokens / denom : 0,
          durationMs: usage.durationMs > 0 ? usage.durationMs : undefined,
          costUsd: usage.costUsd > 0 ? usage.costUsd : undefined,
        },
        generatedAt: new Date().toISOString(),
      };
    });
  },
};
