/**
 * Sessions Page
 * Inline project/session browser with multi-CLI tool support
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pagination } from '../components/common/Pagination';
import { ProgressBar } from '../components/common/ProgressBar';
import { ClassifiedLogEntry } from '../components/sessions/ClassifiedLogEntry';
import { useProject } from '../contexts/ProjectContext';
import { useToolContext } from '../contexts/ToolContext';
import { classifyEntry } from '../lib/sessionClassifier';
import type { ClaudeProjectInfo, ClaudeSessionEntry, ClaudeSessionInfo, SessionLoadProgress } from '../types/api/sessions';
import styles from './SessionsPage.module.css';

export function SessionsPage() {
  const { projectPath, updateProject } = useProject();
  const { selectedToolId } = useToolContext();
  const [projects, setProjects] = useState<ClaudeProjectInfo[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [projectPage, setProjectPage] = useState(0);
  const [sessions, setSessions] = useState<Omit<ClaudeSessionInfo, 'cwd' | 'firstUserMessage' | 'hasData'>[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [sessionPage, setSessionPage] = useState(0);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionLog, setSessionLog] = useState<ClaudeSessionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | undefined>();

  const PAGE_SIZE = 10;

  // Subscribe to load progress events
  useEffect(() => {
    const cleanup = window.sessionsAPI.onLoadProgress((progress: SessionLoadProgress) => {
      if (progress.phase === 'done') {
        setProgressMessage(undefined);
      } else {
        setProgressMessage(progress.message);
      }
    });
    return cleanup;
  }, []);

  // Reset state when tool changes
  useEffect(() => {
    setProjects([]);
    setTotalProjects(0);
    setProjectPage(0);
    setSessions([]);
    setTotalSessions(0);
    setSessionPage(0);
    setSelectedSession(null);
    setSessionLog([]);
  }, [selectedToolId]);

  // Load projects
  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.sessionsAPI.getAllProjectsByTool(selectedToolId, projectPage, PAGE_SIZE);
      setProjects(result.projects);
      setTotalProjects(result.total);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedToolId, projectPage]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Load sessions when a project is selected
  const loadSessions = useCallback(async () => {
    if (!projectPath) {
      setSessions([]);
      return;
    }
    try {
      const result = await window.sessionsAPI.getSessionsByTool(selectedToolId, projectPath, sessionPage, PAGE_SIZE);
      setSessions(result.sessions);
      setTotalSessions(result.total);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }, [selectedToolId, projectPath, sessionPage]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleSelectProject = (project: ClaudeProjectInfo) => {
    updateProject(project.projectPath, project.projectDirName);
    setSessionPage(0);
    setSelectedSession(null);
    setSessionLog([]);
  };

  const handleSelectSession = async (sessionId: string) => {
    if (!projectPath) return;
    setSelectedSession(sessionId);
    try {
      const log = await window.sessionsAPI.readLogByTool(selectedToolId, projectPath, sessionId);
      setSessionLog(log);
    } catch (error) {
      console.error('Failed to read session log:', error);
    }
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleString();
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={styles.container}>
      {/* Projects column */}
      <div className={styles.projectsPanel}>
        <div className={styles.panelHeader}>
          <h3>Projects ({totalProjects})</h3>
          <button type="button" className={styles.refreshBtn} onClick={loadProjects}>
            Refresh
          </button>
        </div>
        {loading ? (
          <div className={styles.loading}>
            <ProgressBar visible={true} message={progressMessage} />
          </div>
        ) : (
          <>
            <div className={styles.list}>
              {projects.map((p) => (
                <button
                  key={p.projectDirName}
                  type="button"
                  className={`${styles.listItem} ${
                    projectPath === p.projectPath ? styles.selected : ''
                  }`}
                  onClick={() => handleSelectProject(p)}
                >
                  <div className={styles.itemTitle}>
                    {p.projectPath.split('/').filter(Boolean).pop()}
                  </div>
                  <div className={styles.itemMeta}>
                    {p.sessions.length} sessions
                  </div>
                </button>
              ))}
            </div>
            {totalProjects > PAGE_SIZE && (
              <Pagination
                currentPage={projectPage}
                totalItems={totalProjects}
                pageSize={PAGE_SIZE}
                onPageChange={setProjectPage}
              />
            )}
          </>
        )}
      </div>

      {/* Sessions column */}
      <div className={styles.sessionsPanel}>
        <div className={styles.panelHeader}>
          <h3>
            Sessions
            {projectPath && ` (${totalSessions})`}
          </h3>
        </div>
        {projectPath ? (
          <>
            <div className={styles.list}>
              {sessions.map((s) => (
                <button
                  key={s.sessionId}
                  type="button"
                  className={`${styles.listItem} ${
                    selectedSession === s.sessionId ? styles.selected : ''
                  }`}
                  onClick={() => handleSelectSession(s.sessionId)}
                >
                  <div className={styles.itemTitle}>
                    {s.sessionId.substring(0, 8)}...
                  </div>
                  <div className={styles.itemMeta}>
                    {formatDate(s.lastModified)} | {formatSize(s.fileSize)}
                  </div>
                </button>
              ))}
            </div>
            {totalSessions > PAGE_SIZE && (
              <Pagination
                currentPage={sessionPage}
                totalItems={totalSessions}
                pageSize={PAGE_SIZE}
                onPageChange={setSessionPage}
              />
            )}
          </>
        ) : (
          <div className={styles.placeholder}>Select a project</div>
        )}
      </div>

      {/* Session detail column */}
      <div className={styles.detailPanel}>
        <div className={styles.panelHeader}>
          <h3>Session Log</h3>
        </div>
        {selectedSession && sessionLog.length > 0 ? (
          <ClassifiedLogList entries={sessionLog} toolId={selectedToolId} selectedSession={selectedSession} />
        ) : (
          <div className={styles.placeholder}>
            {selectedSession ? 'No log entries' : 'Select a session'}
          </div>
        )}
      </div>
    </div>
  );
}

/** Memoized list of classified log entries */
function ClassifiedLogList({
  entries,
  toolId,
  selectedSession,
}: {
  entries: ClaudeSessionEntry[];
  toolId: string;
  selectedSession: string;
}) {
  const classified = useMemo(
    () => entries.map((e) => classifyEntry(e, toolId)),
    [entries, toolId],
  );

  return (
    <div className={styles.logContent}>
      {classified.map((ce, i) => (
        <ClassifiedLogEntry key={`${selectedSession}-${i}`} entry={ce} />
      ))}
    </div>
  );
}
