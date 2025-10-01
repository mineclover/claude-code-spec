import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { SessionInfo } from '../../preload';
import { SessionLogViewer } from './SessionLogViewer';
import styles from './SessionsPanel.module.css';

interface SessionsPanelProps {
  onResumeSession?: (sessionId: string, query: string) => void;
  onBookmarkSession?: (sessionId: string, query: string) => void;
}

export const SessionsPanel: React.FC<SessionsPanelProps> = ({
  onResumeSession,
  onBookmarkSession,
}) => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewingLogs, setViewingLogs] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const allSessions = await window.claudeAPI.getSessions();
      setSessions(allSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleClearSessions = async () => {
    if (!confirm('Clear all session history?')) {
      return;
    }

    try {
      await window.claudeAPI.clearSessions();
      setSessions([]);
      setSelectedSession(null);
    } catch (error) {
      console.error('Clear sessions failed:', error);
    }
  };

  const handleResumeSession = (session: SessionInfo) => {
    if (onResumeSession) {
      onResumeSession(session.sessionId, session.query);
    }
  };

  const handleBookmarkSession = (session: SessionInfo) => {
    if (onBookmarkSession) {
      onBookmarkSession(session.sessionId, session.query);
    }
  };

  if (loading) {
    return <div className={styles.container}>Loading sessions...</div>;
  }

  // Show log viewer if viewing logs
  if (viewingLogs && selectedSession) {
    return (
      <SessionLogViewer
        projectPath={selectedSession.cwd}
        sessionId={selectedSession.sessionId}
        onClose={() => setViewingLogs(false)}
      />
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Session History</h3>
        <div className={styles.actions}>
          <button type="button" onClick={loadSessions} className={styles.button}>
            Refresh
          </button>
          <button type="button" onClick={handleClearSessions} className={styles.dangerButton}>
            Clear All
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Session List */}
        <div className={styles.sessionList}>
          {sessions.length === 0 ? (
            <div className={styles.empty}>No sessions yet</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.sessionId}
                className={`${styles.sessionItem} ${
                  selectedSession?.sessionId === session.sessionId ? styles.selected : ''
                }`}
                onClick={() => setSelectedSession(session)}
              >
                <div className={styles.sessionHeader}>
                  <span className={styles.timestamp}>
                    {new Date(session.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className={styles.sessionQuery}>{session.query}</div>
                <div className={styles.sessionPath}>{session.cwd}</div>
              </div>
            ))
          )}
        </div>

        {/* Session Detail */}
        <div className={styles.sessionDetail}>
          {selectedSession ? (
            <>
              <div className={styles.detailHeader}>
                <h4>Session Details</h4>
                <div className={styles.detailActions}>
                  <button
                    type="button"
                    onClick={() => setViewingLogs(true)}
                    className={styles.button}
                  >
                    View Logs
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResumeSession(selectedSession)}
                    className={styles.resumeButton}
                  >
                    Resume Session
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBookmarkSession(selectedSession)}
                    className={styles.bookmarkButton}
                  >
                    Add to Bookmarks
                  </button>
                </div>
              </div>

              <div className={styles.detailContent}>
                <div className={styles.detailSection}>
                  <label>Session ID:</label>
                  <code>{selectedSession.sessionId}</code>
                </div>

                <div className={styles.detailSection}>
                  <label>Project Path:</label>
                  <code>{selectedSession.cwd}</code>
                </div>

                <div className={styles.detailSection}>
                  <label>Query:</label>
                  <pre>{selectedSession.query}</pre>
                </div>

                <div className={styles.detailSection}>
                  <label>Created:</label>
                  <span>{new Date(selectedSession.timestamp).toLocaleString()}</span>
                </div>

                {selectedSession.lastResult && (
                  <div className={styles.detailSection}>
                    <label>Last Result:</label>
                    <pre className={styles.result}>{selectedSession.lastResult}</pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.noSelection}>Select a session to view details</div>
          )}
        </div>
      </div>
    </div>
  );
};
