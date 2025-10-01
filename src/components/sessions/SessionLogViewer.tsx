import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { ClaudeSessionEntry } from '../../preload';
import { SessionLogEventRenderer } from './SessionLogEventRenderer';
import styles from './SessionLogViewer.module.css';

interface SessionLogViewerProps {
  projectPath: string;
  sessionId: string;
  onClose?: () => void;
}

export const SessionLogViewer: React.FC<SessionLogViewerProps> = ({
  projectPath,
  sessionId,
  onClose,
}) => {
  const [logs, setLogs] = useState<ClaudeSessionEntry[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessionLogs();
  }, [projectPath, sessionId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const loadSessionLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const [logEntries, sessionSummary] = await Promise.all([
        window.claudeSessionsAPI.readLog(projectPath, sessionId),
        window.claudeSessionsAPI.getSummary(projectPath, sessionId),
      ]);

      setLogs(logEntries);
      setSummary(sessionSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session logs');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const dataStr = JSON.stringify(logs, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${sessionId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export logs:', err);
    }
  };


  if (loading) {
    return <div className={styles.loading}>Loading session logs...</div>;
  }

  if (error) {
    return (
      <div className={styles.error}>
        <div>
          <div>Failed to load session logs</div>
          <div style={{ fontSize: '11px', marginTop: '8px' }}>{error}</div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={styles.button}
              style={{ marginTop: '12px' }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className={styles.empty}>
        <div>
          <div>No logs found for this session</div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={styles.button}
              style={{ marginTop: '12px' }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          Session Log
          <span className={styles.sessionId}>{sessionId}</span>
        </h3>
        {summary && <div className={styles.summary}>{summary}</div>}
        <div className={styles.metadata}>
          <span className={styles.statBadge}>Entries: {logs.length}</span>
          <span className={styles.statBadge}>Project: {projectPath}</span>
        </div>
        <div className={styles.controls}>
          {onClose && (
            <button type="button" onClick={onClose} className={styles.button}>
              Close
            </button>
          )}
          <button type="button" onClick={handleExport} className={styles.button}>
            Export JSON
          </button>
          <button type="button" onClick={loadSessionLogs} className={styles.button}>
            Refresh
          </button>
        </div>
      </div>

      <div className={styles.logContent}>
        {logs.map((entry, idx) => (
          <SessionLogEventRenderer key={`log-${idx}-${Date.now()}`} event={entry} index={idx} />
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};
