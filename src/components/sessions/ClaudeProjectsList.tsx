import type React from 'react';
import { useState } from 'react';
import type { ClaudeProjectInfo, ClaudeSessionInfo } from '../../preload';
import styles from './ClaudeProjectsList.module.css';
import { SessionLogViewer } from './SessionLogViewer';

interface ClaudeProjectsListProps {
  projects: ClaudeProjectInfo[];
  onRefresh?: () => void;
}

export const ClaudeProjectsList: React.FC<ClaudeProjectsListProps> = ({ projects, onRefresh }) => {
  const [expandedProjectPath, setExpandedProjectPath] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [viewingLogs, setViewingLogs] = useState(false);

  const handleProjectClick = (project: ClaudeProjectInfo) => {
    if (expandedProjectPath === project.projectPath) {
      // Collapse if already expanded
      setExpandedProjectPath(null);
      setExpandedSessionId(null);
    } else {
      // Expand new project
      setExpandedProjectPath(project.projectPath);
      setExpandedSessionId(null);
    }
    setViewingLogs(false);
  };

  const handleSessionClick = (session: ClaudeSessionInfo) => {
    if (expandedSessionId === session.sessionId) {
      // Collapse if already expanded
      setExpandedSessionId(null);
    } else {
      // Expand new session
      setExpandedSessionId(session.sessionId);
    }
  };

  const handleViewLogs = (project: ClaudeProjectInfo, session: ClaudeSessionInfo) => {
    setViewingLogs(true);
  };

  const getExpandedProject = () => {
    return projects.find((p) => p.projectPath === expandedProjectPath);
  };

  const getExpandedSession = () => {
    const project = getExpandedProject();
    if (!project) return null;
    return project.sessions.find((s) => s.sessionId === expandedSessionId);
  };

  // Show log viewer if viewing logs
  const expandedProject = getExpandedProject();
  const expandedSession = getExpandedSession();

  if (viewingLogs && expandedSession && expandedProject) {
    return (
      <SessionLogViewer
        projectPath={expandedProject.projectPath}
        sessionId={expandedSession.sessionId}
        onClose={() => setViewingLogs(false)}
      />
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Claude CLI Projects</h3>
        {onRefresh && (
          <button type="button" onClick={onRefresh} className={styles.button}>
            Refresh
          </button>
        )}
      </div>

      <div className={styles.accordionList}>
        {projects.length === 0 ? (
          <div className={styles.empty}>No Claude projects found</div>
        ) : (
          projects.map((project) => (
            <div key={project.projectPath} className={styles.accordionItem}>
              {/* Project Header */}
              <div
                className={`${styles.projectHeader} ${
                  expandedProjectPath === project.projectPath ? styles.expanded : ''
                }`}
                onClick={() => handleProjectClick(project)}
              >
                <span className={styles.chevron}>
                  {expandedProjectPath === project.projectPath ? '▼' : '▶'}
                </span>
                <div className={styles.projectHeaderContent}>
                  <div className={styles.projectPath}>{project.projectPath}</div>
                  <div className={styles.projectInfo}>
                    {project.sessions.length} session{project.sessions.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Sessions List (Collapsible) */}
              {expandedProjectPath === project.projectPath && (
                <div className={styles.sessionsContainer}>
                  {project.sessions.length === 0 ? (
                    <div className={styles.empty}>No sessions for this project</div>
                  ) : (
                    project.sessions.map((session) => (
                      <div key={session.sessionId} className={styles.sessionAccordionItem}>
                        {/* Session Header */}
                        <div
                          className={`${styles.sessionHeader} ${
                            expandedSessionId === session.sessionId ? styles.expanded : ''
                          }`}
                          onClick={() => handleSessionClick(session)}
                        >
                          <span className={styles.chevron}>
                            {expandedSessionId === session.sessionId ? '▼' : '▶'}
                          </span>
                          <div className={styles.sessionHeaderContent}>
                            <div className={styles.sessionId}>{session.sessionId}</div>
                            <div className={styles.sessionMeta}>
                              <span>{new Date(session.lastModified).toLocaleString()}</span>
                              <span>{(session.fileSize / 1024).toFixed(1)} KB</span>
                            </div>
                          </div>
                        </div>

                        {/* Session Detail (Collapsible) */}
                        {expandedSessionId === session.sessionId && (
                          <div className={styles.sessionDetailContainer}>
                            <div className={styles.detailContent}>
                              <div className={styles.detailSection}>
                                <label>Session ID:</label>
                                <code>{session.sessionId}</code>
                              </div>
                              <div className={styles.detailSection}>
                                <label>Project:</label>
                                <code>{project.projectPath}</code>
                              </div>
                              <div className={styles.detailSection}>
                                <label>File Path:</label>
                                <code className={styles.filePath}>{session.filePath}</code>
                              </div>
                              <div className={styles.detailSection}>
                                <label>File Size:</label>
                                <span>{(session.fileSize / 1024).toFixed(2)} KB</span>
                              </div>
                              <div className={styles.detailSection}>
                                <label>Last Modified:</label>
                                <span>{new Date(session.lastModified).toLocaleString()}</span>
                              </div>
                              <div className={styles.detailActions}>
                                <button
                                  type="button"
                                  onClick={() => handleViewLogs(project, session)}
                                  className={styles.button}
                                >
                                  View Full Logs
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
