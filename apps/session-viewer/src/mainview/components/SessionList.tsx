import type { SessionMetaView } from '@context-action/session-core';

interface Props {
  sessions: SessionMetaView[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function SessionList({ sessions, activeSessionId, onSelect }: Props) {
  if (sessions.length === 0) {
    return <p className="empty">No sessions in this project.</p>;
  }

  return (
    <ul className="session-list" role="listbox">
      {sessions.map((s) => {
        const m = s.metrics;
        const active = s.sessionId === activeSessionId;
        return (
          <li
            key={s.sessionId}
            className={`session-item ${active ? 'active' : ''}`}
            role="option"
            aria-selected={active}
          >
            <button
              type="button"
              className="session-button"
              onClick={() => onSelect(s.sessionId)}
            >
              <div className="session-row-1">
                <span className="session-id">
                  {s.toolId && (
                    <span className={`pill tool tool-${s.toolId}`}>{s.toolId}</span>
                  )}
                  {s.sessionId}
                </span>
                <span
                  className={`pill cache ${m.cacheHitRatio >= 0.5 ? 'good' : m.cacheHitRatio > 0 ? 'warn' : 'bad'}`}
                >
                  {fmtPct(m.cacheHitRatio)}
                </span>
              </div>
              <div className="session-row-2 dim">
                <span>cache_read {fmtTokens(m.cacheReadInputTokens)}</span>
                <span> · input {fmtTokens(m.inputTokens)}</span>
                <span> · turns {m.turns ?? 0}</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
