import {
  aggregateSessionMetas,
  type SessionMetaView,
  type SummaryResult,
} from '@context-action/session-core';
import type { SessionOutline } from '@context-action/session-core/outline';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AggregateStats } from './components/AggregateStats';
import { CacheGauge } from './components/CacheGauge';
import { OutlineView } from './components/OutlineView';
import { ProjectSidebar } from './components/ProjectSidebar';
import { SessionDetail } from './components/SessionDetail';
import { SessionList } from './components/SessionList';
import { SummariesView } from './components/SummariesView';
import { SummaryHistory } from './components/SummaryHistory';
import { SummaryPanel } from './components/SummaryPanel';
import { setRendererLanguage } from './i18n';
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

type View = 'sessions' | 'outline' | 'summaries';

export function App({ dataSource }: AppProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('sessions');
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
    setRendererLanguage(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      /* no-op */
    }
  }, []);

  // Sync the renderer's i18n locale to the toggle on first mount and any
  // change after that. The toggle is the single source of truth for both
  // the surface chrome language and the model's output language.
  useEffect(() => {
    setRendererLanguage(summaryLanguage);
  }, [summaryLanguage]);

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

  // Outline view state — independent of summary state but keyed off
  // the same activeSession. Loads (or refreshes) whenever the user
  // switches into the Outline tab or selects a different session.
  const [outline, setOutline] = useState<SessionOutline | null>(null);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [annotating, setAnnotating] = useState(false);
  const [outlineProgress, setOutlineProgress] = useState<{
    phase: string;
    message?: string;
    elapsedMs: number;
  } | null>(null);

  // Reload outline when active session changes OR when we enter the
  // outline view tab (so a stale outline from a different session
  // never lingers visible).
  useEffect(() => {
    if (view !== 'outline' || !activeSessionId) {
      // Clear outline state when leaving / no session — avoids
      // showing the wrong session's outline after a project switch.
      if (view !== 'outline') {
        setOutline(null);
        setOutlineError(null);
        setOutlineProgress(null);
      }
      return;
    }
    let cancelled = false;
    setOutlineLoading(true);
    setOutlineError(null);
    setOutlineProgress(null);
    dataSource
      .getOutline(activeSessionId)
      .then((result) => {
        if (cancelled) return;
        setOutline(result);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setOutlineError(msg);
      })
      .finally(() => {
        if (!cancelled) setOutlineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataSource, activeSessionId, view]);

  // Stream annotator progress to the same panel that renders the
  // outline. We filter by sourceSessionId so a background annotation
  // for a different session can't mutate the active view.
  useEffect(() => {
    const unsubscribe = dataSource.subscribeOutlineProgress((event) => {
      if (event.sourceSessionId !== activeSessionId) return;
      setOutlineProgress({
        phase: event.phase,
        message: event.message,
        elapsedMs: event.elapsedMs,
      });
      if (event.phase === 'failed' && event.error) {
        setOutlineError(event.error);
      }
    });
    return unsubscribe;
  }, [dataSource, activeSessionId]);

  const runAnnotate = useCallback(async () => {
    if (!activeSessionId || !activeSession) return;
    setAnnotating(true);
    setOutlineError(null);
    setOutlineProgress({
      phase: 'starting',
      elapsedMs: 0,
    });
    try {
      const result = await dataSource.annotateOutline(
        activeSessionId,
        summaryLanguage,
      );
      setOutline(result);
    } catch (err) {
      const msg =
        err instanceof BranchUnsupportedError
          ? `Annotation not supported: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);
      setOutlineError(msg);
    } finally {
      setAnnotating(false);
    }
  }, [dataSource, activeSession, activeSessionId, summaryLanguage]);

  const onDeleteOutline = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      await dataSource.deleteOutline(activeSessionId);
      // After delete, fall back to a fresh extraction so the view
      // shows the un-annotated structure rather than a stale tagged
      // copy.
      const fresh = await dataSource.getOutline(activeSessionId);
      setOutline(fresh);
    } catch (err) {
      console.error('[App] deleteOutline failed', err);
    }
  }, [dataSource, activeSessionId]);

  const canAnnotate = useMemo(() => {
    if (!activeSession) return false;
    // Annotator is currently claude-only at the bun layer.
    return activeSession.toolId === 'claude' && !adapter.readonly;
  }, [activeSession, adapter.readonly]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo">SV</span>
          <b>{t('app.brand')}</b>
          <span className="dim">{t('app.tag')}</span>
        </div>
        <nav className="view-tabs" aria-label="view">
          {(['sessions', 'outline', 'summaries'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-current={view === v ? 'page' : undefined}
              className={view === v ? 'on' : ''}
              onClick={() => setView(v)}
            >
              {v === 'sessions'
                ? t('panes.sessions')
                : v === 'outline'
                  ? t('panes.outline')
                  : t('panes.pastSummaries')}
            </button>
          ))}
        </nav>
        <div className="spacer" />
        <div
          className="lang-toggle"
          role="radiogroup"
          aria-label={t('topbar.lang')}
          title={t('topbar.lang')}
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
        <span className="adapter-pill" title={t('topbar.adapter')}>
          {t('topbar.adapter')}: <b>{adapter.adapter}</b>
          {adapter.readonly ? ' · readonly' : ''}
        </span>
      </header>

      {error && <div className="banner error">{error}</div>}

      {view === 'summaries' ? (
        <SummariesView dataSource={dataSource} />
      ) : view === 'outline' ? (
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
            <h2 className="pane-title">{t('panes.sessions')}</h2>
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
            <h2 className="pane-title">{t('panes.outline')}</h2>
          </header>
          {activeSession ? (
            <OutlineView
              outline={outline}
              loading={outlineLoading}
              error={outlineError}
              canAnnotate={canAnnotate}
              annotating={annotating}
              progress={outlineProgress}
              onAnnotate={runAnnotate}
              onDelete={outline?.annotation ? onDeleteOutline : undefined}
            />
          ) : (
            <p className="empty">{t('panes.selectSession')}</p>
          )}
        </section>
      </main>
      ) : (
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
            <h2 className="pane-title">{t('panes.sessions')}</h2>
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
            <h2 className="pane-title">{t('panes.cacheInvariants')}</h2>
            {activeSession && (
              <button
                type="button"
                className="branch-button"
                onClick={runBranch}
                disabled={summaryLoading}
                title={t('branch.tooltip')}
              >
                {summaryLoading ? t('branch.running') : t('branch.trigger')}
              </button>
            )}
          </header>
          {activeSession ? (
            <>
              <CacheGauge metrics={activeSession.metrics} />
              <SessionDetail session={activeSession} />
              {(summary || summaryLoading || summaryError) && (
                <>
                  <h3 className="pane-subhead">{t('panes.branchedSummary')}</h3>
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
              <h3 className="pane-subhead">{t('panes.pastSummaries')}</h3>
              <SummaryHistory
                records={history}
                activeId={activeSummaryId}
                onSelect={onSelectHistory}
                onDelete={onDeleteHistory}
              />
              <h3 className="pane-subhead">{t('panes.projectRollup')}</h3>
              <AggregateStats
                aggregate={aggregate}
                scope={activeProject?.toolId}
              />
            </>
          ) : (
            <p className="empty">{t('panes.selectSession')}</p>
          )}
        </section>
      </main>
      )}
    </div>
  );
}
