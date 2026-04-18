/**
 * Cache-metrics aggregation over Claude CLI stream events.
 *
 * The CLI emits token / cost figures in two places:
 *   - `assistant.message.usage` on every assistant turn
 *   - `result.usage` (+ per-model `modelUsage`) once at the end
 *
 * Both of these are already validated by StreamParser (see src/lib/StreamParser.ts).
 * This module layers a pure reducer on top so that a running total can be kept
 * on ExecutionInfo while the process streams, and a final snapshot materialized
 * when it completes.
 *
 * Design points:
 *   - The reducer is incremental and commutative-safe for the fields it sums,
 *     so it can be called once per arriving event without re-processing history.
 *   - `result.usage` is authoritative when present; we keep the max of per-field
 *     running totals vs the final result. CLI semantics currently match summed
 *     assistant usages, but treating result as a floor lets us absorb future
 *     drift without silently under-reporting.
 *   - `contextWindow` lives only in `result.modelUsage[].contextWindow`; we
 *     track the highest observed value.
 */

import type { CacheMetrics } from '../types/prefix-fingerprint';
import {
  type AssistantEvent,
  isAssistantEvent,
  isResultEvent,
  type ResultEvent,
  type StreamEvent,
} from '../types/stream-events';

export function emptyCacheMetrics(): CacheMetrics {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    ephemeral5mTokens: 0,
    ephemeral1hTokens: 0,
    cacheHitRatio: 0,
    costUsd: 0,
  };
}

function computeHitRatio(cacheRead: number, input: number): number {
  const denom = cacheRead + input;
  if (denom <= 0) return 0;
  const ratio = cacheRead / denom;
  return ratio < 0 ? 0 : ratio > 1 ? 1 : ratio;
}

function applyAssistant(metrics: CacheMetrics, event: AssistantEvent): void {
  const usage = event.message.usage;
  metrics.inputTokens += usage.input_tokens ?? 0;
  metrics.outputTokens += usage.output_tokens ?? 0;
  metrics.cacheReadInputTokens += usage.cache_read_input_tokens ?? 0;
  metrics.cacheCreationInputTokens += usage.cache_creation_input_tokens ?? 0;
  if (usage.cache_creation) {
    metrics.ephemeral5mTokens += usage.cache_creation.ephemeral_5m_input_tokens ?? 0;
    metrics.ephemeral1hTokens += usage.cache_creation.ephemeral_1h_input_tokens ?? 0;
  }
}

function applyResult(metrics: CacheMetrics, event: ResultEvent): void {
  const usage = event.usage;

  // Floor running totals with the authoritative result usage. If assistant
  // events already out-summed result (unusual), keep the larger value.
  metrics.inputTokens = Math.max(metrics.inputTokens, usage.input_tokens ?? 0);
  metrics.outputTokens = Math.max(metrics.outputTokens, usage.output_tokens ?? 0);
  metrics.cacheReadInputTokens = Math.max(
    metrics.cacheReadInputTokens,
    usage.cache_read_input_tokens ?? 0,
  );
  metrics.cacheCreationInputTokens = Math.max(
    metrics.cacheCreationInputTokens,
    usage.cache_creation_input_tokens ?? 0,
  );

  if (usage.cache_creation) {
    metrics.ephemeral5mTokens = Math.max(
      metrics.ephemeral5mTokens,
      usage.cache_creation.ephemeral_5m_input_tokens ?? 0,
    );
    metrics.ephemeral1hTokens = Math.max(
      metrics.ephemeral1hTokens,
      usage.cache_creation.ephemeral_1h_input_tokens ?? 0,
    );
  }

  metrics.costUsd = event.total_cost_usd ?? metrics.costUsd;
  metrics.turns = event.num_turns;
  metrics.durationMs = event.duration_ms;

  let maxContextWindow = metrics.contextWindow ?? 0;
  for (const entry of Object.values(event.modelUsage ?? {})) {
    if (typeof entry.contextWindow === 'number' && entry.contextWindow > maxContextWindow) {
      maxContextWindow = entry.contextWindow;
    }
  }
  if (maxContextWindow > 0) {
    metrics.contextWindow = maxContextWindow;
  }
}

/**
 * Incrementally update metrics for a single streamed event. Returns the same
 * object for chaining; mutation is intentional so MultiCliExecutionService can
 * hold a single CacheMetrics on ExecutionInfo and update it in place.
 */
export function updateCacheMetrics(metrics: CacheMetrics, event: StreamEvent): CacheMetrics {
  if (isAssistantEvent(event)) {
    applyAssistant(metrics, event);
  } else if (isResultEvent(event)) {
    applyResult(metrics, event);
  }
  metrics.cacheHitRatio = computeHitRatio(metrics.cacheReadInputTokens, metrics.inputTokens);
  return metrics;
}

/** Full reduction over a finished session's events. */
export function aggregateCacheMetrics(events: StreamEvent[]): CacheMetrics {
  const metrics = emptyCacheMetrics();
  for (const event of events) {
    updateCacheMetrics(metrics, event);
  }
  return metrics;
}
