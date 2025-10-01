import type React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { ClaudeProjectInfo, ClaudeSessionInfo } from '../../preload';
import { useProject } from '../../contexts/ProjectContext';
import styles from './ClaudeProjectsList.module.css';
import { SessionLogViewer } from './SessionLogViewer';
import { Pagination } from '../common/Pagination';
import {
  getCachedSessionsPage,
  setCachedSessionsPage,
  clearSessionsPagesCache,
} from '../../services/cache';

type SortOption = 'recent' | 'oldest' | 'name';

interface ClaudeProjectsListProps {
  projects: ClaudeProjectInfo[];
  onRefresh?: () => void;
  currentPage?: number;
  totalProjects?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  loading?: boolean;
  initialLoading?: boolean;
  lastUpdated?: number | null;
}

export const ClaudeProjectsList: React.FC<ClaudeProjectsListProps> = ({
  projects,
  onRefresh,
  currentPage = 0,
  totalProjects = 0,
  pageSize = 10,
  onPageChange,
  loading = false,
  initialLoading = false,
  lastUpdated = null,
}) => {
  const navigate = useNavigate();
  const { updateProject } = useProject();
  const { projectDirName, sessionId } = useParams<{ projectDirName?: string; sessionId?: string }>();
  const [selectedProject, setSelectedProject] = useState<ClaudeProjectInfo | null>(null);
  const [selectedSession, setSelectedSession] = useState<ClaudeSessionInfo | null>(null);
  const [viewingLogs, setViewingLogs] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  // Sessions pagination state
  const [sessions, setSessions] = useState<ClaudeSessionInfo[]>([]);
  const [sessionsPage, setSessionsPage] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const SESSIONS_PAGE_SIZE = 20;

  // Initialize from URL path params on mount
  useEffect(() => {
    if (projectDirName) {
      // Find project from list by projectDirName
      const project = projects.find(p => p.projectDirName === projectDirName);
      if (project) {
        setSelectedProject(project);

        if (sessionId) {
          // Will load session after sessions are loaded
          setViewingLogs(true);
        }
      }
    }
  }, [projects, projectDirName, sessionId]); // Run when projects or URL params change

  // Load sessions when project selected or page changes
  useEffect(() => {
    if (selectedProject) {
      loadSessions(sessionsPage);
    }
  }, [selectedProject, sessionsPage]);

  // Load specific session from URL after sessions are loaded
  useEffect(() => {
    if (sessionId && sessions.length > 0 && !selectedSession) {
      const session = sessions.find(s => s.sessionId === sessionId);
      if (session) {
        setSelectedSession(session);
        setViewingLogs(true);
      }
    }
  }, [sessions, sessionId]);

  const loadSessions = async (page: number) => {
    if (!selectedProject) return;

    setSessionsLoading(true);
    try {
      // Try cache first
      const cached = await getCachedSessionsPage(
        selectedProject.projectPath,
        page,
        SESSIONS_PAGE_SIZE
      );

      if (cached) {
        setSessions(cached.sessions);
        setTotalSessions(cached.total);
        setSessionsLoading(false);
        return;
      }

      // Fetch from backend
      const result = await window.claudeSessionsAPI.getProjectSessionsPaginated(
        selectedProject.projectPath,
        page,
        SESSIONS_PAGE_SIZE
      );

      // Get metadata for each session
      const sessionsWithMetadata = await Promise.all(
        result.sessions.map(async (session) => {
          try {
            const metadata = await window.claudeSessionsAPI.getSessionMetadata(
              selectedProject.projectPath,
              session.sessionId
            );
            return { ...session, ...metadata };
          } catch (error) {
            console.error('Failed to load session metadata:', error);
            return { ...session, hasData: false };
          }
        })
      );

      setSessions(sessionsWithMetadata);
      setTotalSessions(result.total);

      // Cache the result
      await setCachedSessionsPage(
        selectedProject.projectPath,
        page,
        SESSIONS_PAGE_SIZE,
        sessionsWithMetadata,
        result.total,
        result.hasMore
      );
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setSessions([]);
      setTotalSessions(0);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleProjectClick = (project: ClaudeProjectInfo) => {
    setSelectedProject(project);
    setSelectedSession(null);
    setViewingLogs(false);
    setSessionsPage(0); // Reset to first page
    setSessions([]);
    setTotalSessions(0);

    // Navigate to project path
    navigate(`/claude-projects/${project.projectDirName}`);
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    setSelectedSession(null);
    setViewingLogs(false);
    setSessionsPage(0);
    setSessions([]);
    setTotalSessions(0);

    // Navigate back to projects list
    navigate('/claude-projects');
  };

  const handleSessionClick = (session: ClaudeSessionInfo) => {
    setSelectedSession(session);
    setViewingLogs(true);

    // Navigate to session path
    if (selectedProject) {
      navigate(`/claude-projects/${selectedProject.projectDirName}/${session.sessionId}`);
    }
  };

  const handleBackToSessions = () => {
    setSelectedSession(null);
    setViewingLogs(false);

    // Navigate back to project sessions
    if (selectedProject) {
      navigate(`/claude-projects/${selectedProject.projectDirName}`);
    }
  };

  const handleCopySessionId = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sessionId);
    toast.success('Session ID copied to clipboard!');
  };

  const handleUseInExecute = async (projectPath: string) => {
    console.log('[ClaudeProjectsList] Execute button clicked for:', projectPath);

    // Extract directory name from path
    const dirName = projectPath.split('/').filter(Boolean).pop() || projectPath;
    console.log('[ClaudeProjectsList] Project dirName:', dirName);

    // Update ProjectContext
    updateProject(projectPath, dirName);

    // Save to main process
    const result = await window.appSettingsAPI.setCurrentProject(projectPath, dirName);
    console.log('[ClaudeProjectsList] Saved to main process:', result);

    // Navigate to Execute page with projectPath in URL
    navigate(`/?projectPath=${encodeURIComponent(projectPath)}`);
    toast.success('Project loaded in Execute tab');
  };

  const handleProjectPageChange = (newPage: number) => {
    if (onPageChange) {
      onPageChange(newPage);
    }
  };

  const handleRefreshSessions = async () => {
    if (!selectedProject) return;

    // Clear cache for this project's sessions and reload
    await clearSessionsPagesCache(selectedProject.projectPath);
    await loadSessions(sessionsPage);
  };

  // Show log viewer if viewing logs
  if (viewingLogs && selectedSession && selectedProject) {
    return (
      <SessionLogViewer
        projectPath={selectedProject.projectPath}
        sessionId={selectedSession.sessionId}
        onClose={handleBackToSessions}
      />
    );
  }

  // Show sessions list view
  if (selectedProject) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <button type="button" onClick={handleBackToProjects} className={styles.backButton}>
              ← Back to Projects
            </button>
          </div>
          <h3>{selectedProject.projectPath}</h3>
          <div className={styles.headerRight}>
            <button type="button" onClick={handleRefreshSessions} className={styles.button}>
              Refresh
            </button>
          </div>
        </div>

        <div className={styles.sessionsGrid}>
          {sessionsLoading && sessions.length === 0 ? (
            <div className={styles.empty}>Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className={styles.empty}>No sessions for this project</div>
          ) : (
            <>
              {sessions.map((session) => {
                const isLoading = !session.hasData && session.cwd === undefined && session.firstUserMessage === undefined;
                return (
                <div
                  key={session.sessionId}
                  className={`${styles.sessionCard} ${!session.hasData && !isLoading ? styles.emptySession : ''} ${isLoading ? styles.loading : ''}`}
                  onClick={() => handleSessionClick(session)}
                >
                  <div className={styles.sessionIdContainer}>
                    <div className={styles.sessionId} title={session.sessionId}>
                      {session.sessionId}
                    </div>
                    <button
                      type="button"
                      className={styles.copyButton}
                      onClick={(e) => handleCopySessionId(session.sessionId, e)}
                      title="Copy Session ID"
                    >
                      📋
                    </button>
                  </div>

                  {!session.hasData ? (
                    <div className={styles.emptyBadge}>
                      <span className={styles.emptyIcon}>📭</span>
                      <span>No data available</span>
                    </div>
                  ) : (
                    <>
                      {session.firstUserMessage && (
                        <div className={styles.sessionPreview}>
                          {session.firstUserMessage.length > 100
                            ? session.firstUserMessage.substring(0, 100) + '...'
                            : session.firstUserMessage}
                        </div>
                      )}
                      {session.cwd && (
                        <div className={styles.sessionCwd} title={session.cwd}>
                          📁 {session.cwd}
                        </div>
                      )}
                    </>
                  )}

                  <div className={styles.sessionMeta}>
                    <span>{new Date(session.lastModified).toLocaleString()}</span>
                    <span>{(session.fileSize / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
                );
              })}
            </>
          )}
        </div>

        <Pagination
          currentPage={sessionsPage}
          totalItems={totalSessions}
          pageSize={SESSIONS_PAGE_SIZE}
          onPageChange={setSessionsPage}
          itemName="sessions"
        />
      </div>
    );
  }

  // Show projects list view
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Claude CLI Projects</h3>
        <div className={styles.headerControls}>
          <div className={styles.sortControls}>
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
            </select>
          </div>
          {onRefresh && (
            <div className={styles.refreshContainer}>
              <button type="button" onClick={onRefresh} className={styles.button}>
                Refresh
              </button>
              {lastUpdated && (
                <span className={styles.lastUpdated}>
                  Updated: {new Date(lastUpdated).toLocaleTimeString()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.projectsList}>
        {initialLoading ? (
          <div className={styles.empty}>Loading Claude projects...</div>
        ) : loading ? (
          <div className={styles.empty}>Loading...</div>
        ) : projects.length === 0 ? (
          <div className={styles.empty}>No Claude projects found</div>
        ) : (
          projects.map((project) => {
            const latestSession = project.sessions.length > 0 ? project.sessions[0] : null;
            return (
              <div key={project.projectPath} className={styles.projectCard}>
                <div onClick={() => handleProjectClick(project)} className={styles.projectCardContent}>
                  <div className={styles.projectPath}>{project.projectPath}</div>
                  <div className={styles.projectInfo}>
                    <span>
                      {project.sessions.length} session{project.sessions.length !== 1 ? 's' : ''}
                    </span>
                    {latestSession && (
                      <span className={styles.lastModified}>
                        Last: {new Date(latestSession.lastModified).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.useInExecuteButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUseInExecute(project.projectPath);
                  }}
                  title="Use in Execute tab"
                >
                  ▶ Execute
                </button>
              </div>
            );
          })
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={totalProjects}
        pageSize={pageSize}
        onPageChange={handleProjectPageChange}
        itemName="projects"
      />
    </div>
  );
};
