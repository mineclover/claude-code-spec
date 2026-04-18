/**
 * MCP Registry Page — manage the universe of MCP servers the app knows about,
 * split into user scope (~/.claude/mcp-registry.json) and project scope
 * (<project>/.claude/mcp-registry.json). Project entries override user entries
 * of the same id (scope='project' wins).
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
import type { McpEntryScope } from '../types/api/mcp';
import type { McpRegistryEntry, ResolvedRegistry } from '../types/mcp-policy';
import styles from './McpRegistryPage.module.css';

interface EntryDraft {
  id: string;
  name: string;
  command: string;
  argsText: string;
  envText: string;
  category: string;
  description: string;
  type: '' | 'stdio' | 'http' | 'sse';
  scope: McpEntryScope;
}

function emptyDraft(scope: McpEntryScope): EntryDraft {
  return {
    id: '',
    name: '',
    command: '',
    argsText: '',
    envText: '',
    category: '',
    description: '',
    type: '',
    scope,
  };
}

function entryToDraft(entry: McpRegistryEntry): EntryDraft {
  return {
    id: entry.id,
    name: entry.name ?? '',
    command: entry.command,
    argsText: entry.args.join('\n'),
    envText: entry.env
      ? Object.entries(entry.env)
          .map(([k, v]) => `${k}=${v}`)
          .join('\n')
      : '',
    category: entry.category ?? '',
    description: entry.description ?? '',
    type: entry.type ?? '',
    scope: entry.scope,
  };
}

function draftToEntry(draft: EntryDraft): { entry: McpRegistryEntry | null; error?: string } {
  const id = draft.id.trim();
  if (!id) return { entry: null, error: 'id is required' };
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) {
    return { entry: null, error: 'id must be alphanumeric with - or _' };
  }
  const command = draft.command.trim();
  if (!command) return { entry: null, error: 'command is required' };

  const args = draft.argsText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let env: Record<string, string> | undefined;
  if (draft.envText.trim()) {
    env = {};
    for (const rawLine of draft.envText.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) return { entry: null, error: `malformed env line: ${line}` };
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1);
      if (!key) return { entry: null, error: `empty env key in line: ${line}` };
      env[key] = value;
    }
    if (Object.keys(env).length === 0) env = undefined;
  }

  const entry: McpRegistryEntry = {
    id,
    name: draft.name.trim() || undefined,
    command,
    args,
    env,
    category: draft.category.trim() || undefined,
    description: draft.description.trim() || undefined,
    type: draft.type === '' ? undefined : draft.type,
    scope: draft.scope,
  };
  return { entry };
}

export function McpRegistryPage() {
  const { projectPath } = useProject();
  const [registry, setRegistry] = useState<ResolvedRegistry | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    try {
      const next = await window.mcpAPI.getRegistry(projectPath);
      setRegistry(next);
    } catch (error) {
      toast.error(`Failed to load registry: ${error instanceof Error ? error.message : ''}`);
    }
  }, [projectPath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  const handleSelect = (entry: McpRegistryEntry) => {
    setSelectedId(entry.id);
    setDraft(entryToDraft(entry));
    setIsCreating(false);
  };

  const handleNew = (scope: McpEntryScope) => {
    if (scope === 'project' && !projectPath) {
      toast.error('Select a project first to add a project-scope entry.');
      return;
    }
    setSelectedId(null);
    setDraft(emptyDraft(scope));
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!draft) return;
    const { entry, error } = draftToEntry(draft);
    if (!entry) {
      toast.error(error ?? 'Invalid entry');
      return;
    }
    if (entry.scope === 'project' && !projectPath) {
      toast.error('project scope requires a selected project');
      return;
    }
    const res = await window.mcpAPI.saveRegistryEntry(
      entry.scope,
      entry,
      entry.scope === 'project' ? projectPath : null,
    );
    if (!res.success) {
      toast.error(res.error ?? 'Save failed');
      return;
    }
    toast.success(`Saved ${entry.id}`);
    setSelectedId(entry.id);
    setIsCreating(false);
    await refresh();
  };

  const handleDelete = async () => {
    if (!draft || !selectedId) return;
    if (draft.scope === 'project' && !projectPath) {
      toast.error('project scope requires a selected project');
      return;
    }
    const confirmed = window.confirm(`Delete registry entry "${selectedId}"?`);
    if (!confirmed) return;
    const res = await window.mcpAPI.deleteRegistryEntry(
      draft.scope,
      selectedId,
      draft.scope === 'project' ? projectPath : null,
    );
    if (!res.success) {
      toast.error(res.error ?? 'Delete failed');
      return;
    }
    toast.success(`Deleted ${selectedId}`);
    setSelectedId(null);
    setDraft(null);
    await refresh();
  };

  const handleCancel = () => {
    if (selectedId && registry) {
      const existing = registry.entries.find((e) => e.id === selectedId);
      if (existing) {
        setDraft(entryToDraft(existing));
        setIsCreating(false);
        return;
      }
    }
    setDraft(null);
    setIsCreating(false);
  };

  return (
    <div className={styles.pageWrapper}>
      <McpBanner
        variant="new"
        linkTo="/"
        linkLabel="Go to Execute →"
        text="New Registry/Policy/Override model. Override per-run via the Compose panel on Execute."
      />
      <div className={styles.container}>
      <aside className={styles.sidebar}>
        <header className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>MCP Registry</h2>
          <div className={styles.sources}>
            <span>user: {registry?.sources.userPath ? 'loaded' : '(none)'}</span>
            <span>
              project:{' '}
              {registry?.sources.projectPath
                ? 'loaded'
                : projectPath
                  ? '(empty)'
                  : '(no project)'}
            </span>
          </div>
          <div className={styles.newButtons}>
            <button type="button" onClick={() => handleNew('user')}>
              + User
            </button>
            <button
              type="button"
              disabled={!projectPath}
              onClick={() => handleNew('project')}
              title={!projectPath ? 'Select a project first' : ''}
            >
              + Project
            </button>
          </div>
        </header>

        <CategoryFilter
          query={query}
          onQueryChange={setQuery}
          resultLabel={
            query.length > 0 ? `${matchedCount} / ${totalCount}` : undefined
          }
        />

        <div className={styles.list}>
          <CategoryGroupedList<McpRegistryEntry>
            groups={grouped}
            groupClassName={styles.group}
            renderHeader={(category) => (
              <h3 className={styles.groupHeader}>{category}</h3>
            )}
            emptyMessage={<p className={styles.empty}>No registry entries yet.</p>}
            renderItem={(entry) => (
              <button
                type="button"
                className={`${styles.item} ${selectedId === entry.id ? styles.itemSelected : ''}`}
                onClick={() => handleSelect(entry)}
              >
                <span className={styles.itemId}>{entry.id}</span>
                <ScopeBadge scope={entry.scope} />
              </button>
            )}
          />
        </div>
      </aside>

      <main className={styles.editor}>
        {!draft ? (
          <p className={styles.placeholder}>
            Select an entry on the left or create a new one to edit.
          </p>
        ) : (
          <div className={styles.form}>
            <header className={styles.formHeader}>
              <h2>{isCreating ? `New ${draft.scope} entry` : `Edit ${draft.id || 'entry'}`}</h2>
              <ScopeBadge scope={draft.scope} />
            </header>

            <label className={styles.field}>
              <span>id</span>
              <input
                value={draft.id}
                onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                disabled={!isCreating}
                placeholder="serena"
              />
            </label>

            <label className={styles.field}>
              <span>name (optional)</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Serena"
              />
            </label>

            <label className={styles.field}>
              <span>type</span>
              <select
                value={draft.type}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    type: e.target.value as EntryDraft['type'],
                  })
                }
              >
                <option value="">(default)</option>
                <option value="stdio">stdio</option>
                <option value="http">http</option>
                <option value="sse">sse</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>command</span>
              <input
                value={draft.command}
                onChange={(e) => setDraft({ ...draft, command: e.target.value })}
                placeholder="serena"
              />
            </label>

            <label className={styles.field}>
              <span>args (one per line)</span>
              <textarea
                value={draft.argsText}
                onChange={(e) => setDraft({ ...draft, argsText: e.target.value })}
                rows={4}
                placeholder="--flag\nvalue"
              />
            </label>

            <label className={styles.field}>
              <span>env (KEY=value, one per line)</span>
              <textarea
                value={draft.envText}
                onChange={(e) => setDraft({ ...draft, envText: e.target.value })}
                rows={3}
                placeholder="API_KEY=xyz"
              />
            </label>

            <label className={styles.field}>
              <span>category</span>
              <input
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                placeholder="analysis"
              />
            </label>

            <label className={styles.field}>
              <span>description</span>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
              />
            </label>

            <div className={styles.actions}>
              <button type="button" className={styles.saveButton} onClick={handleSave}>
                {isCreating ? 'Create' : 'Save'}
              </button>
              <button type="button" onClick={handleCancel}>
                Cancel
              </button>
              {!isCreating && (
                <button type="button" className={styles.deleteButton} onClick={handleDelete}>
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
