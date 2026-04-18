/**
 * MCP Policy Page — edit the project policy (<project>/.claude/mcp-policy.json).
 *
 * Policy has three lists:
 *   - defaultEnabled: servers turned on when no execution override is supplied
 *   - allowed:        non-empty → whitelist (ids not in this list are rejected)
 *   - forbidden:      blacklist (always rejected regardless of other settings)
 *
 * Precedence (server side, enforced by McpResolverService):
 *   forbidden > allowed > defaultEnabled
 *
 * This page presents the merged registry (user + project) and lets the user
 * toggle each id's membership in the three lists. A live preview of the
 * baseline + hash is shown so changes can be evaluated before saving.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CategoryFilter } from '../components/mcp/CategoryFilter';
import { CategoryGroupedList } from '../components/mcp/CategoryGroupedList';
import { McpBanner } from '../components/mcp/McpBanner';
import { ScopeBadge } from '../components/mcp/ScopeBadge';
import { useProject } from '../contexts/ProjectContext';
import { filterEntries } from '../lib/mcp/filter';
import { groupByCategory } from '../lib/mcp/grouping';
import type { McpResolveResult } from '../types/api/mcp';
import {
  DEFAULT_MCP_POLICY,
  type McpPolicyFile,
  type McpRegistryEntry,
  type ResolvedRegistry,
} from '../types/mcp-policy';
import styles from './McpPolicyPage.module.css';

const POLICY_BANNER_PROPS = {
  variant: 'new' as const,
  linkTo: '/',
  linkLabel: 'Go to Execute →',
  text: 'New Registry/Policy/Override model. Override per-run via the Compose panel on Execute.',
};

type ListKey = 'defaultEnabled' | 'allowed' | 'forbidden';

function togglePolicy(policy: McpPolicyFile, list: ListKey, id: string): McpPolicyFile {
  const current = new Set(policy[list]);
  if (current.has(id)) current.delete(id);
  else current.add(id);
  return { ...policy, [list]: Array.from(current).sort() };
}

export function McpPolicyPage() {
  const { projectPath } = useProject();
  const [registry, setRegistry] = useState<ResolvedRegistry | null>(null);
  const [policy, setPolicy] = useState<McpPolicyFile>({ ...DEFAULT_MCP_POLICY });
  const [saved, setSaved] = useState<McpPolicyFile>({ ...DEFAULT_MCP_POLICY });
  const [preview, setPreview] = useState<McpResolveResult | null>(null);
  const [query, setQuery] = useState('');

  const loadAll = useCallback(async () => {
    if (!projectPath) return;
    try {
      const [registryResult, policyResult] = await Promise.all([
        window.mcpAPI.getRegistry(projectPath),
        window.mcpAPI.getPolicy(projectPath),
      ]);
      setRegistry(registryResult);
      setPolicy(policyResult);
      setSaved(policyResult);
    } catch (error) {
      toast.error(`Failed to load policy: ${error instanceof Error ? error.message : ''}`);
    }
  }, [projectPath]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Live preview: resolve the current (unsaved) policy against the registry.
  // This doesn't save anything; it just shows the baseline and hash so the
  // user can see what the defaults will produce.
  useEffect(() => {
    if (!projectPath) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await window.mcpAPI.resolve({ projectPath });
        if (!cancelled) setPreview(result);
      } catch {
        if (!cancelled) setPreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectPath, saved]);

  const filteredEntries = useMemo(
    () => (registry ? filterEntries(registry.entries, query) : []),
    [registry, query],
  );
  const grouped = useMemo(
    () => groupByCategory(filteredEntries),
    [filteredEntries],
  );
  const totalCount = registry?.entries.length ?? 0;
  const matchedCount = filteredEntries.length;

  const isDirty = useMemo(() => {
    const same = (a: readonly string[], b: readonly string[]) => {
      if (a.length !== b.length) return false;
      const sa = [...a].sort();
      const sb = [...b].sort();
      return sa.every((v, i) => v === sb[i]);
    };
    return (
      !same(policy.defaultEnabled, saved.defaultEnabled) ||
      !same(policy.allowed, saved.allowed) ||
      !same(policy.forbidden, saved.forbidden)
    );
  }, [policy, saved]);

  const handleSave = async () => {
    if (!projectPath) return;
    const res = await window.mcpAPI.savePolicy(projectPath, policy);
    if (!res.success) {
      toast.error(res.error ?? 'Save failed');
      return;
    }
    toast.success('Policy saved');
    setSaved(policy);
  };

  const handleRevert = () => setPolicy(saved);

  if (!projectPath) {
    return (
      <div className={styles.container}>
        <McpBanner {...POLICY_BANNER_PROPS} />
        <div className={styles.empty}>
          <p>Select a project to edit its MCP policy.</p>
        </div>
      </div>
    );
  }

  const allowlistActive = policy.allowed.length > 0;

  return (
    <div className={styles.container}>
      <McpBanner {...POLICY_BANNER_PROPS} />
      <header className={styles.header}>
        <h2>MCP Policy</h2>
        <p className={styles.path}>
          {projectPath}/.claude/mcp-policy.json
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty}
            className={styles.saveButton}
          >
            Save
          </button>
          <button type="button" onClick={handleRevert} disabled={!isDirty}>
            Revert
          </button>
        </div>
      </header>

      <section className={styles.previewPanel}>
        <h3>Baseline preview</h3>
        {preview ? (
          <>
            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>enabled</span>
              <code>
                {preview.resolved.enabledServerIds.length > 0
                  ? preview.resolved.enabledServerIds.join(', ')
                  : '(none)'}
              </code>
            </div>
            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>hash</span>
              <code className={styles.hash}>{preview.resolved.hash.slice(0, 16)}</code>
            </div>
            {preview.resolved.disallowed.length > 0 && (
              <div className={styles.previewRow}>
                <span className={styles.previewLabel}>disallowed</span>
                <code>
                  {preview.resolved.disallowed
                    .map((d) => `${d.id} (${d.reason})`)
                    .join(', ')}
                </code>
              </div>
            )}
            <p className={styles.previewNote}>
              Preview reflects the saved policy. Save changes to refresh.
            </p>
          </>
        ) : (
          <p className={styles.previewNote}>No preview available.</p>
        )}
      </section>

      <section className={styles.matrix}>
        <CategoryFilter
          query={query}
          onQueryChange={setQuery}
          resultLabel={
            query.length > 0 ? `${matchedCount} / ${totalCount}` : undefined
          }
        />
        <div className={styles.matrixHeader}>
          <span className={styles.idCol}>id</span>
          <span>default</span>
          <span>
            allowed{' '}
            <small className={styles.hint}>
              {allowlistActive ? '(whitelist active)' : '(empty = all)'}
            </small>
          </span>
          <span>forbidden</span>
        </div>
        <CategoryGroupedList<McpRegistryEntry>
          groups={grouped}
          groupClassName={styles.matrixGroup}
          renderHeader={(category) => (
            <h4 className={styles.matrixGroupHeader}>{category}</h4>
          )}
          emptyMessage={
            <p className={styles.empty}>
              Registry is empty — add entries on the Registry page.
            </p>
          }
          renderItem={(entry) => {
            const defaultChecked = policy.defaultEnabled.includes(entry.id);
            const allowedChecked = policy.allowed.includes(entry.id);
            const forbiddenChecked = policy.forbidden.includes(entry.id);
            return (
              <div className={styles.row}>
                <span className={styles.idCol}>
                  <code>{entry.id}</code>
                  <ScopeBadge scope={entry.scope} />
                </span>
                <input
                  type="checkbox"
                  checked={defaultChecked}
                  onChange={() => setPolicy(togglePolicy(policy, 'defaultEnabled', entry.id))}
                />
                <input
                  type="checkbox"
                  checked={allowedChecked}
                  onChange={() => setPolicy(togglePolicy(policy, 'allowed', entry.id))}
                />
                <input
                  type="checkbox"
                  checked={forbiddenChecked}
                  onChange={() => setPolicy(togglePolicy(policy, 'forbidden', entry.id))}
                />
              </div>
            );
          }}
        />
      </section>
    </div>
  );
}
