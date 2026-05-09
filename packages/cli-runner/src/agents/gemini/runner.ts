/**
 * Gemini fork runner.
 *
 * Gemini's CLI surface for resume is index-based (`-r <number>`), not
 * sessionId-based, AND it has no `--ephemeral` flag — a `--resume` always
 * appends the new turn into the source's `chats/session-*.json`.
 *
 * Both of those make a "real" fork awkward, so for v1 we take the
 * pragmatic prompt-serialize path:
 *
 *   1. Look up the source session JSON on disk by walking
 *      `~/.gemini/tmp/<id>/chats/*.json` for a matching `sessionId`.
 *   2. Build a prompt that prepends a compact transcript of the source
 *      conversation, followed by the canonical summarize template.
 *   3. Spawn `gemini -p <prompt> -o stream-json --approval-mode plan` as
 *      a fresh, read-only call. The plan-mode approval blocks any tool
 *      execution, matching what the Claude/Codex runners give us.
 *
 * Trade-off: prefix bytes don't match the source's cached prefix on the
 * server, so `cacheReadTokens` will be 0 / `prefixPreservedRatio` 0. The
 * source session is not modified. The summary itself is still accurate
 * because the model receives the full conversation in the new prompt.
 */

import type { SummaryResult } from '@context-action/session-core';
import { spawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseModelOutput } from '../../parseModelOutput';
import { buildSummarizePrompt } from '../../prompts';
import {
  ForkPrerequisiteError,
  RunnerUnavailableError,
  type CliRunner,
  type ForkContext,
  type ForkProgress,
  type RunnerCapability,
} from '../../types';

const TOOL_ID = 'gemini' as const;
const TMP_ROOT = join(homedir(), '.gemini', 'tmp');
/** Cap the serialised transcript to avoid blowing past Gemini's context. */
const MAX_TRANSCRIPT_CHARS = 200_000;

interface GeminiSessionJson {
  sessionId?: string;
  messages?: Array<{
    type?: string;
    content?: unknown;
    timestamp?: string;
  }>;
}

async function isGeminiOnPath(): Promise<boolean> {
  return new Promise((resolve) => {
    const ps = spawn('which', ['gemini'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    ps.stdout.on('data', (chunk) => {
      out += chunk.toString();
    });
    ps.on('close', (code) => resolve(code === 0 && out.trim().length > 0));
    ps.on('error', () => resolve(false));
  });
}

async function findSourceSessionFile(
  sourceSessionId: string,
): Promise<string | null> {
  let projectDirs: string[] = [];
  try {
    const entries = await readdir(TMP_ROOT, { withFileTypes: true });
    projectDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return null;
  }

  for (const dirName of projectDirs) {
    const chatsDir = join(TMP_ROOT, dirName, 'chats');
    let files: string[] = [];
    try {
      const entries = await readdir(chatsDir, { withFileTypes: true });
      files = entries
        .filter((e) => e.isFile() && e.name.endsWith('.json'))
        .map((e) => e.name);
    } catch {
      continue;
    }
    for (const file of files) {
      const path = join(chatsDir, file);
      try {
        const raw = await readFile(path, 'utf8');
        const parsed = JSON.parse(raw) as GeminiSessionJson;
        if (parsed.sessionId === sourceSessionId) return path;
      } catch {
        /* keep walking */
      }
    }
  }
  return null;
}

function messageContentToText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((v) => messageContentToText(v))
      .filter((s) => s.length > 0)
      .join('\n');
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.content === 'string') return obj.content;
    if (typeof obj.message === 'string') return obj.message;
    return '';
  }
  return '';
}

/**
 * Render the Gemini messages array as a labeled transcript. Truncate to
 * `MAX_TRANSCRIPT_CHARS` from the END (newest content), since the
 * summary should be grounded in the recent state of the conversation
 * rather than the opening turns.
 */
function buildTranscript(messages: GeminiSessionJson['messages']): string {
  if (!Array.isArray(messages)) return '';
  const lines: string[] = [];
  for (const msg of messages) {
    if (!msg) continue;
    const type = typeof msg.type === 'string' ? msg.type : 'message';
    const text = messageContentToText(msg.content).trim();
    if (!text) continue;
    const role =
      type === 'user'
        ? 'user'
        : type === 'gemini' || type === 'assistant'
          ? 'assistant'
          : type;
    lines.push(`[${role}] ${text}`);
  }
  let transcript = lines.join('\n\n');
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    transcript =
      `… (transcript truncated; ${transcript.length - MAX_TRANSCRIPT_CHARS} earlier chars elided)\n\n` +
      transcript.slice(transcript.length - MAX_TRANSCRIPT_CHARS);
  }
  return transcript;
}

interface SpawnResult {
  finalText: string;
  exitCode: number | null;
}

