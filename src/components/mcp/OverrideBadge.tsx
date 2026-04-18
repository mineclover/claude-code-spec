/**
 * OverrideBadge — renders the relationship between an MCP server's current
 * selection state and the policy baseline: "baseline" (in baseline, enabled),
 * "+add" (not in baseline, enabled by override), or "−remove" (in baseline,
 * disabled by override). Used by McpComposePanel.
 */

import type { ReactNode } from 'react';
import styles from './McpBadges.module.css';

export type OverrideBadgeKind = 'baseline' | 'added' | 'removed';

interface OverrideBadgeProps {
  kind: OverrideBadgeKind;
  children: ReactNode;
}

export function OverrideBadge({ kind, children }: OverrideBadgeProps) {
  return <span className={`${styles.base} ${styles[kind]}`}>{children}</span>;
}
