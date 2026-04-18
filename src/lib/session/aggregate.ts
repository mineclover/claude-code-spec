/**
 * Project-level aggregation over the per-session views produced by the
 * SessionAnalyticsService. All functions are pure: they consume the
 * `SessionMetaView` array surfaced to the renderer and return shapes that the
 * dashboard components render directly. No IO, no electron, no appSettings.
 *
 * The aggregate module exists so the renderer can show project-wide insight
 * (cache hit average, prefix-group count, MCP override effect) without
 * inflating the IPC surface — `getProjectSessionViews` already returns
 * everything we need.
 */

import type { SessionMetaView } from '../../types/prefix-fingerprint';

/** Project-wide rollup rendered above the session list. */
export interface ProjectAggregate {
  sessionCount: number;
  /** Distinct prefix-fingerprint hashes observed across the project. */
  groupCount: number;
  /** Token-weighted cache hit ratio across all sessions with observed tokens. */
  avgCacheHitRatio: number;
  totalCostUsd: number;
  sidecarCount: number;
  derivedCount: number;
}

/** Single point in a rolling-window trend series. */
export interface TrendPoint {
  /** Index of the point in the ordered series, 0-based. */
  bucketIndex: number;
  /** Number of sessions in this bucket. */
  count: number;
  /** Average value of the requested metric across the bucket. */
  value: number;
}

/** Comparison of one baseline group's runs split by override identity. */
export interface McpOverrideComparison {
  /** Hash of the sorted baseline server id list. */
  baselineHash: string;
  /** Sorted baseline server ids (echoed for display). */
  baselineServerIds: string[];
  /** Aggregates per distinct override (including the empty / unchanged one). */
  overrides: McpOverrideBucket[];
}

export interface McpOverrideBucket {
  /** Stable hash for this override identity within the baseline group. */
  overrideHash: string;
  /** Sorted ids added on top of the baseline. */
  overrideAdd: string[];
  /** Sorted ids removed from the baseline. */
  overrideRemove: string[];
  /** Number of sessions that ran with this exact override. */
  count: number;
  /** Token-weighted cache hit ratio across the bucket. */
  avgCacheHitRatio: number;
  /** Sum of cost across the bucket. */
  totalCostUsd: number;
}

const METRIC_KEYS = ['cacheHitRatio', 'costUsd'] as const;
export type TrendMetric = (typeof METRIC_KEYS)[number];

/**
 * Compute project-wide rollup. Sessions without observed tokens (i.e. the
 * cache-hit denominator is zero) are excluded from the average so dead/empty
 * runs don't drag the metric to zero.
 */
export function aggregateSessionMetas(views: SessionMetaView[]): ProjectAggregate {
  const groups = new Set<string>();
  let totalCostUsd = 0;
  let sidecarCount = 0;
  let derivedCount = 0;
  let weightedRatioSum = 0;
  let weightTotal = 0;

  for (const v of views) {
    if (v.fingerprintHash) groups.add(v.fingerprintHash);
    if (v.source === 'sidecar') sidecarCount += 1;
    else if (v.source === 'derived') derivedCount += 1;

    const m = v.metrics;
    totalCostUsd += m.costUsd;

    const denom = m.inputTokens + m.cacheReadInputTokens;
    if (denom > 0) {
      weightedRatioSum += m.cacheHitRatio * denom;
      weightTotal += denom;
    }
  }

  return {
    sessionCount: views.length,
    groupCount: groups.size,
    avgCacheHitRatio: weightTotal > 0 ? weightedRatioSum / weightTotal : 0,
    totalCostUsd,
    sidecarCount,
    derivedCount,
  };
}

/** Group views by their prefix-fingerprint hash. Skips empty hashes. */
export function groupByFingerprint(
  views: SessionMetaView[],
): Map<string, SessionMetaView[]> {
  const out = new Map<string, SessionMetaView[]>();
  for (const v of views) {
    if (!v.fingerprintHash) continue;
    const bucket = out.get(v.fingerprintHash);
    if (bucket) bucket.push(v);
    else out.set(v.fingerprintHash, [v]);
  }
  return out;
}

/**
 * Bucketed trend over the session list, in input order. The caller is
 * responsible for sorting by `computedAt` (or whatever timeline is meaningful)
 * before passing in. `windowSize` controls how many sessions are folded into
 * each bucket; default 5 keeps the sparkline readable without over-smoothing.
 */
