import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { Pagination } from '../components/common/Pagination';
import type { ClaudeSessionInfo } from '../preload';
import {
  clearSessionsPagesCache,
  getCachedSessionsPage,
  setCachedSessionsPage,
} from '../services/cache';
import styles from './ClaudeSessionsListPage.module.css';

export const ClaudeSessionsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectDirName } = useParams<{ projectDirName: string }>();
  const [projectPath, setProjectPath] = useState<string>('');
  const [actualProjectPath, setActualProjectPath] = useState<string>(''); // Real cwd from session
  const [sessions, setSessions] = useState<ClaudeSessionInfo[]>([]);
  const [sessionsPage, setSessionsPage] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const SESSIONS_PAGE_SIZE = 20;

  // Decode projectDirName to get projectPath
  useEffect(() => {
    if (projectDirName) {
      // Convert projectDirName format to path
      // Example: -Users-junwoobang-project-name -> /Users/junwoobang/project-name
      const path = `/${projectDirName.replace(/^-/, '').replace(/-/g, '/')}`;
      setProjectPath(path);
    }
  }, [projectDirName]);

  const loadSessions = useCallback(
    async (page: number) => {
      if (!projectPath) return;

      setSessionsLoading(true);
      try {
        const cached = await getCachedSessionsPage(projectPath, page, SESSIONS_PAGE_SIZE);

        if (cached) {
          setSessions(cached.sessions);
          setTotalSessions(cached.total);

          // Update actual project path from cached sessions
          const sessionWithCwd = cached.sessions.find((s) => s.cwd && s.hasData);
          if (sessionWithCwd?.cwd && !actualProjectPath) {
            setActualProjectPath(sessionWithCwd.cwd);
          }

          setSessionsLoading(false);
          return;
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

        setSessions(sessionsWithMetadata);
        setTotalSessions(result.total);

        // Update actual project path from first valid session cwd
        const sessionWithCwd = sessionsWithMetadata.find((s) => s.cwd && s.hasData);
        if (sessionWithCwd?.cwd && !actualProjectPath) {
          setActualProjectPath(sessionWithCwd.cwd);
        }

        await setCachedSessionsPage(
          projectPath,
          page,
          SESSIONS_PAGE_SIZE,
          sessionsWithMetadata,
          result.total,
          result.hasMore,
        );
      } catch (error) {
        console.error('Failed to load sessions:', error);
        setSessions([]);
        setTotalSessions(0);
      } finally {
        setSessionsLoading(false);
      }
    },
    [projectPath, actualProjectPath],
  );

  useEffect(() => {
    if (projectPath) {
      loadSessions(sessionsPage);
    }
  }, [projectPath, sessionsPage, loadSessions]);

  const handleBackToProjects = () => {
    navigate('/claude-projects');
  };

  const handleSessionClick = (session: ClaudeSessionInfo) => {
    if (projectDirName) {
      navigate(`/claude-projects/${projectDirName}/sessions/${session.sessionId}`);
    }
  };

  const handleViewAnalysis = (session: ClaudeSessionInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    if (projectDirName) {
      navigate(`/claude-projects/${projectDirName}/sessions/${session.sessionId}/analysis`);
    }
  };

  const handleCopySessionId = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sessionId);
    toast.success('Session ID copied to clipboard!');
  };

  const handleRefreshSessions = async () => {
    if (!projectPath) return;
    await clearSessionsPagesCache(projectPath);
    await loadSessions(sessionsPage);
  };

  const handleOpenFolder = async () => {
    // Use actual cwd from session data, fallback to parsed path
    const pathToOpen = actualProjectPath || projectPath;
    if (!pathToOpen) return;

    try {
      await window.claudeSessionsAPI.openProjectFolder(pathToOpen);
    } catch (error) {
      console.error('Failed to open project folder:', error);
      toast.error('Failed to open project folder');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button type="button" onClick={handleBackToProjects} className={styles.backButton}>
            ← Back to Projects
          </button>
        </div>
        <h3>{actualProjectPath || projectPath}</h3>
        <div className={styles.headerRight}>
          <button type="button" onClick={handleOpenFolder} className={styles.button}>
            Open Folder
          </button>
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
          sessions.map((session) => {
            const isLoading =
              !session.hasData &&
              session.cwd === undefined &&
              session.firstUserMessage === undefined;
            return (
              <button
                type="button"
                key={session.sessionId}
                className={`${styles.sessionCard} ${!session.hasData && !isLoading ? styles.emptySession : ''} ${isLoading ? styles.loading : ''}`}
                onClick={() => handleSessionClick(session)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSessionClick(session);
                  }
                }}
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
                          ? `${session.firstUserMessage.substring(0, 100)}...`
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

                {session.hasData && (
                  <button
                    type="button"
                    className={styles.analysisButton}
                    onClick={(e) => handleViewAnalysis(session, e)}
                    title="View Session Analysis"
                  >
                    📊 View Analysis
                  </button>
                )}
              </button>
            );
          })
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
};
