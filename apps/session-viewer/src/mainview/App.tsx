import {
  aggregateSessionMetas,
  type SessionMetaView,
  type SummaryResult,
} from '@context-action/session-core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AggregateStats } from './components/AggregateStats';
import { CacheGauge } from './components/CacheGauge';
import { ProjectSidebar } from './components/ProjectSidebar';
import { SessionDetail } from './components/SessionDetail';
import { SessionList } from './components/SessionList';
import { SummaryHistory } from './components/SummaryHistory';
import { SummaryPanel } from './components/SummaryPanel';
import {
  BranchUnsupportedError,
  type ProjectListItem,
  type SessionDataSource,
  type SummaryLanguage,
  type SummaryRecord,
} from '../shared/dataSource';

const LANG_STORAGE_KEY = 'session-viewer.summaryLanguage';

function readStoredLanguage(): SummaryLanguage {
  try {
    const v = localStorage.getItem(LANG_STORAGE_KEY);
    if (v === 'ko' || v === 'en') return v;
  } catch {
    /* sandboxed webviews may not have localStorage; that's fine */
  }
  return 'en';
}

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
  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );
  const activeSession = useMemo(
    () => sessions.find((s) => s.sessionId === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  // Branch & Summarize state — per-active-session.
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [activeSummaryId, setActiveSummaryId] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [progressPhase, setProgressPhase] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string>('');
  const [history, setHistory] = useState<SummaryRecord[]>([]);
  const [summaryLanguage, setSummaryLanguageState] = useState<SummaryLanguage>(
    () => readStoredLanguage(),
  );

  const setSummaryLanguage = useCallback((lang: SummaryLanguage) => {
    setSummaryLanguageState(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      /* no-op */
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    if (!activeSessionId) {
      setHistory([]);
      return;
    }
    try {
      const items = await dataSource.listSummaries({
        sourceSessionId: activeSessionId,
      });
      setHistory(items);
    } catch (err) {
      console.error('[App] listSummaries failed', err);
    }
  }, [dataSource, activeSessionId]);

  // Reset summary state and reload history when the user changes session.
  useEffect(() => {
    setSummary(null);
    setActiveSummaryId(null);
    setSummaryError(null);
    setProgressPhase(null);
    setProgressMessage(null);
    setStreamingText('');
    refreshHistory();
  }, [activeSessionId, refreshHistory]);

  // Subscribe to fork progress events for the active session.
  useEffect(() => {
    const unsubscribe = dataSource.subscribeProgress((event) => {
      if (event.sourceSessionId !== activeSessionId) return;
      setProgressPhase(event.phase);
      if (event.message) setProgressMessage(event.message);
      if (event.phase === 'assistant-streaming' && event.textDelta) {
        // Some Claude builds emit cumulative text rather than deltas; if a
        // delta starts with what we already have, append the new tail
        // instead of duplicating.
        setStreamingText((prev) => {
          if (!prev) return event.textDelta!;
          if (event.textDelta!.startsWith(prev)) return event.textDelta!;
          return prev + event.textDelta;
        });
      }
      if (event.phase === 'failed' && event.error) {
        setSummaryError(event.error);
      }
    });
    return unsubscribe;
  }, [dataSource, activeSessionId]);

  const runBranch = useCallback(async () => {
    if (!activeSession) return;
    setSummaryLoading(true);
    setSummaryError(null);
    setSummary(null);
    setProgressPhase('starting');
    setProgressMessage(null);
    setStreamingText('');
    try {
      const result = await dataSource.branch({
        sessionId: activeSession.sessionId,
        kind: 'summarize',
        language: summaryLanguage,
      });
      setSummary(result);
      setActiveSummaryId(result.cacheInvariants?.forkSessionId ?? null);
      // The bun side persists after a successful branch — pull the new
      // record into the local history view.
      refreshHistory();
    } catch (err) {
      const msg =
        err instanceof BranchUnsupportedError
          ? `Branch not supported: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);
      setSummaryError(msg);
    } finally {
      setSummaryLoading(false);
    }
  }, [dataSource, activeSession, summaryLanguage, refreshHistory]);

  const onSelectHistory = useCallback((record: SummaryRecord) => {
    setSummary(record.summary);
    setActiveSummaryId(record.id);
    setSummaryError(null);
    setProgressPhase(null);
    setStreamingText('');
  }, []);

  const onDeleteHistory = useCallback(
    async (record: SummaryRecord) => {
      try {
        await dataSource.deleteSummary(record.id);
        if (activeSummaryId === record.id) {
          setSummary(null);
          setActiveSummaryId(null);
        }
        refreshHistory();
      } catch (err) {
        console.error('[App] deleteSummary failed', err);
      }
    },
    [dataSource, activeSummaryId, refreshHistory],
  );

  const onCopyPrompt = useCallback((prompt: string) => {
    navigator.clipboard?.writeText(prompt).catch(() => undefined);
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo">SV</span>
          <b>session-viewer</b>
          <span className="dim">/ poc</span>
        </div>
        <div className="spacer" />
        <div
          className="lang-toggle"
          role="radiogroup"
          aria-label="Summary output language"
          title="Output language for Branch & Summarize"
        >
          {(['en', 'ko'] as const).map((code) => (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={summaryLanguage === code}
              className={summaryLanguage === code ? 'on' : ''}
              onClick={() => setSummaryLanguage(code)}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
        <span className="adapter-pill" title="Active data source adapter">
          adapter: <b>{adapter.adapter}</b>
          {adapter.readonly ? ' · readonly' : ''}
        </span>
      </header>

      {error && <div className="banner error">{error}</div>}

      <main className="grid-3">
        <ProjectSidebar
          projects={projects}
          activeProjectId={activeProjectId}
          onSelect={(id) => {
            setActiveProjectId(id);
            setActiveSessionId(null);
          }}
        />

        <section className="pane sessions-pane">
          <header className="pane-header">
            <h2 className="pane-title">Sessions</h2>
            {activeProject && (
              <span className="pane-subtitle mono dim">
                {activeProject.toolId ? `${activeProject.toolId} · ` : ''}
                {activeProject.path}
              </span>
            )}
          </header>
          <SessionList
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelect={setActiveSessionId}
          />
        </section>

        <section className="pane detail-pane">
          <header className="pane-header">
            <h2 className="pane-title">Cache invariants</h2>
            {activeSession && (
              <button
                type="button"
                className="branch-button"
                onClick={runBranch}
                disabled={summaryLoading}
                title="Fork the prefix into a sidecar thread and ask the CLI for a structured summary"
              >
                {summaryLoading ? 'forking…' : 'Branch & Summarize'}
              </button>
            )}
          </header>
          {activeSession ? (
            <>
              <CacheGauge metrics={activeSession.metrics} />
              <SessionDetail session={activeSession} />
              {(summary || summaryLoading || summaryError) && (
                <>
                  <h3 className="pane-subhead">Branched summary</h3>
                  <SummaryPanel
                    summary={summary}
                    loading={summaryLoading}
                    error={summaryError}
                    progressPhase={progressPhase}
                    progressMessage={progressMessage}
                    streamingText={streamingText}
                    onCopyPrompt={onCopyPrompt}
                  />
                </>
              )}
              <h3 className="pane-subhead">Past summaries</h3>
              <SummaryHistory
                records={history}
                activeId={activeSummaryId}
                onSelect={onSelectHistory}
                onDelete={onDeleteHistory}
              />
              <h3 className="pane-subhead">Project rollup</h3>
              <AggregateStats
                aggregate={aggregate}
                scope={activeProject?.toolId}
              />
            </>
          ) : (
            <p className="empty">Select a session.</p>
          )}
        </section>
      </main>
    </div>
  );
}