export function trendByTime(
  views: SessionMetaView[],
  windowSize = 5,
  metric: TrendMetric = 'cacheHitRatio',
): TrendPoint[] {
  if (windowSize <= 0 || views.length === 0) return [];

  const points: TrendPoint[] = [];
  for (let i = 0; i < views.length; i += windowSize) {
    const slice = views.slice(i, i + windowSize);
    let sum = 0;
    let weight = 0;
    for (const v of slice) {
      const m = v.metrics;
      if (metric === 'cacheHitRatio') {
        const denom = m.inputTokens + m.cacheReadInputTokens;
        if (denom > 0) {
          sum += m.cacheHitRatio * denom;
          weight += denom;
        }
      } else {
        sum += m.costUsd;
        weight += 1;
      }
    }
    points.push({
      bucketIndex: points.length,
      count: slice.length,
      value: weight > 0 ? sum / weight : 0,
    });
  }
  return points;
}

/**
 * Group sidecar sessions by their resolved baseline server set, then within
 * each baseline split by override identity. Lets the UI answer "did adding X
 * to the baseline raise the cache hit ratio?" without server help.
 *
 * Derived sessions are skipped — they have no resolved MCP composition.
 */
export function compareMcpOverrides(views: SessionMetaView[]): McpOverrideComparison[] {
  type Acc = {
    baselineHash: string;
    baselineServerIds: string[];
    overrides: Map<string, McpOverrideBucket>;
  };
  const baselines = new Map<string, Acc>();

  for (const v of views) {
    const mcp = v.mcpResolved;
    if (!mcp) continue;
    const baselineSorted = [...mcp.baselineServerIds].sort();
    const baselineHash = baselineSorted.join('|');
    const addSorted = [...mcp.overrideAdd].sort();
    const removeSorted = [...mcp.overrideRemove].sort();
    const overrideHash = `+${addSorted.join(',')};-${removeSorted.join(',')}`;

    let acc = baselines.get(baselineHash);
    if (!acc) {
      acc = {
        baselineHash,
        baselineServerIds: baselineSorted,
        overrides: new Map(),
      };
      baselines.set(baselineHash, acc);
    }

    let bucket = acc.overrides.get(overrideHash);
    if (!bucket) {
      bucket = {
        overrideHash,
        overrideAdd: addSorted,
        overrideRemove: removeSorted,
        count: 0,
        avgCacheHitRatio: 0,
        totalCostUsd: 0,
      };
      acc.overrides.set(overrideHash, bucket);
    }

    const m = v.metrics;
    const denom = m.inputTokens + m.cacheReadInputTokens;
    // Re-derive avgCacheHitRatio incrementally as a token-weighted mean.
    // We accumulate the running numerator/denominator on the bucket using its
    // existing (count, avgCacheHitRatio) fields as storage, then finalize
    // after all sessions have been folded in.
    bucket.count += 1;
    bucket.totalCostUsd += m.costUsd;
    if (denom > 0) {
      // Stash sum-of-products in `avgCacheHitRatio` and sum-of-weights in a
      // private field via cast. Cleaner than a separate map for two scalars.
      const stash = bucket as unknown as {
        _sum: number;
        _weight: number;
        avgCacheHitRatio: number;
      };
      stash._sum = (stash._sum ?? 0) + m.cacheHitRatio * denom;
      stash._weight = (stash._weight ?? 0) + denom;
    }
  }

  // Finalize: convert stashed sum/weight to the published avgCacheHitRatio.
  const out: McpOverrideComparison[] = [];
  for (const acc of baselines.values()) {
    const overrides: McpOverrideBucket[] = [];
    for (const bucket of acc.overrides.values()) {
      const stash = bucket as unknown as { _sum?: number; _weight?: number };
      const avg = stash._weight && stash._weight > 0
        ? (stash._sum ?? 0) / stash._weight
        : 0;
      overrides.push({
        overrideHash: bucket.overrideHash,
        overrideAdd: bucket.overrideAdd,
        overrideRemove: bucket.overrideRemove,
        count: bucket.count,
        avgCacheHitRatio: avg,
        totalCostUsd: bucket.totalCostUsd,
      });
    }
    overrides.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.overrideHash.localeCompare(b.overrideHash);
    });
    out.push({
      baselineHash: acc.baselineHash,
      baselineServerIds: acc.baselineServerIds,
      overrides,
    });
  }
  out.sort((a, b) => a.baselineHash.localeCompare(b.baselineHash));
  return out;
}
