/**
 * TrendSparkline
 *
 * Pure CSS bar chart of a rolling-window trend. No chart library dependency:
 * each bucket is a flex child whose height is set inline based on its value
 * relative to the maximum in the series.
 */

import type React from 'react';
import type { TrendMetric, TrendPoint } from '../../lib/session/aggregate';
import styles from './TrendSparkline.module.css';

interface TrendSparklineProps {
  points: TrendPoint[];
  metric: TrendMetric;
  /** Optional title shown above the bars. */
  label?: string;
}

function formatValue(value: number, metric: TrendMetric): string {
  if (metric === 'cacheHitRatio') return `${Math.round(value * 100)}%`;
  if (value === 0) return '$0';
  if (value < 0.01) return '<$0.01';
  return `$${value.toFixed(value < 1 ? 3 : 2)}`;
}

export function TrendSparkline({
  points,
  metric,
  label,
}: TrendSparklineProps): React.JSX.Element {
  const max = points.reduce((m, p) => (p.value > m ? p.value : m), 0);
  const heading =
    label ??
    (metric === 'cacheHitRatio' ? 'Cache hit trend' : 'Cost trend');

  if (points.length === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <span className={styles.title}>{heading}</span>
          <span className={styles.empty}>no data</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.title}>{heading}</span>
        <span className={styles.meta}>
          {points.length} {points.length === 1 ? 'bucket' : 'buckets'}
        </span>
      </div>
      <div className={styles.bars}>
        {points.map((p) => {
          const heightPct = max > 0 ? Math.max(4, Math.round((p.value / max) * 100)) : 4;
          return (
            <div
              key={p.bucketIndex}
              className={styles.barColumn}
              title={`Bucket ${p.bucketIndex + 1} · ${p.count} sessions · ${formatValue(p.value, metric)}`}
            >
              <div className={styles.bar} style={{ height: `${heightPct}%` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
