import { useMemo, useState } from 'react';
import type { ProjectListItem } from '../../shared/dataSource';

interface Props {
  projects: ProjectListItem[];
  activeProjectId: string | null;
  onSelect: (id: string) => void;
}

const TOOL_ORDER: Array<{ id: string; label: string }> = [
  { id: 'claude', label: 'Claude' },
  { id: 'codex', label: 'Codex' },
  { id: 'gemini', label: 'Gemini' },
];

function shortenPath(path: string): string {
  if (!path) return path;
  if (path === '<unknown cwd>') return path;
  // Trim leading $HOME so `/Users/jun/foo/bar` reads as `~/foo/bar`.
  const home = '/Users/';
  if (path.startsWith(home)) {
    const segments = path.split('/').filter(Boolean);
    if (segments.length >= 2) {
      return `~/${segments.slice(2).join('/')}`;
    }
  }
  return path;
}

function fmtRelativeMs(ms: number | undefined): string {
  if (!ms) return '';
  const delta = Date.now() - ms;
  const sec = Math.round(delta / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d`;
  const mo = Math.floor(day / 30);
  return `${mo}mo`;
}

/**
 * Vertical project list grouped by toolId. Includes a free-text filter that
 * matches against the resolved cwd. The list scales to dozens of projects
 * without overflowing the chrome the way the previous horizontal tab strip
 * did at ~50 entries.
 */
export function ProjectSidebar({ projects, activeProjectId, onSelect }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.path.toLowerCase().includes(q));
  }, [projects, query]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, ProjectListItem[]>();
    for (const p of filtered) {
      const key = p.toolId ?? 'unknown';
      const list = buckets.get(key) ?? [];
      list.push(p);
      buckets.set(key, list);
    }
    for (const list of buckets.values()) {
      list.sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
    }
    return buckets;
  }, [filtered]);

  return (
    <aside className="project-sidebar">
      <div className="sidebar-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="filter cwd…"
          aria-label="filter projects by cwd"
        />
        <span className="dim mono">{filtered.length}</span>
      </div>

      <div className="sidebar-groups">
        {TOOL_ORDER.map(({ id: toolId, label }) => {
          const items = grouped.get(toolId);
          if (!items || items.length === 0) return null;
          return (
            <section key={toolId} className="sidebar-group">
              <h3 className={`sidebar-group-title tool-${toolId}`}>
                <span className={`pill tool tool-${toolId}`}>{toolId}</span>
                <span className="dim">{label}</span>
                <span className="dim count">· {items.length}</span>
              </h3>
              <ul className="project-list" role="listbox">
                {items.map((p) => {
                  const active = p.id === activeProjectId;
                  return (
                    <li
                      key={p.id}
                      role="option"
                      aria-selected={active}
                      className={`project-row ${active ? 'active' : ''}`}
                    >
                      <button
                        type="button"
                        className="project-row-button"
                        onClick={() => onSelect(p.id)}
                        title={p.path}
                      >
                        <span className="path mono">{shortenPath(p.path)}</span>
                        <span className="meta dim mono">
                          {p.sessionCount}
                          {p.lastSeenAt ? ` · ${fmtRelativeMs(p.lastSeenAt)}` : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {/* Catch-all bucket for adapters that don't stamp toolId. */}
        {Array.from(grouped.entries())
          .filter(([k]) => !TOOL_ORDER.some((t) => t.id === k))
          .map(([key, items]) => (
            <section key={key} className="sidebar-group">
              <h3 className="sidebar-group-title">
                <span className="dim">{key}</span>
                <span className="dim count">· {items.length}</span>
              </h3>
              <ul className="project-list" role="listbox">
                {items.map((p) => (
                  <li
                    key={p.id}
                    className={`project-row ${p.id === activeProjectId ? 'active' : ''}`}
                  >
                    <button
                      type="button"
                      className="project-row-button"
                      onClick={() => onSelect(p.id)}
                    >
                      <span className="path mono">{shortenPath(p.path)}</span>
                      <span className="meta dim mono">{p.sessionCount}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </aside>
  );
}
