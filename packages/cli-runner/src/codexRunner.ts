/**
 * Codex fork runner.
 *
 * Codex ships a built-in non-interactive resume that writes nothing back
 * to disk:
 *
 *   codex exec resume --json --ephemeral \
 *     --output-last-message <tmpfile> \
 *     <SOURCE_SESSION_ID> "<PROMPT>"
 *
 * - `--ephemeral` is the equivalent of Claude's `--fork-session` — the
 *   resumed thread runs the new turn but no JSONL is appended to the
 *   source. We keep cache_read tokens from the API's prompt cache when
 *   the prompt prefix matches what the source already cached server-side.
 * - `--output-last-message` writes the model's final assistant text to
 *   a file we control; we parse that for the JSON envelope. The streaming
 *   --json output is used purely for progress + token usage observation.
 */

import type { SummaryResult } from '@context-action/session-core';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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

const TOOL_ID = 'codex' as const;

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function isCodexOnPath(): Promise<boolean> {
  return new Promise((resolve) => {
    const ps = spawn('which', ['codex'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    ps.stdout.on('data', (chunk) => {
      out += chunk.toString();
    });
    ps.on('close', (code) => resolve(code === 0 && out.trim().length > 0));
    ps.on('error', () => resolve(false));
  });
}

interface CodexUsage {
  inputTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  contextWindow: number;
}

interface SpawnOpts {
  sourceSessionId: string;
  cwd: string;
  prompt: string;
  outputLastMessagePath: string;
  startedAt: number;
  emit: (e: ForkProgress) => void;
}

interface SpawnResult {
  finalMessage: string;
  usage: CodexUsage;
  durationMs: number;
  exitCode: number | null;
}

/**
 * Codex emits its own JSONL flavour over stdout; we don't reuse the Claude
 * StreamParser because the wire shapes differ. Each line is one event;
 * failures to parse are tolerated (tracing a non-JSON line is enough).
 */
async function spawnCodexStream(opts: SpawnOpts): Promise<SpawnResult> {
  const {
    sourceSessionId,
    cwd,
    prompt,
    outputLastMessagePath,
    startedAt,
    emit,
  } = opts;

  return new Promise((resolve, reject) => {
    const usage: CodexUsage = {
      inputTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 0,
      contextWindow: 0,
    };
    let totalDurationMs = 0;
    let lineBuffer = '';
    let stderrBuf = '';
    // Cumulative streaming text — we accumulate from item.completed
    // agent_message events because Codex doesn't reliably emit per-token
    // deltas the way Claude does, but the user still wants to see the
    // model's voice as it arrives.
    let streamedSoFar = '';

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) return;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(trimmed);
      } catch {
        return;
      }
      const evType = typeof event.type === 'string' ? event.type : '';
      const payload =
        event.payload && typeof event.payload === 'object'
          ? (event.payload as Record<string, unknown>)
          : null;

      if (evType === 'session_meta' && payload) {
        // Codex assigns the resumed thread a new id under --ephemeral; we
        // surface it the same way Claude's system_init is surfaced.
        const id = typeof payload.id === 'string' ? payload.id : undefined;
        emit({
          sourceSessionId,
          phase: 'system-init',
          message: id ? `fork thread ${id.slice(0, 8)}…` : 'fork thread initialised',
          elapsedMs: Date.now() - startedAt,
          forkSessionId: id,
        });
      } else if (evType === 'event_msg' && payload?.type === 'token_count') {
        const info =
          payload.info && typeof payload.info === 'object'
            ? (payload.info as Record<string, unknown>)
            : null;
        const total =
          info?.total_token_usage && typeof info.total_token_usage === 'object'
            ? (info.total_token_usage as Record<string, unknown>)
            : null;
        if (total) {
          usage.inputTokens = num(total.input_tokens);
          usage.cacheReadTokens = num(total.cached_input_tokens);
          usage.outputTokens = num(total.output_tokens);
        }
        if (info && typeof info.model_context_window === 'number') {
          usage.contextWindow = info.model_context_window;
        }
      } else if (evType === 'turn.completed' && payload) {
        totalDurationMs += num(payload.duration_ms);
        emit({
          sourceSessionId,
          phase: 'assistant-complete',
          message: 'turn finished',
          elapsedMs: Date.now() - startedAt,
          cacheReadTokens: usage.cacheReadTokens || undefined,
        });
      } else if (
        (evType === 'item.completed' || evType === 'item.started') &&
        payload
      ) {
        const item =
          payload.item && typeof payload.item === 'object'
            ? (payload.item as Record<string, unknown>)
            : null;
        if (item && item.type === 'agent_message') {
          const text =
            typeof item.text === 'string'
              ? item.text
              : typeof item.message === 'string'
                ? item.message
                : '';
          if (text && text !== streamedSoFar) {
            streamedSoFar = text;
            emit({
              sourceSessionId,
              phase: 'assistant-streaming',
              elapsedMs: Date.now() - startedAt,
              textDelta: text,
              cacheReadTokens: usage.cacheReadTokens || undefined,
            });
          }
        }
      }
    };

    const args = [
      'exec',
      'resume',
      '--json',
      '--ephemeral',
      '--skip-git-repo-check',
      '--output-last-message',
      outputLastMessagePath,
      sourceSessionId,
      prompt,
    ];

    const child = spawn('codex', args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (chunk: Buffer) => {
      lineBuffer += chunk.toString('utf8');
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';
      for (const line of lines) handleLine(line);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString('utf8');
    });

    child.on('error', (err) => {
      reject(new RunnerUnavailableError(TOOL_ID, err.message));
    });

    child.on('close', async (code) => {
      // Drain trailing line
      if (lineBuffer.trim()) handleLine(lineBuffer);

      let finalMessage = '';
      try {
        finalMessage = await readFile(outputLastMessagePath, 'utf8');
      } catch {
        finalMessage = '';
      }

      if (code !== 0 && !finalMessage) {
        reject(
          new Error(
            `codex exited with code ${code}; stderr=${stderrBuf.slice(0, 800)}`,
          ),
        );
        return;
      }

      resolve({
        finalMessage,
        usage,
        durationMs: totalDurationMs,
        exitCode: code,
      });
    });
  });
}

