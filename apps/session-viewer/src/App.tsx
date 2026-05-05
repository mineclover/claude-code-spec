import {
  aggregateSessionMetas,
  type SessionMetaView,
} from '@context-action/session-core';
import { useEffect, useMemo, useState } from 'react';
import { CacheGauge } from './components/CacheGauge';
import { ProjectAggregateBar } from './components/ProjectAggregateBar';
import { SessionDetail } from './components/SessionDetail';
import { SessionList } from './components/SessionList';
import type { ProjectListItem, SessionDataSource } from './data/dataSource';

interface AppProps {
  dataSource: SessionDataSource;
}

export function App({ dataSource }: AppProps) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionMetaView[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const adapter = useMemo(() => dataSource.describe(), [dataSource]);

  useEffect(() => {
    let cancelled = false;
    dataSource
      .listProjects()
      .then((items) => {
        if (cancelled) return;
        setProjects(items);
        if (items.length > 0 && !activeProjectId) {
          setActiveProjectId(items[0]?.id ?? null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [dataSource, activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) {
      setSessions([]);
      setActiveSessionId(null);
      return;
    }
    let cancelled = false;
    dataSource
      .listSessions(activeProjectId)
      .then((items) => {
        if (cancelled) return;
        setSessions(items);
        setActiveSessionId(items[0]?.sessionId ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [dataSource, activeProjectId]);

  const aggregate = useMemo(() => aggregateSessionMetas(sessions), [sessions]);
  const activeSession = useMemo(
    () => sessions.find((s) => s.sessionId === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo">SV</span>
          <b>session-viewer</b>
          <span className="dim">/ poc</span>
        </div>
        <div className="spacer" />
        <span className="adapter-pill" title="Active data source adapter">
          adapter: <b>{adapter.adapter}</b>
          {adapter.readonly ? ' · readonly' : ''}
        </span>
      </header>

      {error && <div className="banner error">{error}</div>}

      <ProjectAggregateBar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
        aggregate={aggregate}
      />

      <main className="grid">
        <section className="pane sessions">
          <h2 className="pane-title">Sessions</h2>
          <SessionList
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelect={setActiveSessionId}
          />
        </section>

        <section className="pane detail">
          <h2 className="pane-title">Cache invariants</h2>
          {activeSession ? (
            <>
              <CacheGauge metrics={activeSession.metrics} />
              <SessionDetail session={activeSession} />
            </>
          ) : (
            <p className="empty">Select a session.</p>
          )}
        </section>
      </main>
    </div>
  );
}
