import type React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pagination } from '../components/common/Pagination';
import { ExecutionsList } from '../components/execution/ExecutionsList';
import { StreamOutput } from '../components/stream/StreamOutput';
import { useProject } from '../contexts/ProjectContext';
import type { StreamEvent } from '../lib/types';
import { getCachedSessionsPage, setCachedSessionsPage } from '../services/cache';
import type { ExecutionInfo } from '../types/api';
import styles from './ExecutePage.module.css';

export const ExecutePage: React.FC = () => {
  const projectPathInputId = useId();
  const queryInputId = useId();
  const mcpConfigSelectId = useId();
  const modelSelectId = useId();
  const { projectPath: contextProjectPath, updateProject } = useProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projectPath, setProjectPath] = useState('');
  const [query, setQuery] = useState('');
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [errors, setErrors] = useState<Array<{ id: string; message: string }>>([]);
  const [_isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentPid, setCurrentPid] = useState<number | null>(null);
  const [mcpConfigs, setMcpConfigs] = useState<Array<{ name: string; path: string }>>([]);
  const [selectedMcpConfig, setSelectedMcpConfig] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<'sonnet' | 'opus'>('sonnet');
  const [recentSessions, setRecentSessions] = useState<
    Array<{ sessionId: string; firstUserMessage?: string; lastModified: number }>
  >([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionsPage, setSessionsPage] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsExpanded, setSessionsExpanded] = useState(true);
  const [allExecutions, setAllExecutions] = useState<Array<Omit<ExecutionInfo, 'events'>>>([]);
  const [showAllExecutions, setShowAllExecutions] = useState(false);
  const [executionsExpanded, setExecutionsExpanded] = useState(true);
  const SESSIONS_PAGE_SIZE = 5;

  // Ref to track current sessionId for event listeners
  const currentSessionIdRef = useRef<string | null>(null);

  const loadMcpConfigs = useCallback(async () => {
    if (!projectPath) {
      setMcpConfigs([]);
      return;
    }

    try {
      const configs = await window.settingsAPI.listMcpConfigs(projectPath);
      setMcpConfigs(configs.map((c) => ({ name: c.name, path: `.claude/${c.name}` })));
    } catch (err) {
      console.error('Failed to load MCP configs:', err);
      setMcpConfigs([]);
    }
  }, [projectPath]);

  const loadRecentSessions = useCallback(
    async (page: number, skipCache = false) => {
      if (!projectPath) return;

      setSessionsLoading(true);
      try {
        // Try cache first (unless refresh is requested)
        if (!skipCache) {
          const cached = await getCachedSessionsPage(projectPath, page, SESSIONS_PAGE_SIZE);

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
          SESSIONS_PAGE_SIZE,
        );

        // Get metadata for each session
        const sessionsWithMetadata = await Promise.all(
          result.sessions.map(async (session) => {
            try {
              const metadata = await window.claudeSessionsAPI.getSessionMetadata(
                projectPath,
                session.sessionId,
              );
              return { ...session, ...metadata };
            } catch (error) {
              console.error('Failed to load session metadata:', error);
              return { ...session, hasData: false };
            }
          }),
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
          result.hasMore,
        );
      } catch (err) {
        console.error('Failed to load recent sessions:', err);
        setRecentSessions([]);
        setTotalSessions(0);
      } finally {
        setSessionsLoading(false);
      }
    },
    [projectPath],
  );

  // Handle projectPath from URL params
  useEffect(() => {
    const pathFromParams = searchParams.get('projectPath');
    if (pathFromParams) {
      setProjectPath(pathFromParams);
      // Clear the URL parameter after setting
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Sync with ProjectContext when it changes
  useEffect(() => {
    if (contextProjectPath && contextProjectPath !== projectPath) {
      console.log('[ExecutePage] Syncing with ProjectContext:', contextProjectPath);
      setProjectPath(contextProjectPath);
    }
  }, [contextProjectPath, projectPath]);

  // Load MCP configs when projectPath changes
  useEffect(() => {
    loadMcpConfigs();
  }, [loadMcpConfigs]);

  // Load recent sessions when projectPath or page changes
  useEffect(() => {
    if (projectPath) {
      loadRecentSessions(sessionsPage);
    } else {
      setRecentSessions([]);
      setSelectedSessionId(null);
      setTotalSessions(0);
    }
  }, [projectPath, sessionsPage, loadRecentSessions]);

  const handleRefreshSessions = () => {
    loadRecentSessions(sessionsPage, true);
  };

  const handleSelectDirectory = async () => {
    const path = await window.claudeAPI.selectDirectory();
    if (path) {
      console.log('[ExecutePage] Selected project path:', path);
      setProjectPath(path);

      // Update ProjectContext (auto-saves to main process)
      const dirName = path.split('/').filter(Boolean).pop() || path;
      console.log('[ExecutePage] Project dirName:', dirName);
      await updateProject(path, dirName);
    }
  };

  const handleExecute = async () => {
    if (!projectPath || !query) {
      setError('Please select a project directory and enter a query');
      return;
    }

    // Clear current view
    setError(null);
    setEvents([]);
    setErrors([]);
    setCurrentSessionId(null);
    setCurrentPid(null);

    try {
      // Execute always starts a new session (no resume)
      const result = await window.claudeAPI.executeClaudeCommand(
        projectPath,
        query,
        undefined, // Always undefined for Execute - never resume
        selectedMcpConfig || undefined, // Pass selected MCP config
        selectedModel, // Pass selected model
      );

      if (result.success && result.sessionId) {
        // Subscribe to the new execution
        setCurrentSessionId(result.sessionId);
        setCurrentPid(result.pid ?? null);
        setIsRunning(true);
      } else if (!result.success) {
        setError(result.error || 'Failed to execute command');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
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
    setCurrentSessionId(null);
    setCurrentPid(null);

    try {
      // Resume with empty query to continue the session
      const result = await window.claudeAPI.executeClaudeCommand(
        projectPath,
        query || '', // Use current query or empty string
        sessionId,
        selectedMcpConfig || undefined, // Pass selected MCP config
        selectedModel, // Pass selected model
      );

      if (result.success && result.sessionId) {
        setCurrentSessionId(result.sessionId);
        setCurrentPid(result.pid ?? null);
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

      // Convert session logs to stream events and replace current events
      const streamEvents: StreamEvent[] = sessionLogs
        .filter((entry) => entry.type !== 'summary') // Filter out summary entries
        .map((entry) => entry as unknown as StreamEvent); // Type assertion for compatibility

      setEvents(streamEvents); // Replace instead of append
      setSelectedSessionId(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session logs');
      console.error('Failed to load session logs:', err);
    }
  };

  // Load all executions (only called on initial mount)
  const loadAllExecutions = useCallback(async () => {
    try {
      const executions = await window.claudeAPI.getAllExecutions();
      setAllExecutions(executions);
    } catch (err) {
      console.error('[ExecutePage] Failed to load executions:', err);
    }
  }, []);

  // Switch to a different execution
  const switchToExecution = useCallback(async (sessionId: string) => {
    try {
      // Get full execution info with events
      const execution = await window.claudeAPI.getExecution(sessionId);

      if (!execution) {
        setError('Execution not found');
        return;
      }

      console.log('[ExecutePage] Switching to execution:', sessionId, 'status:', execution.status);

      // Load existing events from execution
      setEvents(execution.events);
      setErrors([]);
      setError(null);

      // Update current session (this will trigger stream subscription in useEffect)
      setCurrentSessionId(sessionId);
      setCurrentPid(execution.pid);
      setIsRunning(execution.status === 'running' || execution.status === 'pending');

      console.log(
        '[ExecutePage] Switched to execution:',
        sessionId,
        'with',
        execution.events.length,
        'events',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch execution');
      console.error('[ExecutePage] Failed to switch execution:', err);
    }
  }, []);

  // Kill a specific execution
  const handleKillExecution = useCallback(async (sessionId: string) => {
    try {
      await window.claudeAPI.killExecution(sessionId);
      console.log('[ExecutePage] Killed execution:', sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to kill execution');
      console.error('[ExecutePage] Failed to kill execution:', err);
    }
  }, []);

  // Cleanup a specific execution
  const handleCleanupExecution = useCallback(async (sessionId: string) => {
    try {
      await window.claudeAPI.cleanupExecution(sessionId);
      console.log('[ExecutePage] Cleaned up execution:', sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup execution');
      console.error('[ExecutePage] Failed to cleanup execution:', err);
    }
  }, []);

  // Kill all active executions
  const handleKillAll = useCallback(async () => {
    try {
      await window.claudeAPI.killAllExecutions();
      console.log('[ExecutePage] Killed all executions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to kill all executions');
      console.error('[ExecutePage] Failed to kill all executions:', err);
    }
  }, []);

  // Cleanup all completed executions
  const handleCleanupAll = useCallback(async () => {
    try {
      await window.claudeAPI.cleanupAllCompleted();
      console.log('[ExecutePage] Cleaned up all completed executions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup all');
      console.error('[ExecutePage] Failed to cleanup all:', err);
    }
  }, []);

  // Update ref when currentSessionId changes
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
    console.log('[ExecutePage] Current sessionId updated to:', currentSessionId);
  }, [currentSessionId]);

  // Event listeners - register once, filter by ref
  useEffect(() => {
    console.log('[ExecutePage] Registering stream listeners');

    const handleStarted = (data: { sessionId: string; pid: number | null }) => {
      console.log('[ExecutePage] Claude started:', data);
      // Update state if this is our current execution
      if (data.sessionId === currentSessionIdRef.current) {
        setIsRunning(true);
        setCurrentPid(data.pid);
      }
    };

    const handleStream = (data: { sessionId: string; data: StreamEvent }) => {
      // Only process events for current execution
      if (data.sessionId === currentSessionIdRef.current) {
        console.log('[ExecutePage] Stream event for current session:', data.sessionId);
        setEvents((prev) => [...prev, data.data]);
      }
    };

    const handleError = (data: { sessionId: string; error: string }) => {
      console.error('[ExecutePage] Claude error:', data);
      // Only process errors for current execution
      if (data.sessionId === currentSessionIdRef.current) {
        setError(data.error);
        setErrors((prev) => [...prev, { id: Date.now().toString(), message: data.error }]);
      }
    };

    const handleComplete = (data: { sessionId: string; code: number }) => {
      console.log('[ExecutePage] Claude complete:', data);
      // Only update state if this is our current execution
      if (data.sessionId === currentSessionIdRef.current) {
        setIsRunning(false);
        console.log(
          '[ExecutePage] Execution completed for current session:',
          currentSessionIdRef.current,
        );
      }
    };

    const unsubStarted = window.claudeAPI.onClaudeStarted(handleStarted);
    const unsubStream = window.claudeAPI.onClaudeStream(handleStream);
    const unsubError = window.claudeAPI.onClaudeError(handleError);
    const unsubComplete = window.claudeAPI.onClaudeComplete(handleComplete);

    // Cleanup: remove all event listeners on unmount
    return () => {
      unsubStarted();
      unsubStream();
      unsubError();
      unsubComplete();
    };
  }, []); // Empty dependency array - register only once

  // Subscribe to executions updates (event-based, no polling)
  useEffect(() => {
    loadAllExecutions(); // Initial load

    // Subscribe to real-time updates
    const unsubExecutionsUpdated = window.claudeAPI.onExecutionsUpdated((executions) => {
      console.log('[ExecutePage] Executions updated:', executions.length);
      setAllExecutions(executions);
    });

    // Cleanup: remove event listener on unmount
    return () => {
      unsubExecutionsUpdated();
    };
  }, [loadAllExecutions]);

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <div className={styles.inputGroup}>
          <label htmlFor={projectPathInputId}>Project Path</label>
          <div className={styles.pathInput}>
            <input
              id={projectPathInputId}
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

        <ExecutionsList
          executions={allExecutions}
          currentSessionId={currentSessionId}
          onSelectExecution={switchToExecution}
          onKillExecution={handleKillExecution}
          onCleanupExecution={handleCleanupExecution}
          onKillAll={handleKillAll}
          onCleanupAll={handleCleanupAll}
          showAll={showAllExecutions}
          onToggleShowAll={() => setShowAllExecutions(!showAllExecutions)}
          expanded={executionsExpanded}
          onToggleExpanded={() => setExecutionsExpanded(!executionsExpanded)}
        />

        {projectPath && (
          <div className={styles.sessionsList}>
            <div className={styles.sessionsHeader}>
              <div className={styles.sessionsLabel}>Recent Sessions</div>
              <div className={styles.sessionsHeaderActions}>
                <button
                  type="button"
                  onClick={() => setSessionsExpanded(!sessionsExpanded)}
                  className={styles.toggleButton}
                  title={sessionsExpanded ? 'Collapse' : 'Expand'}
                >
                  {sessionsExpanded ? '▼' : '▶'}
                </button>
                <button
                  type="button"
                  onClick={handleRefreshSessions}
                  className={styles.refreshButton}
                  disabled={sessionsLoading}
                >
                  {sessionsLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>
            {sessionsExpanded &&
              (sessionsLoading && recentSessions.length === 0 ? (
                <div className={styles.noSessions}>Loading sessions...</div>
              ) : recentSessions.length === 0 ? (
                <div className={styles.noSessions}>No sessions for this project</div>
              ) : (
                <>
                  <div className={styles.sessionsContainer}>
                    {recentSessions.map((session) => (
                      <div
                        key={session.sessionId}
                        className={`${styles.sessionItem} ${selectedSessionId === session.sessionId ? styles.selected : ''}`}
                      >
                        <button
                          type="button"
                          className={styles.sessionItemContent}
                          onClick={() => setSelectedSessionId(session.sessionId)}
                          onDoubleClick={() => handleLoadSessionToOutput(session.sessionId)}
                          aria-label={`Select session ${session.sessionId}`}
                        >
                          <div className={styles.sessionItemId} title={session.sessionId}>
                            {session.sessionId}
                          </div>
                          {session.firstUserMessage && (
                            <div
                              className={styles.sessionItemPreview}
                              title={session.firstUserMessage}
                            >
                              {session.firstUserMessage}
                            </div>
                          )}
                          <div className={styles.sessionItemTime}>
                            {new Date(session.lastModified).toLocaleString()}
                          </div>
                        </button>
                        <button
                          type="button"
                          className={styles.loadArrowButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadSessionToOutput(session.sessionId);
                          }}
                          title="Load to Output"
                        >
                          →
                        </button>
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
              ))}
          </div>
        )}

        <div className={styles.inputGroup}>
          <label htmlFor={mcpConfigSelectId}>MCP Configuration</label>
          <select
            id={mcpConfigSelectId}
            value={selectedMcpConfig}
            onChange={(e) => setSelectedMcpConfig(e.target.value)}
            className={styles.select}
          >
            <option value="">None (default permissions)</option>
            {mcpConfigs.map((config) => (
              <option key={config.path} value={config.path}>
                {config.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor={modelSelectId}>Model</label>
          <select
            id={modelSelectId}
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as 'sonnet' | 'opus')}
            className={styles.select}
          >
            <option value="sonnet">Sonnet (Default - Balanced)</option>
            <option value="opus">Opus (Most Capable)</option>
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor={queryInputId}>Query</label>
          <textarea
            id={queryInputId}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your query..."
            className={styles.textarea}
            rows={3}
          />
        </div>

        <div className={styles.actionButtons}>
          <button
            type="button"
            onClick={handleExecute}
            disabled={!projectPath || !query}
            className={styles.executeButton}
          >
            Execute
          </button>
          {selectedSessionId && (
            <button
              type="button"
              onClick={() => handleResumeSession(selectedSessionId)}
              disabled={!projectPath}
              className={styles.resumeButton}
            >
              Resume
            </button>
          )}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {currentSessionId && (
          <div className={styles.status}>
            Running (Session: {currentSessionId.slice(0, 8)}...
            {currentPid ? `, PID: ${currentPid}` : ''})
          </div>
        )}
      </div>

      <div className={styles.output}>
        <StreamOutput
          events={events}
          errors={errors}
          currentPid={currentPid}
          sessionId={currentSessionId}
        />
      </div>
    </div>
  );
};