async function spawnGemini(
  prompt: string,
  cwd: string,
  emit: (e: ForkProgress) => void,
  startedAt: number,
  sourceSessionId: string,
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    let lineBuffer = '';
    let stderrBuf = '';
    // Collect every assistant text chunk we see, in order. Gemini's
    // stream-json appears to emit assistant content as multiple message
    // events (each with its own delta), and previous attempts at
    // "cumulative or delta?" guessing dropped data. Concatenating the
    // ordered list at close-time is unambiguous regardless of which
    // semantics the CLI uses.
    const assistantChunks: string[] = [];
    let runningCumulative = '';

    const args = [
      '-p',
      prompt,
      '-o',
      'stream-json',
      '--approval-mode',
      'plan', // read-only — blocks any tool invocation
    ];

    const child = spawn('gemini', args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) return;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(trimmed);
      } catch {
        return;
      }
      // Only treat events explicitly tagged as the assistant turn — the
      // user echo and tool events also carry `type: 'message'` and
      // would otherwise pollute the captured response.
      const role = typeof event.role === 'string' ? event.role : '';
      if (role !== 'assistant' && role !== 'model' && role !== 'gemini') {
        return;
      }
      const text = messageContentToText(event.content);
      if (!text) return;
      assistantChunks.push(text);
      runningCumulative += text;
      emit({
        sourceSessionId,
        phase: 'assistant-streaming',
        elapsedMs: Date.now() - startedAt,
        textDelta: text,
      });
    };

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

    child.on('close', (code) => {
      if (lineBuffer.trim()) handleLine(lineBuffer);

      if (assistantChunks.length === 0) {
        // No assistant text recovered. Surface whatever stderr told us
        // (rate limits, auth failures) so the caller has something to
        // act on instead of a generic "no JSON".
        const detail = stderrBuf.trim() || `exit ${code}`;
        reject(new Error(`gemini produced no assistant output: ${detail.slice(0, 800)}`));
        return;
      }

      resolve({
        finalText: runningCumulative,
        exitCode: code,
      });
    });
  });
}

export const geminiRunner: CliRunner = {
  async capability(): Promise<RunnerCapability> {
    const ok = await isGeminiOnPath();
    return {
      toolId: TOOL_ID,
      available: ok,
      unavailableReason: ok ? undefined : '`gemini` binary not found on PATH',
    };
  },

  async fork(ctx: ForkContext): Promise<SummaryResult> {
    if (ctx.toolId !== TOOL_ID) {
      throw new RunnerUnavailableError(ctx.toolId, 'geminiRunner only handles gemini');
    }

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
      message: 'reading source session',
      elapsedMs: 0,
    });

    const path = await findSourceSessionFile(ctx.sourceSessionId);
    if (!path) {
      emit({
        sourceSessionId: ctx.sourceSessionId,
        phase: 'failed',
        elapsedMs: Date.now() - startedAt,
        error: `source session ${ctx.sourceSessionId} not found under ${TMP_ROOT}`,
      });
      throw new ForkPrerequisiteError(
        `Gemini source session ${ctx.sourceSessionId} not found.`,
      );
    }

    let parsed: GeminiSessionJson;
    try {
      parsed = JSON.parse(await readFile(path, 'utf8')) as GeminiSessionJson;
    } catch (err) {
      throw new ForkPrerequisiteError(
        `Failed to read Gemini session ${ctx.sourceSessionId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const transcript = buildTranscript(parsed.messages);
    const summarizePrompt = buildSummarizePrompt({
      operatorOverride: ctx.promptOverride,
      language: ctx.language,
    });

    // Compose: transcript context first, then the canonical summarize
    // template. The model is told the transcript is the only source of
    // truth, matching the Claude/Codex runner contract.
    const prompt = [
      'You are summarising the following recorded conversation. The transcript below is the ONLY source of truth — do not draw on outside context.',
      '',
      '--- BEGIN SOURCE TRANSCRIPT ---',
      transcript,
      '--- END SOURCE TRANSCRIPT ---',
      '',
      summarizePrompt,
    ].join('\n');

    emit({
      sourceSessionId: ctx.sourceSessionId,
      phase: 'cli-spawned',
      message: 'spawning gemini -p (plan mode)',
      elapsedMs: Date.now() - startedAt,
    });

    let result: SpawnResult;
    try {
      result = await spawnGemini(
        prompt,
        ctx.cwd,
        emit,
        startedAt,
        ctx.sourceSessionId,
      );
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
      modelOutput = parseModelOutput(result.finalText);
    } catch (err) {
      emit({
        sourceSessionId: ctx.sourceSessionId,
        phase: 'failed',
        elapsedMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    emit({
      sourceSessionId: ctx.sourceSessionId,
      phase: 'parsed',
      message: 'JSON validated',
      elapsedMs: Date.now() - startedAt,
    });

    return {
      ...modelOutput,
      cacheInvariants: {
        // Prompt-serialize approach can't get a real fork id back from
        // the CLI; persist a sentinel so the record still has a stable
        // key (the SummaryRecord layer falls back to a UUID when needed).
        forkSessionId: '<gemini-prompt-serialize>',
        sourceSessionId: ctx.sourceSessionId,
        // Cache_read is structurally 0 with the prompt-serialize fork —
        // the prefix differs because we wrap the transcript in fresh
        // instructions. We surface the zeroes honestly so the GUI's
        // "prefix preserved %" badge tells the truth.
        inputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        prefixPreservedRatio: 0,
      },
      generatedAt: new Date().toISOString(),
    } satisfies SummaryResult & {
      cacheInvariants: NonNullable<SummaryResult['cacheInvariants']>;
    };
  },
};
