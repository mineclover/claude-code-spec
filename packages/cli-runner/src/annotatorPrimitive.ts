/**
 * Per-CLI fork primitive used by the annotator.
 *
 * The annotator's outer loop is the same regardless of which CLI hosts
 * the source session: pick a batch of unfilled steps, ask the model to
 * tag them, merge the response back into the outline, repeat. The
 * cache-preserving fork mechanic differs per CLI, though:
 *
 *   - Claude: every batch spawns a fresh `claude --resume --fork-session`
 *     process. Cache lookup is implicit on the server side. We disable
 *     tools / MCP / slash commands so the model produces a single JSON
 *     turn and exits.
 *
 *   - Codex: a single `codex app-server` process is started for the
 *     whole annotation run. The first batch calls `thread/fork
 *     --ephemeral` to mint a fresh thread that shares the source's
 *     prefix; subsequent batches call `thread/fork` again per attempt
 *     (each batch wants its own clean prefix view of the source
 *     transcript). `turn/start` carries an `outputSchema` so codex
 *     enforces the JSON shape on the model's behalf.
 *
 *   - Gemini: not yet wired. Gemini's prompt-serialize approach loses
 *     prefix bytes by construction, so the cache benefit doesn't apply
 *     and we'd be running expensive cold turns. Skipped for v1.
 *
 * The interface lets the annotator stay CLI-agnostic at the top level
 * while each implementation handles its own setup, single-batch fork,
 * and teardown.
 */

import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  spawnClaudeStream,
  extractFirstTurnUsage,
} from './claudeRunner';
import { CodexAppServerClient, type CodexThreadItem } from './codexAppServer';
import { type ForkProgress } from './types';

const EMPTY_MCP_CONFIG = JSON.stringify({ mcpServers: {} });

export interface AnnotateBatchInput {
  prompt: string;
  /**
   * JSON Schema fragment describing the expected response (an object
   * with a `descriptions` map). Implementations that support
   * server-side enforcement (codex `turn/start.outputSchema`) pass
   * this through; others ignore it and rely on prompt-only constraints.
   */
  outputSchema?: unknown;
  emit: (event: ForkProgress) => void;
}

export interface AnnotateBatchResult {
  /** The model's raw text response. Annotator parses this with `parseAnnotateBatch`. */
  rawText: string;
  /** Fork / turn id for cache invariants — null when the CLI doesn't expose one. */
  forkSessionId: string | null;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  inputTokens: number;
  durationMs?: number;
  costUsd?: number;
}

export interface AnnotatorPrimitive {
  toolId: 'claude' | 'codex' | 'gemini';
  /** One-time setup before any batch runs. */
  prepare(): Promise<void>;
  forkAndAnnotate(input: AnnotateBatchInput): Promise<AnnotateBatchResult>;
  /** Always called in `finally`; must be idempotent. */
  shutdown(): Promise<void>;
}

// ─── Claude ──────────────────────────────────────────────────────────

export class ClaudePrimitive implements AnnotatorPrimitive {
  readonly toolId = 'claude' as const;

  private mcpConfigPath: string | null = null;
  private mcpDir: string | null = null;
  private startedAt = 0;

  constructor(
    private readonly sourceSessionId: string,
    private readonly cwd: string,
  ) {}

  async prepare(): Promise<void> {
    this.startedAt = Date.now();
    const dir = await mkdtemp(join(tmpdir(), 'session-viewer-mcp-'));
    const path = join(dir, 'mcp.json');
    await writeFile(path, EMPTY_MCP_CONFIG, 'utf8');
    this.mcpDir = dir;
    this.mcpConfigPath = path;
  }

  async forkAndAnnotate(input: AnnotateBatchInput): Promise<AnnotateBatchResult> {
    if (!this.mcpConfigPath) {
      throw new Error('ClaudePrimitive.prepare must be called before forkAndAnnotate');
    }
    // outputSchema is ignored for claude — claude has no equivalent
    // server-side schema enforcement on the streaming-JSON path. The
    // prompt itself instructs the model to produce strict JSON, and
    // `parseAnnotateBatch` retries on malformed batches.
    const result = await spawnClaudeStream({
      sourceSessionId: this.sourceSessionId,
      cwd: this.cwd,
      prompt: input.prompt,
      emptyMcpConfigPath: this.mcpConfigPath,
      startedAt: this.startedAt,
      emit: input.emit,
    });
    const usage = extractFirstTurnUsage(result.events);
    return {
      rawText: result.resultText,
      forkSessionId: result.forkSessionId,
      cacheReadTokens: usage.cacheReadTokens,
      cacheCreationTokens: usage.cacheCreationTokens,
      inputTokens: usage.inputTokens,
      durationMs: usage.durationMs > 0 ? usage.durationMs : undefined,
      costUsd: usage.costUsd > 0 ? usage.costUsd : undefined,
    };
  }

  async shutdown(): Promise<void> {
    if (!this.mcpDir) return;
    await rm(this.mcpDir, { recursive: true, force: true }).catch(() => undefined);
    this.mcpDir = null;
    this.mcpConfigPath = null;
  }
}

