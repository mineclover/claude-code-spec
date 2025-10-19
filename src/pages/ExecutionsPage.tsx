import type React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Pagination } from '../components/common/Pagination';
import { ExecutionsList } from '../components/execution/ExecutionsList';
import { useProject } from '../contexts/ProjectContext';
import type { StreamEvent } from '../lib/types';
import { getCachedSessionsPage, setCachedSessionsPage } from '../services/cache';
import type { ExecutionInfo, SkillListItem } from '../types/api';
import styles from './ExecutionsPage.module.css';

export const ExecutionsPage: React.FC = () => {
  const navigate = useNavigate();
  const projectPathInputId = useId();
  const queryInputId = useId();
  const mcpConfigSelectId = useId();
  const modelSelectId = useId();
  const skillSelectId = useId();
  const { projectPath: contextProjectPath, updateProject } = useProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projectPath, setProjectPath] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [mcpConfigs, setMcpConfigs] = useState<Array<{ name: string; path: string }>>([]);
  const [selectedMcpConfig, setSelectedMcpConfig] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<'sonnet' | 'opus'>('sonnet');
  const [availableSkills, setAvailableSkills] = useState<SkillListItem[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [selectedSkillScope, setSelectedSkillScope] = useState<'global' | 'project'>('project');
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

  const loadSkills = useCallback(async () => {
    if (!projectPath) {
      setAvailableSkills([]);
      return;
    }

    try {
      // Load both project and global skills
      const projectSkills = await window.skillAPI.listSkills('project', projectPath);
      const globalSkills = await window.skillAPI.listSkills('global');

      // Combine and mark scope
      const allSkills = [
        ...projectSkills.map(s => ({ ...s, scope: 'project' as const })),
        ...globalSkills.map(s => ({ ...s, scope: 'global' as const }))
      ];

      setAvailableSkills(allSkills);
    } catch (err) {
      console.error('Failed to load skills:', err);
      setAvailableSkills([]);
    }
  }, [projectPath]);

  const loadRecentSessions = useCallback(
    async (page: number, skipCache = false) => {
      if (!projectPath) return;

      setSessionsLoading(true);
      try {
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

        const result = await window.claudeSessionsAPI.getProjectSessionsPaginated(
          projectPath,
          page,
          SESSIONS_PAGE_SIZE,
        );

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

  useEffect(() => {
    const pathFromParams = searchParams.get('projectPath');
    if (pathFromParams) {
      setProjectPath(pathFromParams);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (contextProjectPath && contextProjectPath !== projectPath) {
      console.log('[ExecutionsPage] Syncing with ProjectContext:', contextProjectPath);
      setProjectPath(contextProjectPath);
    }
  }, [contextProjectPath, projectPath]);

  useEffect(() => {
    loadMcpConfigs();
    loadSkills();
  }, [loadMcpConfigs, loadSkills]);

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
      console.log('[ExecutionsPage] Selected project path:', path);
      setProjectPath(path);

      const dirName = path.split('/').filter(Boolean).pop() || path;
      console.log('[ExecutionsPage] Project dirName:', dirName);
      await updateProject(path, dirName);
    }
  };

  const handleExecute = async () => {
    if (!projectPath || !query) {
      setError('Please select a project directory and enter a query');
      return;
    }

    setError(null);

    try {
      const result = await window.claudeAPI.executeClaudeCommand(
        projectPath,
        query,
        undefined,
        selectedMcpConfig || undefined,
        selectedModel,
        selectedSkillId || undefined,
        selectedSkillScope,
      );

      if (result.success && result.sessionId) {
        setCurrentSessionId(result.sessionId);
        // Navigate to execution detail page
        navigate(`/executions/${result.sessionId}`);
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
    setError(null);

    try {
      const result = await window.claudeAPI.executeClaudeCommand(
        projectPath,
        query || '',
        sessionId,
        selectedMcpConfig || undefined,
        selectedModel,
        selectedSkillId || undefined,
        selectedSkillScope,
      );

      if (result.success && result.sessionId) {
        setCurrentSessionId(result.sessionId);
        // Navigate to execution detail page
        navigate(`/executions/${result.sessionId}`);
      } else if (!result.success) {
        setError(result.error || 'Failed to resume session');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const loadAllExecutions = useCallback(async () => {
    try {
      const executions = await window.claudeAPI.getAllExecutions();
      setAllExecutions(executions);
    } catch (err) {
      console.error('[ExecutionsPage] Failed to load executions:', err);
    }
  }, []);

  const switchToExecution = useCallback(
    (sessionId: string) => {
      navigate(`/executions/${sessionId}`);
    },
    [navigate],
  );

  const handleKillExecution = useCallback(async (sessionId: string) => {
    try {
      await window.claudeAPI.killExecution(sessionId);
      console.log('[ExecutionsPage] Killed execution:', sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to kill execution');
      console.error('[ExecutionsPage] Failed to kill execution:', err);
    }
  }, []);

  const handleCleanupExecution = useCallback(async (sessionId: string) => {
    try {
      await window.claudeAPI.cleanupExecution(sessionId);
      console.log('[ExecutionsPage] Cleaned up execution:', sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup execution');
      console.error('[ExecutionsPage] Failed to cleanup execution:', err);
    }
  }, []);

  const handleKillAll = useCallback(async () => {
    try {
      await window.claudeAPI.killAllExecutions();
      console.log('[ExecutionsPage] Killed all executions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to kill all executions');
      console.error('[ExecutionsPage] Failed to kill all executions:', err);
    }
  }, []);

  const handleCleanupAll = useCallback(async () => {
    try {
      await window.claudeAPI.cleanupAllCompleted();
      console.log('[ExecutionsPage] Cleaned up all completed executions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup all');
      console.error('[ExecutionsPage] Failed to cleanup all:', err);
    }
  }, []);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
    console.log('[ExecutionsPage] Current sessionId updated to:', currentSessionId);
  }, [currentSessionId]);

  useEffect(() => {
    console.log('[ExecutionsPage] Registering stream listeners');

    const handleStarted = (data: { sessionId: string; pid: number | null }) => {
      console.log('[ExecutionsPage] Claude started:', data);
    };

    const handleStream = (_data: { sessionId: string; data: StreamEvent }) => {
      // Stream events are now handled in ExecutionDetailPage
    };

    const handleError = (data: { sessionId: string; error: string }) => {
      console.error('[ExecutionsPage] Claude error:', data);
    };

    const handleComplete = (data: { sessionId: string; code: number }) => {
      console.log('[ExecutionsPage] Claude complete:', data);
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
  }, []);

  useEffect(() => {
    loadAllExecutions();

    const unsubExecutionsUpdated = window.claudeAPI.onExecutionsUpdated((executions) => {
      console.log('[ExecutionsPage] Executions updated:', executions.length);
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
                          onDoubleClick={() => handleResumeSession(session.sessionId)}
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
                          className={styles.resumeArrowButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResumeSession(session.sessionId);
                          }}
                          title="Resume Session"
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
          <label htmlFor={skillSelectId}>Skill (Optional)</label>
          <select
            id={skillSelectId}
            value={selectedSkillId}
            onChange={(e) => {
              const skillId = e.target.value;
              setSelectedSkillId(skillId);
              // Set scope based on selected skill
              const skill = availableSkills.find(s => s.id === skillId);
              if (skill) {
                setSelectedSkillScope(skill.scope);
              }
            }}
            className={styles.select}
          >
            <option value="">None</option>
            {availableSkills.length > 0 && (
              <>
                <optgroup label="Project Skills">
                  {availableSkills.filter(s => s.scope === 'project').map((skill) => (
                    <option key={`project-${skill.id}`} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Global Skills">
                  {availableSkills.filter(s => s.scope === 'global').map((skill) => (
                    <option key={`global-${skill.id}`} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </optgroup>
              </>
            )}
          </select>
          {selectedSkillId && (
            <div className={styles.hint}>
              Skill context will be automatically included in your query
            </div>
          )}
        </div>

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
              <span className={styles.resumeButtonText}>Resume</span>
              <span className={styles.resumeButtonSession}>
                ({selectedSessionId.slice(0, 8)}...)
              </span>
            </button>
          )}
        </div>

        {error && <div className={styles.error}>{error}</div>}
      </div>
    </div>
  );
};
