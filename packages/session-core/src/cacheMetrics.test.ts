import { describe, expect, it } from 'vitest';
import { aggregateCacheMetrics, emptyCacheMetrics, updateCacheMetrics } from './cacheMetrics';
import type { AssistantEvent, ResultEvent, StreamEvent } from '../types/stream-events';

function assistant(usage: AssistantEvent['message']['usage']): AssistantEvent {
  return {
    type: 'assistant',
    message: {
      id: 'm',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-4-7',
      content: [{ type: 'text', text: 'x' }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage,
    },
    parent_tool_use_id: null,
    session_id: 's',
    uuid: 'u',
  };
}

function result(usage: ResultEvent['usage'], modelUsage: ResultEvent['modelUsage'] = {}): ResultEvent {
  return {
    type: 'result',
    subtype: 'success',
    is_error: false,
    duration_ms: 1000,
    duration_api_ms: 900,
    num_turns: 1,
    result: 'done',
    session_id: 's',
    total_cost_usd: 0.123,
    usage,
    modelUsage,
    permission_denials: [],
    uuid: 'u',
  };
}

describe('cacheMetrics', () => {
  it('starts at zero', () => {
    const m = emptyCacheMetrics();
    expect(m.inputTokens).toBe(0);
    expect(m.cacheHitRatio).toBe(0);
  });

  it('sums assistant usages and recomputes hit ratio', () => {
    const m = emptyCacheMetrics();
    updateCacheMetrics(m, assistant({
      input_tokens: 100,
      cache_read_input_tokens: 400,
      cache_creation_input_tokens: 50,
      output_tokens: 20,
      service_tier: 'standard',
    }));
    updateCacheMetrics(m, assistant({
      input_tokens: 10,
      cache_read_input_tokens: 100,
      output_tokens: 5,
      service_tier: 'standard',
    }));
    expect(m.inputTokens).toBe(110);
    expect(m.cacheReadInputTokens).toBe(500);
    // 500 / (500 + 110) ≈ 0.8196
    expect(m.cacheHitRatio).toBeCloseTo(500 / 610, 3);
  });

  it('picks up contextWindow and cost from result event', () => {
    const m = aggregateCacheMetrics([
      assistant({
        input_tokens: 10,
        cache_read_input_tokens: 90,
        output_tokens: 5,
        service_tier: 'standard',
      }),
      result(
        {
          input_tokens: 10,
          cache_read_input_tokens: 90,
          output_tokens: 5,
          service_tier: 'standard',
        },
        {
          'claude-opus-4-7': {
            inputTokens: 10,
            outputTokens: 5,
            cacheReadInputTokens: 90,
            cacheCreationInputTokens: 0,
            webSearchRequests: 0,
            costUSD: 0.123,
            contextWindow: 200000,
          },
        },
      ),
    ]);
    expect(m.costUsd).toBeCloseTo(0.123, 5);
    expect(m.contextWindow).toBe(200000);
    expect(m.turns).toBe(1);
  });

  it('cache_creation ephemeral fields accumulate when present', () => {
    const m = emptyCacheMetrics();
    updateCacheMetrics(m, assistant({
      input_tokens: 1,
      output_tokens: 1,
      service_tier: 'standard',
      cache_creation: { ephemeral_5m_input_tokens: 42, ephemeral_1h_input_tokens: 7 },
    }));
    expect(m.ephemeral5mTokens).toBe(42);
    expect(m.ephemeral1hTokens).toBe(7);
  });

  it('ignores unrelated event types', () => {
    const m = emptyCacheMetrics();
    const other: StreamEvent = { type: 'user', message: { role: 'user', content: 'hi' } } as StreamEvent;
    updateCacheMetrics(m, other);
    expect(m.inputTokens).toBe(0);
  });
});
