import type { SummaryRecord } from '../../shared/dataSource';

interface Props {
  records: SummaryRecord[];
  activeId: string | null;
  onSelect: (record: SummaryRecord) => void;
  onDelete: (record: SummaryRecord) => void;
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return iso;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}

/**
 * Compact list of past Branch & Summarize attempts for the active session.
 * Each row shows the summary's headline plus relative timestamp; clicking
 * loads the full record into the SummaryPanel above.
 */
export function SummaryHistory({
  records,
  activeId,
  onSelect,
  onDelete,
}: Props) {
  if (records.length === 0) {
    return <p className="empty mono">no past summaries for this session.</p>;
  }
  return (
    <ul className="summary-history" role="list">
      {records.map((r) => {
        const active = r.id === activeId;
        const ratio = r.summary.cacheInvariants?.prefixPreservedRatio;
        return (
          <li
            key={r.id}
            className={`summary-history-row ${active ? 'active' : ''}`}
          >
            <button
              type="button"
              className="summary-history-button"
              onClick={() => onSelect(r)}
            >
              <div className="summary-history-headline">{r.summary.oneLiner}</div>
              <div className="summary-history-meta dim mono">
                {fmtRelative(r.createdAt)}
                {ratio != null
                  ? ` · prefix ${(ratio * 100).toFixed(0)}%`
                  : ''}
                {' · '}
                {r.id.slice(0, 8)}
              </div>
            </button>
            <button
              type="button"
              className="summary-history-delete"
              title="delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(r);
              }}
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}
