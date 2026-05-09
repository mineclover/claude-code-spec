/**
 * Codex annotator primitive.
 *
 * Per-batch flow:
 *   1. `prepare()` checks `codex` is on PATH and starts a single
 *      `codex app-server` JSON-RPC stdio process via
 *      `CodexAppServerClient` (handshake + initialized notification).
 *   2. Each `forkAndAnnotate()`:
 *      a. Sends `thread/fork` with `ephemeral: true` against the source
 *         session — codex mints a new fork that shares the source's
 *         prefix without persisting to disk.
 *      b. Sends `turn/start` with `outputSchema` so codex enforces
 *         the JSON shape of the model's final message server-side.
 *      c. Awaits `turn/completed`, collecting `agentMessage` items
 *         and `thread/tokenUsage/updated` notifications.
 *   3. `shutdown()` SIGTERMs the app-server process.
 */

import { spawn } from 'node:child_process';
import { CodexAppServerClient, type CodexThreadItem } from './appServer';
import type {
  AnnotateBatchInput,
  AnnotateBatchResult,
  AnnotatorPrimitive,
} from '../types';

async function isCodexOnPath(): Promise<boolean> {
  return new Promise((resolve) => {
    const ps = spawn('which', ['codex'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
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

  async forkAndAnnotate(
    input: AnnotateBatchInput,
  ): Promise<AnnotateBatchResult> {
    if (!this.client) {
      throw new Error(
        'CodexPrimitive.prepare must be called before forkAndAnnotate',
      );
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
      if (
        item.type === 'agentMessage' &&
        typeof item.text === 'string' &&
        item.text
      ) {
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
