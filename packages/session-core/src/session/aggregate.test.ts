import { describe, expect, it } from 'vitest';
import type { CacheMetrics, SessionMetaView } from '../../types/prefix-fingerprint';
import {
  aggregateSessionMetas,
  compareMcpOverrides,
  groupByFingerprint,
  trendByTime,
} from './aggregate';

const emptyMetrics: CacheMetrics = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
  ephemeral5mTokens: 0,
  ephemeral1hTokens: 0,
  cacheHitRatio: 0,
  costUsd: 0,
};

function metrics(overrides: Partial<CacheMetrics>): CacheMetrics {
  return { ...emptyMetrics, ...overrides };
}

function view(overrides: Partial<SessionMetaView> = {}): SessionMetaView {
  return {
    source: overrides.source ?? 'sidecar',
    sessionId: overrides.sessionId ?? 'sess-1',
    fingerprintHash: overrides.fingerprintHash ?? 'fp-a',
    metrics: overrides.metrics ?? emptyMetrics,
    drift: overrides.drift,
    model: overrides.model,
    toolCount: overrides.toolCount,
    mcpResolved: overrides.mcpResolved,
  };
}

describe('aggregateSessionMetas', () => {
  it('returns zeroes for an empty input', () => {
    const agg = aggregateSessionMetas([]);
    expect(agg).toEqual({
      sessionCount: 0,
      groupCount: 0,
      avgCacheHitRatio: 0,
      totalCostUsd: 0,
      sidecarCount: 0,
      derivedCount: 0,
    });
  });

  it('counts sidecar/derived split and unique fingerprint groups', () => {
    const agg = aggregateSessionMetas([
      view({ sessionId: 's1', fingerprintHash: 'fp-a', source: 'sidecar' }),
      view({ sessionId: 's2', fingerprintHash: 'fp-a', source: 'derived' }),
      view({ sessionId: 's3', fingerprintHash: 'fp-b', source: 'sidecar' }),
      view({ sessionId: 's4', fingerprintHash: '', source: 'derived' }),
    ]);
    expect(agg.sessionCount).toBe(4);
    expect(agg.groupCount).toBe(2);
    expect(agg.sidecarCount).toBe(2);
    expect(agg.derivedCount).toBe(2);
  });

  it('weights cache hit ratio by token denominator', () => {
    // Session A: 1000 input + 1000 cacheRead → hit 0.5, denom 2000
    // Session B: 100 input + 900 cacheRead → hit 0.9, denom 1000
    // Weighted: (0.5*2000 + 0.9*1000) / 3000 = 1900/3000 ≈ 0.633
    const agg = aggregateSessionMetas([
      view({
        sessionId: 'sA',
        metrics: metrics({
          inputTokens: 1000,
          cacheReadInputTokens: 1000,
          cacheHitRatio: 0.5,
          costUsd: 0.1,
        }),
      }),
      view({
        sessionId: 'sB',
        metrics: metrics({
          inputTokens: 100,
          cacheReadInputTokens: 900,
          cacheHitRatio: 0.9,
          costUsd: 0.05,
        }),
      }),
    ]);
    expect(agg.avgCacheHitRatio).toBeCloseTo(1900 / 3000, 6);
    expect(agg.totalCostUsd).toBeCloseTo(0.15, 6);
  });

  it('excludes sessions with no observed tokens from the average', () => {
    const agg = aggregateSessionMetas([
      view({ sessionId: 's1', metrics: emptyMetrics }),
      view({
        sessionId: 's2',
        metrics: metrics({ inputTokens: 100, cacheHitRatio: 0.4 }),
      }),
    ]);
    expect(agg.avgCacheHitRatio).toBeCloseTo(0.4, 6);
  });
});

describe('groupByFingerprint', () => {
  it('groups views by hash and skips empty hashes', () => {
    const result = groupByFingerprint([
      view({ sessionId: 's1', fingerprintHash: 'fp-a' }),
      view({ sessionId: 's2', fingerprintHash: 'fp-a' }),
      view({ sessionId: 's3', fingerprintHash: 'fp-b' }),
      view({ sessionId: 's4', fingerprintHash: '' }),
    ]);
    expect(result.size).toBe(2);
    expect(result.get('fp-a')?.map((v) => v.sessionId)).toEqual(['s1', 's2']);
    expect(result.get('fp-b')?.map((v) => v.sessionId)).toEqual(['s3']);
  });
});

