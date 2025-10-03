import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StreamOutput } from '../components/stream/StreamOutput';
import type { StreamEvent } from '../lib/types';
import styles from './ExecutionDetailPage.module.css';

export const ExecutionDetailPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [errors, setErrors] = useState<Array<{ id: string; message: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [pid, setPid] = useState<number | null>(null);
  const [status, setStatus] = useState<'pending' | 'running' | 'completed' | 'failed'>('pending');
  const [projectPath, setProjectPath] = useState<string>('');
  const currentSessionIdRef = useRef<string | null>(null);

  // Load execution data on mount
  const loadExecution = useCallback(async () => {
    if (!sessionId) {
      setError('No session ID provided');
      return;
    }

    try {
      const execution = await window.claudeAPI.getExecution(sessionId);

      if (!execution) {
        setError('Execution not found');
        return;
      }

      setEvents(execution.events);
      setPid(execution.pid);
      setStatus(execution.status);
      setProjectPath(execution.projectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load execution');
      console.error('[ExecutionDetailPage] Failed to load execution:', err);
    }
  }, [sessionId]);

  // Update ref when sessionId changes
  useEffect(() => {
    currentSessionIdRef.current = sessionId || null;
  }, [sessionId]);

  // Load execution on mount
  useEffect(() => {
    loadExecution();
  }, [loadExecution]);

  // Event listeners - register once, filter by ref
  useEffect(() => {
    const handleStarted = (data: { sessionId: string; pid: number | null }) => {
      if (data.sessionId === currentSessionIdRef.current) {
        setStatus('running');
        setPid(data.pid);
      }
    };

    const handleStream = (data: { sessionId: string; data: StreamEvent }) => {
      if (data.sessionId === currentSessionIdRef.current) {
        setEvents((prev) => [...prev, data.data]);
      }
    };

    const handleError = (data: { sessionId: string; error: string }) => {
      if (data.sessionId === currentSessionIdRef.current) {
        setError(data.error);
        setErrors((prev) => [...prev, { id: Date.now().toString(), message: data.error }]);
      }
    };

    const handleComplete = (data: { sessionId: string; code: number }) => {
      if (data.sessionId === currentSessionIdRef.current) {
        setStatus(data.code === 0 ? 'completed' : 'failed');
      }
    };

    window.claudeAPI.onClaudeStarted(handleStarted);
    window.claudeAPI.onClaudeStream(handleStream);
    window.claudeAPI.onClaudeError(handleError);
    window.claudeAPI.onClaudeComplete(handleComplete);
  }, []);

  const handleKill = async () => {
    if (!sessionId) return;

    try {
      await window.claudeAPI.killExecution(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to kill execution');
    }
  };

  const handleCleanup = async () => {
    if (!sessionId) return;

    try {
      await window.claudeAPI.cleanupExecution(sessionId);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup execution');
    }
  };

  if (!sessionId) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>No session ID provided</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button type="button" onClick={() => navigate('/')} className={styles.backButton}>
          ← Back to Executions
        </button>
        <div className={styles.metadata}>
          <div className={styles.sessionId}>
            <span className={styles.label}>Session:</span> {sessionId}
          </div>
          {pid && (
            <div className={styles.pid}>
              <span className={styles.label}>PID:</span> {pid}
            </div>
          )}
          <div className={`${styles.status} ${styles[status]}`}>{status}</div>
          {projectPath && (
            <div className={styles.projectPath} title={projectPath}>
              <span className={styles.label}>Project:</span> {projectPath.split('/').pop()}
            </div>
          )}
        </div>
        <div className={styles.actions}>
          {(status === 'running' || status === 'pending') && (
            <button type="button" onClick={handleKill} className={styles.killButton}>
              Kill
            </button>
          )}
          {(status === 'completed' || status === 'failed') && (
            <button type="button" onClick={handleCleanup} className={styles.cleanupButton}>
              Cleanup
            </button>
          )}
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.output}>
        <StreamOutput events={events} errors={errors} currentPid={pid} sessionId={sessionId} />
      </div>
    </div>
  );
};
