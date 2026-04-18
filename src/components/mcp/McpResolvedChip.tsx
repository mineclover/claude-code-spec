/**
 * McpResolvedChip
 *
 * Renders the resolved MCP composition for a session in one of two layouts:
 *
 * - `compact` (default): a small inline pill displaying `MCP: <hash-12>
 *   (N enabled)`. When the override delta is non-empty, a `±` indicator is
 *   appended. The native browser tooltip (`title`) lists the enabled servers
 *   and any override delta for quick inspection without expanding.
 *
 * - `detail`: a fuller breakdown listing the hash, the enabled server list,
 *   the baseline server list, and per-chip lists of added/removed servers.
 *
 * This component carries its own styles so the same chip can be dropped into
 * any host page without the host needing to expose MCP-specific CSS. The
 * compact variant draws the base badge look from its own module, matching
 * the look of sibling badges in session list rows.
 */
import type { SessionMetaView } from '../../types/prefix-fingerprint';
import styles from './McpResolvedChip.module.css';

type McpResolvedView = NonNullable<SessionMetaView['mcpResolved']>;

interface McpResolvedChipProps {
  mcp: McpResolvedView;
  variant?: 'compact' | 'detail';
}

/** Returns true when the session applied an add/remove override on top of
 * the baseline server list. */
function hasMcpOverride(mcp: McpResolvedView): boolean {
  return mcp.overrideAdd.length > 0 || mcp.overrideRemove.length > 0;
}

/** Plain-text tooltip for the compact MCP chip. Keeps lines compact so the
 * native browser tooltip stays readable. */
function formatMcpTitle(mcp: McpResolvedView): string {
  const lines: string[] = [
    `MCP resolved (hash: ${mcp.hash.substring(0, 16)})`,
    `Enabled (${mcp.enabledServerIds.length}): ${mcp.enabledServerIds.join(', ') || '(none)'}`,
  ];
  if (mcp.overrideAdd.length > 0) {
    lines.push(`Added by override: ${mcp.overrideAdd.join(', ')}`);
  }
  if (mcp.overrideRemove.length > 0) {
    lines.push(`Removed by override: ${mcp.overrideRemove.join(', ')}`);
  }
  return lines.join('\n');
}

export function McpResolvedChip({ mcp, variant = 'compact' }: McpResolvedChipProps) {
  if (variant === 'detail') {
    return <McpResolvedDetail mcp={mcp} />;
  }
  return <McpResolvedCompact mcp={mcp} />;
}

function McpResolvedCompact({ mcp }: { mcp: McpResolvedView }) {
  return (
    <span
      className={`${styles.badgeBase} ${styles.badgeMcp}`}
      title={formatMcpTitle(mcp)}
    >
      MCP: {mcp.hash.substring(0, 12)} ({mcp.enabledServerIds.length} enabled)
      {hasMcpOverride(mcp) && (
        <span
          className={styles.badgeMcpOverride}
          title="Override applied (add/remove delta non-empty)"
        >
          {' '}
          ±
        </span>
      )}
    </span>
  );
}

function McpResolvedDetail({ mcp }: { mcp: McpResolvedView }) {
  const override = hasMcpOverride(mcp);
  return (
    <div className={styles.mcpDetail}>
      <div className={styles.mcpDetailRow}>
        <span className={styles.mcpDetailLabel}>MCP hash</span>
        <span className={styles.mcpDetailHash} title={mcp.hash}>
          {mcp.hash.substring(0, 16)}
        </span>
        {override && (
          <span
            className={`${styles.badgeMcpOverride} ${styles.mcpDetailOverrideBadge}`}
            title="Session used an override (add/remove delta non-empty)"
          >
            override
          </span>
        )}
      </div>
      <div className={styles.mcpDetailRow}>
        <span className={styles.mcpDetailLabel}>Enabled</span>
        {mcp.enabledServerIds.length === 0 ? (
          <span className={styles.mcpDetailHash}>(none)</span>
        ) : (
          mcp.enabledServerIds.map((id) => (
            <span key={`en-${id}`} className={styles.mcpChip}>
              {id}
            </span>
          ))
        )}
      </div>
      <div className={styles.mcpDetailRow}>
        <span className={styles.mcpDetailLabel}>Baseline</span>
        {mcp.baselineServerIds.length === 0 ? (
          <span className={styles.mcpDetailHash}>(none)</span>
        ) : (
          mcp.baselineServerIds.map((id) => (
            <span key={`bl-${id}`} className={styles.mcpChip}>
              {id}
            </span>
          ))
        )}
      </div>
      {mcp.overrideAdd.length > 0 && (
        <div className={styles.mcpDetailRow}>
          <span className={styles.mcpDetailLabel}>Added</span>
          {mcp.overrideAdd.map((id) => (
            <span key={`add-${id}`} className={`${styles.mcpChip} ${styles.mcpChipAdded}`}>
              +{id}
            </span>
          ))}
        </div>
      )}
      {mcp.overrideRemove.length > 0 && (
        <div className={styles.mcpDetailRow}>
          <span className={styles.mcpDetailLabel}>Removed</span>
          {mcp.overrideRemove.map((id) => (
            <span key={`rm-${id}`} className={`${styles.mcpChip} ${styles.mcpChipRemoved}`}>
              -{id}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
