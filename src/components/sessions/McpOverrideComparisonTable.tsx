/**
 * McpOverrideComparisonTable
 *
 * Renders the per-baseline override comparison produced by
 * `compareMcpOverrides`. For each baseline server set, lists all observed
 * override identities with their session count, weighted cache-hit ratio,
 * and accumulated cost. Lets a user spot whether a particular `+server` /
 * `-server` change actually moved the cache hit metric.
 */

import type React from 'react';
import type { McpOverrideComparison } from '../../lib/session/aggregate';
import styles from './McpOverrideComparisonTable.module.css';

interface McpOverrideComparisonTableProps {
  comparisons: McpOverrideComparison[];
}

function formatRatio(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.01) return '<$0.01';
  return `$${usd.toFixed(usd < 1 ? 3 : 2)}`;
}

function formatBaselineLabel(ids: string[]): string {
  if (ids.length === 0) return '(no MCP)';
  return ids.join(', ');
}

function formatOverrideLabel(add: string[], remove: string[]): string {
  if (add.length === 0 && remove.length === 0) return 'baseline';
  const segs: string[] = [];
  if (add.length > 0) segs.push(`+${add.join(',')}`);
  if (remove.length > 0) segs.push(`-${remove.join(',')}`);
  return segs.join(' ');
}

export function McpOverrideComparisonTable({
  comparisons,
}: McpOverrideComparisonTableProps): React.JSX.Element | null {
  if (comparisons.length === 0) return null;
  return (
    <div className={styles.wrapper}>
      <div className={styles.title}>MCP override effect</div>
      {comparisons.map((c) => (
        <div key={c.baselineHash} className={styles.group}>
          <div className={styles.baseline} title={c.baselineServerIds.join(', ')}>
            <span className={styles.baselineLabel}>baseline:</span>{' '}
            <span className={styles.baselineValue}>
              {formatBaselineLabel(c.baselineServerIds)}
            </span>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Override</th>
                <th>Sessions</th>
                <th>Cache</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {c.overrides.map((o) => (
                <tr key={o.overrideHash}>
                  <td className={styles.override}>
                    {formatOverrideLabel(o.overrideAdd, o.overrideRemove)}
                  </td>
                  <td className={styles.numeric}>{o.count}</td>
                  <td className={styles.numeric}>{formatRatio(o.avgCacheHitRatio)}</td>
                  <td className={styles.numeric}>{formatCost(o.totalCostUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
