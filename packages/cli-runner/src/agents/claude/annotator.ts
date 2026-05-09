/**
 * Claude annotator primitive.
 *
 * Per-batch flow:
 *   1. `prepare()` writes a fresh empty MCP config to a tmp dir.
 *   2. Each `forkAndAnnotate()` spawns `claude --resume <id>
 *      --fork-session --tools "" --mcp-config <empty> --max-turns 1`
 *      and captures the streamed JSON response.
 *   3. `shutdown()` removes the tmp dir.
 *
 * Cache prefix is preserved because every fork shares the source
 * session's exact prefix bytes — `--fork-session` mints a new session
 * id without rewriting the source JSONL.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  spawnClaudeStream,
  extractFirstTurnUsage,
} from './runner';
import type {
  AnnotateBatchInput,
  AnnotateBatchResult,
  AnnotatorPrimitive,
} from '../types';

const EMPTY_MCP_CONFIG = JSON.stringify({ mcpServers: {} });

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

  async forkAndAnnotate(
    input: AnnotateBatchInput,
  ): Promise<AnnotateBatchResult> {
    if (!this.mcpConfigPath) {
      throw new Error(
        'ClaudePrimitive.prepare must be called before forkAndAnnotate',
      );
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
    await rm(this.mcpDir, { recursive: true, force: true }).catch(
      () => undefined,
    );
    this.mcpDir = null;
    this.mcpConfigPath = null;
  }
}
