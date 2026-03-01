/**
 * Active Hooks Page
 * Shows hooks configured in ~/.claude/settings.json (user) and
 * <project>/.claude/settings.json (project)
 */

import { useCallback, useEffect, useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import type { ActiveHookItem, ActiveHooksResult, HookScope } from '../types/active-hooks';
import styles from './ActiveHooksPage.module.css';

const EVENT_COLORS: Record<string, string> = {
  PreToolUse: 'eventPre',
  PostToolUse: 'eventPost',
  Stop: 'eventStop',
  Notification: 'eventNotify',
  SubagentStop: 'eventSubagent',
};

function HookRow({ hook }: { hook: ActiveHookItem }) {
  const colorClass = EVENT_COLORS[hook.event] ?? 'eventPre';
  return (
    <div className={styles.hookRow}>
      <div className={styles.hookMeta}>
        <span className={`${styles.eventBadge} ${styles[colorClass]}`}>{hook.event}</span>
        {hook.matcher && (
          <span className={styles.matcherBadge} title="Tool matcher pattern">
            {hook.matcher}
          </span>
        )}
      </div>
      <code className={styles.hookCommand}>{hook.command}</code>
      {(hook.timeout !== undefined || hook.background) && (
        <div className={styles.hookFlags}>
          {hook.timeout !== undefined && (
            <span className={styles.hookFlag}>timeout: {hook.timeout}s</span>
          )}
          {hook.background && <span className={styles.hookFlag}>background</span>}
        </div>
      )}
    </div>
  );
}

function ScopeSection({
  scope,
  settingsPath,
  exists,
  items,
  error,
}: {
  scope: HookScope;
  settingsPath: string;
  exists: boolean;
  items: ActiveHookItem[];
  error?: string;
}) {
  const label = scope === 'user' ? 'User Profile' : 'Project';
  const icon = scope === 'user' ? '👤' : '📁';

  return (
    <div className={styles.scopeSection}>
      <div className={styles.scopeHeader}>
        <span className={styles.scopeIcon}>{icon}</span>
        <div>
          <div className={styles.scopeTitle}>
            {label}
            {items.length > 0 && (
              <span className={styles.hookCount}>
                {items.length} hook{items.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className={styles.scopePath}>{settingsPath}</div>
        </div>
        <span className={`${styles.existsBadge} ${exists ? styles.existsYes : styles.existsNo}`}>
          {exists ? 'Found' : 'Not found'}
        </span>
      </div>

      {error && <div className={styles.parseError}>Parse error: {error}</div>}

      {exists && items.length === 0 && !error && (
        <div className={styles.emptyScope}>No hooks configured in this file.</div>
      )}

      {items.length > 0 && (
        <div className={styles.hookList}>
          {items.map((hook) => (
            <HookRow key={hook.id} hook={hook} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ActiveHooksPage() {
  const { projectPath } = useProject();
  const [result, setResult] = useState<ActiveHooksResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await window.settingsAPI.listActiveHooks(projectPath ?? undefined);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hooks');
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    load();
  }, [load]);

  const userItems = result?.items.filter((h) => h.scope === 'user') ?? [];
  const projectItems = result?.items.filter((h) => h.scope === 'project') ?? [];
  const totalCount = result?.items.length ?? 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>Active Hooks</h2>
          <div className={styles.description}>
            Hooks configured in Claude Code settings.json files (user profile and project).
          </div>
        </div>
        <button type="button" className={styles.refreshButton} onClick={load} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {!loading && result && totalCount === 0 && (
        <div className={styles.emptyBanner}>
          No hooks configured in either settings file.
          <div className={styles.emptyHint}>
            Add hooks to <code>~/.claude/settings.json</code> or <code>.claude/settings.json</code>{' '}
            in your project.
          </div>
        </div>
      )}

      {result && (
        <div className={styles.sections}>
          <ScopeSection
            scope="user"
            settingsPath={result.userSettingsPath}
            exists={result.userSettingsExists}
            items={userItems}
            error={result.userError}
          />
          <ScopeSection
            scope="project"
            settingsPath={result.projectSettingsPath ?? '(no project selected)'}
            exists={result.projectSettingsExists}
            items={projectItems}
            error={result.projectError}
          />
        </div>
      )}

      {!loading && result && totalCount > 0 && (
        <div className={styles.summary}>
          Total: {totalCount} hook{totalCount !== 1 ? 's' : ''} across{' '}
          {[userItems.length > 0 && 'user', projectItems.length > 0 && 'project']
            .filter(Boolean)
            .join(' + ')}{' '}
          scope{userItems.length > 0 && projectItems.length > 0 ? 's' : ''}.
        </div>
      )}
    </div>
  );
}
