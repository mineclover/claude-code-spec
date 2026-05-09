/**
 * Shared agent abstractions for cli-runner.
 *
 * This file holds the contracts every agent must satisfy — the
 * `AnnotatorPrimitive` interface (per-batch fork mechanic), batch
 * input/output shapes, and the JSON Schema annotation backends use
 * for structured output enforcement.
 *
 * Per-agent classes (e.g. `ClaudePrimitive`, `CodexPrimitive`) live
 * under `agents/<id>/annotator.ts`. The registry in `agents/registry.ts`
 * pairs each agent's runner + primitive factory.
 *
 * Adding a new agent:
 *   1. Implement `AnnotatorPrimitive` in `agents/<id>/annotator.ts`.
 *   2. Implement `CliRunner` (from `../types`) in `agents/<id>/runner.ts`.
 *   3. Register both in `agents/registry.ts`.
 * No other dispatch site needs to change — every consumer goes
 * through `getRunnerAgent(id)`.
 */

import type { ForkProgress } from '../types';

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
  /** Raw model response. Annotator parses with `parseAnnotateBatch`. */
  rawText: string;
  /** Fork / turn id for cache invariants — null when CLI doesn't expose one. */
  forkSessionId: string | null;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  inputTokens: number;
  durationMs?: number;
  costUsd?: number;
}

/**
 * Per-CLI fork primitive used by the annotator.
 *
 * The annotator's outer loop is the same regardless of which CLI hosts
 * the source session: pick a batch of unfilled steps, ask the model to
 * tag them, merge the response back into the outline, repeat. The
 * cache-preserving fork mechanic differs per CLI:
 *
 *   - Claude: every batch spawns a fresh `claude --resume --fork-session`
 *     process. Cache lookup is implicit on the server side. Tools / MCP /
 *     slash commands are disabled so the model produces a single JSON
 *     turn and exits.
 *
 *   - Codex: a single `codex app-server` process is started for the
 *     whole annotation run. Each batch calls `thread/fork --ephemeral`
 *     to mint a fresh thread that shares the source's prefix.
 *     `turn/start` carries `outputSchema` so codex enforces the JSON
 *     shape on the model's behalf.
 *
 *   - Gemini: not viable. Gemini's prompt-serialize approach loses
 *     prefix bytes by construction, so the cache benefit doesn't
 *     apply. The registry returns null for gemini's annotator factory;
 *     `makeAnnotatorPrimitive` translates that into a descriptive error.
 */
export interface AnnotatorPrimitive {
  toolId: 'claude' | 'codex' | 'gemini';
  /** One-time setup before any batch runs. */
  prepare(): Promise<void>;
  forkAndAnnotate(input: AnnotateBatchInput): Promise<AnnotateBatchResult>;
  /** Always called in `finally`; must be idempotent. */
  shutdown(): Promise<void>;
}

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