describe('trendByTime', () => {
  it('returns an empty array for empty input', () => {
    expect(trendByTime([])).toEqual([]);
  });

  it('returns an empty array for non-positive window size', () => {
    expect(trendByTime([view()], 0)).toEqual([]);
  });

  it('buckets by window size and weights cache hit ratio by tokens', () => {
    const points = trendByTime(
      [
        view({
          sessionId: 's1',
          metrics: metrics({ inputTokens: 100, cacheHitRatio: 0.2 }),
        }),
        view({
          sessionId: 's2',
          metrics: metrics({ inputTokens: 100, cacheHitRatio: 0.8 }),
        }),
        view({
          sessionId: 's3',
          metrics: metrics({ inputTokens: 100, cacheHitRatio: 0.5 }),
        }),
      ],
      2,
    );
    expect(points).toHaveLength(2);
    expect(points[0].count).toBe(2);
    expect(points[0].value).toBeCloseTo(0.5, 6);
    expect(points[1].count).toBe(1);
    expect(points[1].value).toBeCloseTo(0.5, 6);
  });

  it('reports cost as a per-bucket mean when metric=costUsd', () => {
    const points = trendByTime(
      [
        view({ sessionId: 's1', metrics: metrics({ costUsd: 0.1 }) }),
        view({ sessionId: 's2', metrics: metrics({ costUsd: 0.3 }) }),
      ],
      2,
      'costUsd',
    );
    expect(points).toHaveLength(1);
    expect(points[0].value).toBeCloseTo(0.2, 6);
  });
});

describe('compareMcpOverrides', () => {
  it('returns an empty list when no sidecar mcpResolved exists', () => {
    expect(compareMcpOverrides([view({ mcpResolved: undefined })])).toEqual([]);
  });

  it('groups by baseline and within baseline by override identity', () => {
    const baselineA = ['serenA', 'context7'];
    const baselineB = ['serenA'];

    const result = compareMcpOverrides([
      view({
        sessionId: 'a1',
        mcpResolved: {
          enabledServerIds: baselineA,
          hash: 'h1',
          baselineServerIds: baselineA,
          overrideAdd: [],
          overrideRemove: [],
        },
        metrics: metrics({ inputTokens: 100, cacheHitRatio: 0.4, costUsd: 0.05 }),
      }),
      view({
        sessionId: 'a2',
        mcpResolved: {
          enabledServerIds: [...baselineA, 'extra'],
          hash: 'h2',
          baselineServerIds: baselineA,
          overrideAdd: ['extra'],
          overrideRemove: [],
        },
        metrics: metrics({ inputTokens: 100, cacheHitRatio: 0.7, costUsd: 0.07 }),
      }),
      view({
        sessionId: 'a3',
        mcpResolved: {
          enabledServerIds: [...baselineA, 'extra'],
          hash: 'h2',
          baselineServerIds: baselineA,
          overrideAdd: ['extra'],
          overrideRemove: [],
        },
        metrics: metrics({ inputTokens: 100, cacheHitRatio: 0.9, costUsd: 0.04 }),
      }),
      view({
        sessionId: 'b1',
        mcpResolved: {
          enabledServerIds: baselineB,
          hash: 'h3',
          baselineServerIds: baselineB,
          overrideAdd: [],
          overrideRemove: [],
        },
        metrics: metrics({ inputTokens: 50, cacheHitRatio: 0.3, costUsd: 0.02 }),
      }),
    ]);

    expect(result).toHaveLength(2);
    const grouped = new Map(result.map((r) => [r.baselineHash, r]));
    const a = grouped.get([...baselineA].sort().join('|'));
    const b = grouped.get([...baselineB].sort().join('|'));
    expect(a).toBeDefined();
    expect(b).toBeDefined();

    // Baseline A: two override identities — empty (count 1) and +extra (count 2).
    expect(a?.overrides).toHaveLength(2);
    const aPlusExtra = a?.overrides.find((o) => o.overrideAdd.includes('extra'));
    expect(aPlusExtra?.count).toBe(2);
    // Token-weighted mean of 0.7 and 0.9 with equal token weight = 0.8.
    expect(aPlusExtra?.avgCacheHitRatio).toBeCloseTo(0.8, 6);
    expect(aPlusExtra?.totalCostUsd).toBeCloseTo(0.11, 6);

    const aBaseline = a?.overrides.find((o) => o.overrideAdd.length === 0);
    expect(aBaseline?.count).toBe(1);
    expect(aBaseline?.avgCacheHitRatio).toBeCloseTo(0.4, 6);

    expect(b?.overrides).toHaveLength(1);
    expect(b?.overrides[0].count).toBe(1);
    expect(b?.overrides[0].avgCacheHitRatio).toBeCloseTo(0.3, 6);
  });

  it('treats baselines as set-equal regardless of original ordering', () => {
    const result = compareMcpOverrides([
      view({
        sessionId: 's1',
        mcpResolved: {
          enabledServerIds: ['a', 'b'],
          hash: 'h',
          baselineServerIds: ['b', 'a'],
          overrideAdd: [],
          overrideRemove: [],
        },
        metrics: metrics({ inputTokens: 10, cacheHitRatio: 0.5 }),
      }),
      view({
        sessionId: 's2',
        mcpResolved: {
          enabledServerIds: ['a', 'b'],
          hash: 'h',
          baselineServerIds: ['a', 'b'],
          overrideAdd: [],
          overrideRemove: [],
        },
        metrics: metrics({ inputTokens: 10, cacheHitRatio: 0.5 }),
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].overrides).toHaveLength(1);
    expect(result[0].overrides[0].count).toBe(2);
  });
});