async function withTempLastMessageFile<T>(
  task: (path: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'session-viewer-codex-'));
  const path = join(dir, 'last-message.txt');
  try {
    return await task(path);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export const codexRunner: CliRunner = {
  async capability(): Promise<RunnerCapability> {
    const ok = await isCodexOnPath();
    return {
      toolId: TOOL_ID,
      available: ok,
      unavailableReason: ok ? undefined : '`codex` binary not found on PATH',
    };
  },

  async fork(ctx: ForkContext): Promise<SummaryResult> {
    if (ctx.toolId !== TOOL_ID) {
      throw new RunnerUnavailableError(ctx.toolId, 'codexRunner only handles codex');
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
        /* ignore */
      }
    };

    emit({
      sourceSessionId: ctx.sourceSessionId,
      phase: 'started',
      message: 'preparing codex fork',
      elapsedMs: 0,
    });

    return withTempLastMessageFile(async (lastMessagePath) => {
      emit({
        sourceSessionId: ctx.sourceSessionId,
        phase: 'cli-spawned',
        message: 'spawning codex exec resume --ephemeral',
        elapsedMs: Date.now() - startedAt,
      });

      let result: SpawnResult;
      try {
        result = await spawnCodexStream({
          sourceSessionId: ctx.sourceSessionId,
          cwd: ctx.cwd,
          prompt,
          outputLastMessagePath: lastMessagePath,
          startedAt,
          emit,
        });
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
        modelOutput = parseModelOutput(result.finalMessage);
      } catch (err) {
        emit({
          sourceSessionId: ctx.sourceSessionId,
          phase: 'failed',
          elapsedMs: Date.now() - startedAt,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }

      const denom = result.usage.inputTokens + result.usage.cacheReadTokens;

      emit({
        sourceSessionId: ctx.sourceSessionId,
        phase: 'parsed',
        message: 'JSON validated',
        elapsedMs: Date.now() - startedAt,
        cacheReadTokens: result.usage.cacheReadTokens || undefined,
      });

      return {
        ...modelOutput,
        cacheInvariants: {
          // Codex doesn't always re-emit the new thread id when --ephemeral
          // is on; fall back to a sentinel rather than blocking persistence.
          forkSessionId: '<codex-ephemeral>',
          sourceSessionId: ctx.sourceSessionId,
          inputTokens: result.usage.inputTokens,
          cacheReadTokens: result.usage.cacheReadTokens,
          // Codex doesn't expose cache_creation as a separate counter; we
          // leave it 0 and rely on prefixPreservedRatio to tell the story.
          cacheCreationTokens: 0,
          prefixPreservedRatio:
            denom > 0 ? result.usage.cacheReadTokens / denom : 0,
          durationMs: result.durationMs > 0 ? result.durationMs : undefined,
        },
        generatedAt: new Date().toISOString(),
      } satisfies SummaryResult & {
        cacheInvariants: NonNullable<SummaryResult['cacheInvariants']>;
      };
    });
  },
};
