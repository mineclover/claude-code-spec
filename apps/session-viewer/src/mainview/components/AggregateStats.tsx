import type { ProjectAggregate } from '@context-action/session-core';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  return (
    <div className="agg-stats inline">
      {scope && (
        <div className="agg-cell">
          <div className="agg-lbl">{t('stats.scope')}</div>
          <div className="agg-val">{scope}</div>
        </div>
      )}
      <div className="agg-cell">
        <div className="agg-lbl">{t('stats.sessions')}</div>
        <div className="agg-val">{aggregate.sessionCount}</div>
      </div>
      <div className="agg-cell">
        <div className="agg-lbl">{t('stats.prefixGroups')}</div>
        <div className="agg-val">{aggregate.groupCount}</div>
      </div>
      <div className="agg-cell">
        <div className="agg-lbl">{t('stats.avgCacheHit')}</div>
        <div className="agg-val accent">{fmtPct(aggregate.avgCacheHitRatio)}</div>
      </div>
      <div className="agg-cell">
        <div className="agg-lbl">{t('stats.totalCost')}</div>
        <div className="agg-val">${aggregate.totalCostUsd.toFixed(3)}</div>
      </div>
    </div>
  );
}
