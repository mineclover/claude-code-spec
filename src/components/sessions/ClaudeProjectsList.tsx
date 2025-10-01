import type React from 'react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { ClaudeProjectInfo, ClaudeSessionInfo } from '../../preload';
import styles from './ClaudeProjectsList.module.css';
import { SessionLogViewer } from './SessionLogViewer';

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
}) => {
  const [selectedProject, setSelectedProject] = useState<ClaudeProjectInfo | null>(null);
  const [selectedSession, setSelectedSession] = useState<ClaudeSessionInfo | null>(null);
  const [viewingLogs, setViewingLogs] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  const handleProjectClick = (project: ClaudeProjectInfo) => {
    setSelectedProject(project);
    setSelectedSession(null);
    setViewingLogs(false);
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    setSelectedSession(null);
    setViewingLogs(false);
  };

  const handleSessionClick = (session: ClaudeSessionInfo) => {
    setSelectedSession(session);
    setViewingLogs(true);
  };

  const handleBackToSessions = () => {
    setSelectedSession(null);
    setViewingLogs(false);
  };

  const handleCopySessionId = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sessionId);
    toast.success('Session ID copied to clipboard!');
  };

  // Calculate pagination info
  const totalPages = Math.ceil(totalProjects / pageSize);

  const handleProjectPageChange = (newPage: number) => {
    if (onPageChange) {
      onPageChange(newPage);
    }
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
          <button type="button" onClick={handleBackToProjects} className={styles.backButton}>
            ← Back to Projects
          </button>
          <h3>{selectedProject.projectPath}</h3>
        </div>

        <div className={styles.sessionsGrid}>
          {selectedProject.sessions.length === 0 ? (
            <div className={styles.empty}>No sessions for this project</div>
          ) : (
            <>
              {selectedProject.sessions.map((session) => {
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
            <button type="button" onClick={onRefresh} className={styles.button}>
              Refresh
            </button>
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
              <div
                key={project.projectPath}
                className={styles.projectCard}
                onClick={() => handleProjectClick(project)}
              >
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
            );
          })
        )}
      </div>

      {totalProjects > pageSize && (
        <div className={styles.paginationContainer}>
          <div className={styles.paginationInfo}>
            <span className={styles.sessionCount}>
              Page {currentPage + 1} of {totalPages} • Total {totalProjects} projects
            </span>
          </div>
          <div className={styles.paginationControls}>
            <button
              type="button"
              onClick={() => handleProjectPageChange(0)}
              className={styles.paginationButton}
              disabled={currentPage === 0}
            >
              ««
            </button>
            <button
              type="button"
              onClick={() => handleProjectPageChange(currentPage - 1)}
              className={styles.paginationButton}
              disabled={currentPage === 0}
            >
              ‹ Prev
            </button>
            <div className={styles.pageNumbers}>
              {Array.from({ length: totalPages }, (_, i) => {
                // Show max 7 pages: current +/- 2
                if (
                  i === 0 ||
                  i === totalPages - 1 ||
                  (i >= currentPage - 2 && i <= currentPage + 2)
                ) {
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleProjectPageChange(i)}
                      className={`${styles.pageNumber} ${i === currentPage ? styles.active : ''}`}
                    >
                      {i + 1}
                    </button>
                  );
                }
                if (i === currentPage - 3 || i === currentPage + 3) {
                  return <span key={i} className={styles.ellipsis}>...</span>;
                }
                return null;
              })}
            </div>
            <button
              type="button"
              onClick={() => handleProjectPageChange(currentPage + 1)}
              className={styles.paginationButton}
              disabled={currentPage >= totalPages - 1}
            >
              Next ›
            </button>
            <button
              type="button"
              onClick={() => handleProjectPageChange(totalPages - 1)}
              className={styles.paginationButton}
              disabled={currentPage >= totalPages - 1}
            >
              »»
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
