import type React from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StreamOutput } from '../components/stream/StreamOutput';
import type { StreamEvent } from '../lib/types';
import styles from './ExecutePage.module.css';
import { Pagination } from '../components/common/Pagination';
import {
  getCachedSessionsPage,
  setCachedSessionsPage,
} from '../services/cache';
import { useProject } from '../contexts/ProjectContext';

export const ExecutePage: React.FC = () => {
  const { updateProject } = useProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projectPath, setProjectPath] = useState('');
  const [query, setQuery] = useState('');
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [errors, setErrors] = useState<Array<{ id: string; message: string }>>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPid, setCurrentPid] = useState<number | null>(null);
  const [recentSessions, setRecentSessions] = useState<Array<{ sessionId: string; firstUserMessage?: string; lastModified: number }>>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionsPage, setSessionsPage] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const SESSIONS_PAGE_SIZE = 10;

  // Handle projectPath from URL params
  useEffect(() => {
    const pathFromParams = searchParams.get('projectPath');
    if (pathFromParams) {
      setProjectPath(pathFromParams);
      // Clear the URL parameter after setting
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Load recent sessions when projectPath or page changes
  useEffect(() => {
    if (projectPath) {
      loadRecentSessions(sessionsPage);
    } else {
      setRecentSessions([]);
      setSelectedSessionId(null);
      setTotalSessions(0);
    }
  }, [projectPath, sessionsPage]);

  const loadRecentSessions = async (page: number, skipCache = false) => {
    if (!projectPath) return;

    setSessionsLoading(true);
    try {
      // Try cache first (unless refresh is requested)
      if (!skipCache) {
        const cached = await getCachedSessionsPage(
          projectPath,
          page,
          SESSIONS_PAGE_SIZE
        );

        if (cached) {
          const sessions = cached.sessions.map((s) => ({
            sessionId: s.sessionId,
            firstUserMessage: s.firstUserMessage,
            lastModified: s.lastModified,
          }));
          setRecentSessions(sessions);
          setTotalSessions(cached.total);
          setSessionsLoading(false);
          return;
        }
      }

      // Fetch from backend
      const result = await window.claudeSessionsAPI.getProjectSessionsPaginated(
        projectPath,
        page,
        SESSIONS_PAGE_SIZE
      );

      // Get metadata for each session
      const sessionsWithMetadata = await Promise.all(
        result.sessions.map(async (session) => {
          try {
            const metadata = await window.claudeSessionsAPI.getSessionMetadata(
              projectPath,
              session.sessionId
            );
            return { ...session, ...metadata };
          } catch (error) {
            console.error('Failed to load session metadata:', error);
            return { ...session, hasData: false };
          }
        })
      );

      const sessions = sessionsWithMetadata.map((s) => ({
        sessionId: s.sessionId,
        firstUserMessage: s.firstUserMessage,
        lastModified: s.lastModified,
      }));

      setRecentSessions(sessions);
      setTotalSessions(result.total);

      // Cache the result
      await setCachedSessionsPage(
        projectPath,
        page,
        SESSIONS_PAGE_SIZE,
        sessionsWithMetadata,
        result.total,
        result.hasMore
      );
    } catch (err) {
      console.error('Failed to load recent sessions:', err);
      setRecentSessions([]);
      setTotalSessions(0);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRefreshSessions = () => {
    loadRecentSessions(sessionsPage, true);
  };

  const handleSelectDirectory = async () => {
    const path = await window.claudeAPI.selectDirectory();
    if (path) {
      console.log('[ExecutePage] Selected project path:', path);
      setProjectPath(path);

      // Update ProjectContext for use in MCP Configs and other pages
      // Extract directory name from path (last segment)
      const dirName = path.split('/').filter(Boolean).pop() || path;
      console.log('[ExecutePage] Project dirName:', dirName);
      updateProject(path, dirName);

      // Save to main process
      const result = await window.appSettingsAPI.setCurrentProject(path, dirName);
      console.log('[ExecutePage] Saved to main process:', result);
    }
  };

  const handleExecute = async () => {
    if (!projectPath || !query) {
      setError('Please select a project directory and enter a query');
      return;
    }

    setIsRunning(true);
    setError(null);
    setEvents([]);
    setErrors([]);
    setCurrentPid(null);

    try {
      const result = await window.claudeAPI.executeClaudeCommand(
        projectPath,
        query,
        selectedSessionId || undefined
      );

      if (result.success && result.pid) {
        setCurrentPid(result.pid);
      } else if (!result.success) {
        setError(result.error || 'Failed to execute command');
        setIsRunning(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsRunning(false);
    }
  };

  const handleResumeSession = async (sessionId: string) => {
    if (!projectPath) {
      setError('Project path is required');
      return;
    }

    setSelectedSessionId(sessionId);
    setIsRunning(true);
    setError(null);
    setEvents([]);
    setErrors([]);
    setCurrentPid(null);

    try {
      // Resume with empty query to continue the session
      const result = await window.claudeAPI.executeClaudeCommand(
        projectPath,
        query || '', // Use current query or empty string
        sessionId
      );

      if (result.success && result.pid) {
        setCurrentPid(result.pid);
      } else if (!result.success) {
        setError(result.error || 'Failed to resume session');
        setIsRunning(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsRunning(false);
    }
  };

  const handleLoadSessionToOutput = async (sessionId: string) => {
    if (!projectPath) {
      setError('Project path is required');
      return;
    }

    try {
      // Load session logs
      const sessionLogs = await window.claudeSessionsAPI.readLog(projectPath, sessionId);

      // Convert session logs to stream events and append to current events
      const streamEvents: StreamEvent[] = sessionLogs
        .filter((entry) => entry.type !== 'summary') // Filter out summary entries
        .map((entry) => entry as unknown as StreamEvent); // Type assertion for compatibility

      setEvents((prev) => [...prev, ...streamEvents]);
      setSelectedSessionId(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session logs');
      console.error('Failed to load session logs:', err);
    }
  };

  // Event listeners - setup once
  useEffect(() => {
    window.claudeAPI.onClaudeStarted((data) => {
      console.log('[ExecutePage] Claude started:', data);
      setIsRunning(true);
      setCurrentPid(data.pid);
    });

    window.claudeAPI.onClaudeStream((data) => {
      setEvents((prev) => [...prev, data.data]);
    });

    window.claudeAPI.onClaudeError((data) => {
      console.error('[ExecutePage] Claude error:', data);
      setError(data.error);
      setErrors((prev) => [...prev, { id: Date.now().toString(), message: data.error }]);
    });

    window.claudeAPI.onClaudeComplete((data) => {
      console.log('[ExecutePage] Claude complete:', data);
      setIsRunning(false);
      setCurrentPid(null);
    });
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <div className={styles.inputGroup}>
          <label>Project Path</label>
          <div className={styles.pathInput}>
            <input
              type="text"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="/path/to/project"
              className={styles.input}
            />
            <button type="button" onClick={handleSelectDirectory} className={styles.browseButton}>
              Browse
            </button>
          </div>
        </div>

        {projectPath && (
          <div className={styles.sessionsList}>
            <div className={styles.sessionsHeader}>
              <label>Recent Sessions</label>
              <button
                type="button"
                onClick={handleRefreshSessions}
                className={styles.refreshButton}
                disabled={sessionsLoading}
              >
                {sessionsLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            {sessionsLoading && recentSessions.length === 0 ? (
              <div className={styles.noSessions}>
                Loading sessions...
              </div>
            ) : recentSessions.length === 0 ? (
              <div className={styles.noSessions}>
                No sessions for this project
              </div>
            ) : (
              <>
                <div className={styles.sessionsContainer}>
                  {recentSessions.map((session) => (
                    <div
                      key={session.sessionId}
                      className={`${styles.sessionItem} ${selectedSessionId === session.sessionId ? styles.selected : ''}`}
                      onClick={() => setSelectedSessionId(session.sessionId)}
                    >
                      <div
                        className={styles.sessionItemContent}
                        onDoubleClick={() => handleLoadSessionToOutput(session.sessionId)}
                      >
                        <div className={styles.sessionItemId} title={session.sessionId}>
                          {session.sessionId}
                        </div>
                        {session.firstUserMessage && (
                          <div className={styles.sessionItemPreview} title={session.firstUserMessage}>
                            {session.firstUserMessage}
                          </div>
                        )}
                        <div className={styles.sessionItemTime}>
                          {new Date(session.lastModified).toLocaleString()}
                        </div>
                      </div>
                      <div className={styles.sessionItemActions}>
                        <button
                          type="button"
                          className={styles.loadButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadSessionToOutput(session.sessionId);
                          }}
                        >
                          Load to Output
                        </button>
                        <button
                          type="button"
                          className={styles.resumeButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResumeSession(session.sessionId);
                          }}
                          disabled={isRunning}
                        >
                          Resume
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {totalSessions > SESSIONS_PAGE_SIZE && (
                  <div className={styles.sessionsPagination}>
                    <Pagination
                      currentPage={sessionsPage}
                      totalItems={totalSessions}
                      pageSize={SESSIONS_PAGE_SIZE}
                      onPageChange={setSessionsPage}
                      itemName="sessions"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className={styles.inputGroup}>
          <label>Query</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your query..."
            className={styles.textarea}
            rows={3}
          />
        </div>

        <button
          type="button"
          onClick={handleExecute}
          disabled={isRunning}
          className={styles.executeButton}
        >
          {isRunning ? 'Running...' : 'Execute'}
        </button>

        {error && <div className={styles.error}>{error}</div>}

        {currentPid && <div className={styles.status}>Running (PID: {currentPid})</div>}
      </div>

      <div className={styles.output}>
        <StreamOutput events={events} errors={errors} currentPid={currentPid} />
      </div>
    </div>
  );
};
