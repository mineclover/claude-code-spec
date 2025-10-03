import type React from 'react';
import type { ExecutionInfo } from '../../types/api';
import styles from './ExecutionsList.module.css';

interface ExecutionsListProps {
  executions: Array<Omit<ExecutionInfo, 'events'>>;
  currentSessionId: string | null;
  onSelectExecution: (sessionId: string) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}

export const ExecutionsList: React.FC<ExecutionsListProps> = ({
  executions,
  currentSessionId,
  onSelectExecution,
  expanded,
  onToggleExpanded,
}) => {
  const formatDuration = (startTime: number, endTime: number | null): string => {
    const duration = (endTime || Date.now()) - startTime;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'running':
        return styles.statusRunning;
      case 'pending':
        return styles.statusPending;
      case 'completed':
        return styles.statusCompleted;
      case 'failed':
        return styles.statusFailed;
      case 'killed':
        return styles.statusKilled;
      default:
        return '';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={onToggleExpanded}>
        <h3 className={styles.title}>
          Active Executions ({executions.length})
        </h3>
        <button type="button" className={styles.toggleButton}>
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className={styles.list}>
          {executions.length === 0 ? (
            <div className={styles.emptyMessage}>No active executions</div>
          ) : (
            executions.map((execution) => (
              <div
                key={execution.sessionId}
                className={`${styles.item} ${
                  execution.sessionId === currentSessionId ? styles.active : ''
                }`}
                onClick={() => onSelectExecution(execution.sessionId)}
              >
                <div className={styles.itemHeader}>
                  <span className={styles.sessionId}>
                    {execution.sessionId.slice(0, 8)}...
                  </span>
                  <span className={`${styles.status} ${getStatusBadgeClass(execution.status)}`}>
                    {execution.status}
                  </span>
                </div>

                <div className={styles.itemInfo}>
                  <span className={styles.query} title={execution.query}>
                    {execution.query.length > 50
                      ? `${execution.query.slice(0, 50)}...`
                      : execution.query}
                  </span>
                </div>

                <div className={styles.itemMeta}>
                  <span className={styles.duration}>
                    {formatDuration(execution.startTime, execution.endTime)}
                  </span>
                  {execution.pid && (
                    <span className={styles.pid}>PID: {execution.pid}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
