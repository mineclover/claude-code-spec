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

type DateRange = 'all' | 'today' | 'week' | 'month';
type SortMode = 'newest' | 'oldest' | 'cacheHit';
type LayoutMode = 'grouped' | 'flat';

const DATE_RANGE_MS: Record<DateRange, number | null> = {
  all: null,
  today: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

/**
 * Concatenate every searchable field of a record into one lowercased
 * string. We deliberately include all narrative arrays so a query like
 * "outbox" matches when the keyword only appears in a decision title.
 */
function buildSearchHaystack(r: SummaryRecord): string {
  const parts: string[] = [
    r.summary.oneLiner,
    r.summary.narrative,
    r.cwd,
    r.toolId,
  ];
  for (const d of r.summary.keyDecisions) {
    parts.push(d.title);
    if (d.rationale) parts.push(d.rationale);
  }
  for (const ref of r.summary.references) {
    parts.push(ref.target);
    if (ref.note) parts.push(ref.note);
  }
  for (const o of r.summary.openItems) parts.push(o.question);
  for (const n of r.summary.nextActions) {
    if (n.label) parts.push(n.label);
    parts.push(n.prompt);
  }
  return parts.join(' \n ').toLowerCase();
}

export function SummariesView({ dataSource }: Props) {
  const { t } = useTranslation();
  const [records, setRecords] = useState<SummaryRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [toolFilter, setToolFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [layout, setLayout] = useState<LayoutMode>('grouped');

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
    const cutoff =
      DATE_RANGE_MS[dateRange] !== null
        ? Date.now() - (DATE_RANGE_MS[dateRange] as number)
        : null;
    const passing = records.filter((r) => {
      if (toolFilter !== 'all' && r.toolId !== toolFilter) return false;
      if (cutoff !== null && new Date(r.createdAt).getTime() < cutoff) {
        return false;
      }
      if (!q) return true;
      return buildSearchHaystack(r).includes(q);
    });
    const sorted = [...passing];
    sorted.sort((a, b) => {
      if (sortMode === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortMode === 'cacheHit') {
        const ar = a.summary.cacheInvariants?.prefixPreservedRatio ?? -1;
        const br = b.summary.cacheInvariants?.prefixPreservedRatio ?? -1;
        if (br !== ar) return br - ar;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted;
  }, [records, filter, toolFilter, dateRange, sortMode]);

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
          <span className="dim mono">
            {filtered.length}/{records.length}
          </span>
        </div>

        <div className="summaries-controls">
          <select
            aria-label="date range"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
          >
            <option value="all">all time</option>
            <option value="today">last 24h</option>
            <option value="week">last 7d</option>
            <option value="month">last 30d</option>
          </select>
          <select
            aria-label="sort"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
          >
            <option value="newest">newest</option>
            <option value="oldest">oldest</option>
            <option value="cacheHit">cache hit %</option>
          </select>
          <div
            className="summaries-layout-toggle"
            role="radiogroup"
            aria-label="layout"
          >
            {(['grouped', 'flat'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={layout === m}
                className={layout === m ? 'on' : ''}
                onClick={() => setLayout(m)}
              >
                {m}
              </button>
            ))}
          </div>
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
          {layout === 'grouped' ? (
            Array.from(grouped.entries()).map(([key, list]) => {
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
            })
          ) : (
            <section className="sidebar-group">
              <SummaryHistory
                records={filtered}
                activeId={activeId}
                onSelect={(r) => setActiveId(r.id)}
                onDelete={onDelete}
              />
            </section>
          )}
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
