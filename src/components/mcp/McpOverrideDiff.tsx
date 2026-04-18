/**
 * McpOverrideDiff
 *
 * Side-by-side rendering of the policy baseline vs. the user's current MCP
 * selection. Each id is shown once on each side, dimmed when missing, with an
 * `add` / `remove` badge indicating the direction of the change. Pure
 * presentational — the parent panel computes the lists.
 */

import type React from 'react';
import styles from './McpOverrideDiff.module.css';
import { OverrideBadge } from './OverrideBadge';

interface McpOverrideDiffProps {
  baseline: readonly string[];
  current: readonly string[];
}

export function McpOverrideDiff({
  baseline,
  current,
}: McpOverrideDiffProps): React.JSX.Element {
  const baselineSet = new Set(baseline);
  const currentSet = new Set(current);
  // Stable union, sorted alphabetically so the diff order is predictable.
  const union = Array.from(new Set([...baseline, ...current])).sort();

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.heading}>Baseline</span>
        <span className={styles.heading}>Current</span>
      </div>
      {union.map((id) => {
        const inBaseline = baselineSet.has(id);
        const inCurrent = currentSet.has(id);
        const status: 'unchanged' | 'added' | 'removed' = !inBaseline
          ? 'added'
          : !inCurrent
            ? 'removed'
            : 'unchanged';
        return (
          <div key={id} className={`${styles.row} ${styles[`row_${status}`]}`}>
            <Cell active={inBaseline} id={id} />
            <Cell active={inCurrent} id={id} />
            <div className={styles.badgeCol}>
              {status === 'added' && <OverrideBadge kind="added">+add</OverrideBadge>}
              {status === 'removed' && (
                <OverrideBadge kind="removed">−remove</OverrideBadge>
              )}
            </div>
          </div>
        );
      })}
      {union.length === 0 && (
        <div className={styles.empty}>No MCP servers selected on either side.</div>
      )}
    </div>
  );
}

function Cell({ active, id }: { active: boolean; id: string }): React.JSX.Element {
  return (
    <code className={`${styles.cell} ${active ? '' : styles.cellMuted}`}>
      {active ? id : '—'}
    </code>
  );
}
