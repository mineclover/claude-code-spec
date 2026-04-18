/**
 * ProjectSummaryCard
 *
 * A horizontal row of stat tiles summarizing the currently selected project's
 * sessions. Pure presentational; consumes the aggregate produced by
 * `aggregateSessionMetas`.
 */

import type React from 'react';
import type { ProjectAggregate } from '../../lib/session/aggregate';
import styles from './ProjectSummaryCard.module.css';

interface ProjectSummaryCardProps {
  aggregate: ProjectAggregate;
}

function formatRatio(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.01) return `<$0.01`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function ProjectSummaryCard({ aggregate }: ProjectSummaryCardProps): React.JSX.Element {
  const { sessionCount, groupCount, avgCacheHitRatio, totalCostUsd, sidecarCount, derivedCount } =
    aggregate;
  return (
    <div className={styles.card}>
      <Tile label="Sessions" value={String(sessionCount)} />
      <Tile
        label="Groups"
        value={String(groupCount)}
        title="Distinct prefix-fingerprint groups (cache-eligible cohorts)"
      />
      <Tile
        label="Avg Cache"
        value={formatRatio(avgCacheHitRatio)}
        title="Token-weighted cache hit ratio across sessions with observed tokens"
      />
      <Tile
        label="Cost"
        value={formatCost(totalCostUsd)}
        title="Sum of session-reported USD cost"
      />
      <Tile
        label="Sidecar / Derived"
        value={`${sidecarCount} / ${derivedCount}`}
        title="High-fidelity sidecar metas vs. JSONL-derived metas"
      />
    </div>
  );
}

function Tile({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}): React.JSX.Element {
  return (
    <div className={styles.tile} title={title}>
      <div className={styles.tileLabel}>{label}</div>
      <div className={styles.tileValue}>{value}</div>
    </div>
  );
}
