import type { ProjectAggregate } from '@context-action/session-core';

interface Props {
  aggregate: ProjectAggregate;
  /** Optional CLI scope label, e.g. "claude" or "all". */
  scope?: string;
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Compact, read-only stat strip. Renders inline below the active session's
 * detail card so the user can see project-wide rollups (cache hit, cost,
 * prefix-group count) without leaving the focused view.
 */
export function AggregateStats({ aggregate, scope }: Props) {
  return (
    <div className="agg-stats inline">
      {scope && (
        <div className="agg-cell">
          <div className="agg-lbl">scope</div>
          <div className="agg-val">{scope}</div>
        </div>
      )}
      <div className="agg-cell">
        <div className="agg-lbl">sessions</div>
        <div className="agg-val">{aggregate.sessionCount}</div>
      </div>
      <div className="agg-cell">
        <div className="agg-lbl">prefix groups</div>
        <div className="agg-val">{aggregate.groupCount}</div>
      </div>
      <div className="agg-cell">
        <div className="agg-lbl">avg cache hit</div>
        <div className="agg-val accent">{fmtPct(aggregate.avgCacheHitRatio)}</div>
      </div>
      <div className="agg-cell">
        <div className="agg-lbl">total cost</div>
        <div className="agg-val">${aggregate.totalCostUsd.toFixed(3)}</div>
      </div>
    </div>
  );
}
