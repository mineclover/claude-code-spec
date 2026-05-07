/**
 * Global summaries view.
 *
 * Cross-cuts all sessions: lists every persisted SummaryRecord on disk,
 * grouped by source session for context but sortable by recency.
 * Selecting an entry opens the structured panel inline.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SummaryHistory } from './SummaryHistory';
import { SummaryPanel } from './SummaryPanel';
import type {
  SessionDataSource,
  SummaryRecord,
} from '../../shared/dataSource';

interface Props {
  dataSource: SessionDataSource;
}

function shortenPath(path: string): string {
  if (!path) return path;
  const home = '/Users/';
  if (path.startsWith(home)) {
    const segments = path.split('/').filter(Boolean);
    if (segments.length >= 2) {
      return `~/${segments.slice(2).join('/')}`;
    }
  }
  return path;
}

export function SummariesView({ dataSource }: Props) {
  const { t } = useTranslation();
  const [records, setRecords] = useState<SummaryRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [toolFilter, setToolFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    dataSource
      .listSummaries({})
      .then((items) => {
        if (cancelled) return;
        setRecords(items);
        setActiveId(items[0]?.id ?? null);
      })
      .catch((err) => console.error('[SummariesView] listSummaries failed', err));
    return () => {
      cancelled = true;
    };
  }, [dataSource]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return records.filter((r) => {
      if (toolFilter !== 'all' && r.toolId !== toolFilter) return false;
      if (!q) return true;
      const haystack =
        `${r.summary.oneLiner} ${r.summary.narrative} ${r.cwd}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [records, filter, toolFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, SummaryRecord[]>();
    for (const r of filtered) {
      const key = `${r.toolId}:${r.cwd}`;
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return map;
  }, [filtered]);

  const active = useMemo(
    () => records.find((r) => r.id === activeId) ?? null,
    [records, activeId],
  );

  const onDelete = async (record: SummaryRecord) => {
    try {
      await dataSource.deleteSummary(record.id);
      setRecords((prev) => prev.filter((r) => r.id !== record.id));
      if (activeId === record.id) setActiveId(null);
    } catch (err) {
      console.error('[SummariesView] deleteSummary failed', err);
    }
  };

  const tools = useMemo(() => {
    const seen = new Set<string>();
    for (const r of records) seen.add(r.toolId);
    return Array.from(seen);
  }, [records]);

  return (
    <main className="grid-summaries">
      <aside className="summaries-sidebar">
        <div className="sidebar-search">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('sidebar.filterPlaceholder')}
          />
          <span className="dim mono">{filtered.length}</span>
        </div>

        {tools.length > 1 && (
          <div className="summaries-toolfilter">
            <button
              type="button"
              className={toolFilter === 'all' ? 'on' : ''}
              onClick={() => setToolFilter('all')}
            >
              all
            </button>
            {tools.map((tid) => (
              <button
                key={tid}
                type="button"
                className={`pill tool tool-${tid} ${toolFilter === tid ? 'on' : ''}`}
                onClick={() => setToolFilter(tid)}
              >
                {tid}
              </button>
            ))}
          </div>
        )}

        <div className="sidebar-groups">
          {Array.from(grouped.entries()).map(([key, list]) => {
            const sample = list[0];
            if (!sample) return null;
            return (
              <section key={key} className="sidebar-group">
                <h3 className={`sidebar-group-title tool-${sample.toolId}`}>
                  <span className={`pill tool tool-${sample.toolId}`}>
                    {sample.toolId}
                  </span>
                  <span className="dim mono path">
                    {shortenPath(sample.cwd)}
                  </span>
                  <span className="dim count">· {list.length}</span>
                </h3>
                <SummaryHistory
                  records={list}
                  activeId={activeId}
                  onSelect={(r) => setActiveId(r.id)}
                  onDelete={onDelete}
                />
              </section>
            );
          })}
          {filtered.length === 0 && (
            <p className="empty mono">{t('summary.noPast')}</p>
          )}
        </div>
      </aside>

      <section className="pane summaries-detail-pane">
        {active ? (
          <>
            <header className="pane-header">
              <h2 className="pane-title">{active.summary.oneLiner}</h2>
              <span className="dim mono pane-subtitle">
                {active.toolId} · {shortenPath(active.cwd)} ·{' '}
                {new Date(active.createdAt).toLocaleString()}
              </span>
            </header>
            <SummaryPanel
              summary={active.summary}
              loading={false}
              error={null}
              onCopyPrompt={(p) =>
                navigator.clipboard?.writeText(p).catch(() => undefined)
              }
            />
          </>
        ) : (
          <p className="empty mono">{t('panes.selectSession')}</p>
        )}
      </section>
    </main>
  );
}
