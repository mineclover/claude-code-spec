/**
 * ScopeBadge — renders an MCP registry entry's scope (user or project) as a
 * styled pill. Used across the Registry, Policy, and Compose surfaces.
 */

import type { McpEntryScope } from '../../types/api/mcp';
import styles from './McpBadges.module.css';

interface ScopeBadgeProps {
  scope: McpEntryScope;
}

export function ScopeBadge({ scope }: ScopeBadgeProps) {
  const variant = scope === 'user' ? styles.scopeUser : styles.scopeProject;
  return <span className={`${styles.base} ${variant}`}>{scope}</span>;
}