// ─── Codex ───────────────────────────────────────────────────────────

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

export class CodexPrimitive implements AnnotatorPrimitive {
  readonly toolId = 'codex' as const;

  private client: CodexAppServerClient | null = null;
  private startedAt = 0;

  constructor(
    private readonly sourceSessionId: string,
    private readonly cwd: string,
  ) {}

  async prepare(): Promise<void> {
    this.startedAt = Date.now();
    if (!(await isCodexOnPath())) {
      throw new Error('codex binary not found on PATH');
    }
    this.client = await CodexAppServerClient.start({ cwd: this.cwd });
  }

  async forkAndAnnotate(input: AnnotateBatchInput): Promise<AnnotateBatchResult> {
    if (!this.client) {
      throw new Error('CodexPrimitive.prepare must be called before forkAndAnnotate');
    }
    const client = this.client;
    const startedAt = this.startedAt;

    input.emit({
      sourceSessionId: this.sourceSessionId,
      phase: 'cli-spawned',
      message: 'codex thread/fork (ephemeral)',
      elapsedMs: Date.now() - startedAt,
    });

    // Fresh fork per batch so the prompt always sees the source's
    // prefix without prior batches' tags polluting the context. The
    // ephemeral flag tells codex not to persist the fork to disk —
    // it lives only for this turn.
    const forkResponse = (await client.request('thread/fork', {
      threadId: this.sourceSessionId,
      ephemeral: true,
      cwd: this.cwd,
      // Lock the fork down so the model can't escape into tool calls.
      // `never` skips approval prompts entirely, and `readOnly` with
      // network=false makes any tool the model still tries fail
      // immediately.
      approvalPolicy: 'never',
      sandbox: { type: 'readOnly', networkAccess: false },
      excludeTurns: true,
    })) as { thread?: { id?: string } };
    const forkThreadId = forkResponse?.thread?.id;
    if (!forkThreadId) {
      throw new Error(
        `codex thread/fork did not return a thread id; raw=${JSON.stringify(forkResponse).slice(0, 400)}`,
      );
    }

    input.emit({
      sourceSessionId: this.sourceSessionId,
      phase: 'system-init',
      message: `codex fork ${forkThreadId.slice(0, 8)}…`,
      elapsedMs: Date.now() - startedAt,
      forkSessionId: forkThreadId,
    });

    const onItem = (item: CodexThreadItem) => {
      if (item.type === 'agentMessage' && typeof item.text === 'string' && item.text) {
        input.emit({
          sourceSessionId: this.sourceSessionId,
          phase: 'assistant-streaming',
          elapsedMs: Date.now() - startedAt,
          forkSessionId: forkThreadId,
          textDelta: item.text,
        });
      }
    };

    const turnResult = await client.runTurn(
      {
        threadId: forkThreadId,
        prompt: input.prompt,
        cwd: this.cwd,
        approvalPolicy: 'never',
        sandboxPolicy: { type: 'readOnly', networkAccess: false },
        outputSchema: input.outputSchema,
      },
      { onItem },
    );

    input.emit({
      sourceSessionId: this.sourceSessionId,
      phase: 'assistant-complete',
      message: `codex turn ${turnResult.turnId.slice(0, 8)}… ${turnResult.status}`,
      elapsedMs: Date.now() - startedAt,
      forkSessionId: forkThreadId,
      cacheReadTokens: turnResult.tokenUsage?.last.cachedInputTokens,
    });

    return {
      rawText: turnResult.finalAgentMessage,
      forkSessionId: forkThreadId,
      cacheReadTokens: turnResult.tokenUsage?.last.cachedInputTokens ?? 0,
      // Codex's TokenUsageBreakdown doesn't split out a cache-creation
      // bucket (it's just `inputTokens` + `cachedInputTokens`); leaving
      // creation at 0 is the honest answer.
      cacheCreationTokens: 0,
      inputTokens: turnResult.tokenUsage?.last.inputTokens ?? 0,
      durationMs: turnResult.durationMs ?? undefined,
    };
  }

  async shutdown(): Promise<void> {
    if (!this.client) return;
    await this.client.shutdown().catch(() => undefined);
    this.client = null;
  }
}

// Factory + registry live in `./agents.ts` to avoid a circular
// dependency. This file only exports the interface + concrete
// primitive classes; consumers go through `getRunnerAgent` /
// `makeAnnotatorPrimitive` from `./agents`.

// ─── Schema helper ───────────────────────────────────────────────────

/**
 * Hand-rolled JSON Schema for `AnnotateBatchSchema`. Fed into codex's
 * `turn/start.outputSchema` so codex constrains the model's final
 * message server-side. Equivalent in shape to the zod schema in
 * `@context-action/session-core/outline/annotate-schema.ts`.
 *
 * Note: per-key narrowing isn't worth it here. The model knows the
 * expected indices from the prompt, and codex's enforcement is
 * structural — it'd reject extra keys but not catch a wrong index.
 * Keep the schema permissive; rely on annotateRunner's downstream
 * validation to drop unknown indices.
 */
export const ANNOTATE_BATCH_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['descriptions'],
  properties: {
    descriptions: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
  },
} as const;
