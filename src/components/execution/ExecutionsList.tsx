import type React from 'react';
import type { ExecutionInfo } from '../../types/api';
import styles from './ExecutionsList.module.css';

interface ExecutionsListProps {
  executions: Array<Omit<ExecutionInfo, 'events'>>;
  currentSessionId: string | null;
  onSelectExecution: (sessionId: string) => void;
  onKillExecution: (sessionId: string) => void;
  onCleanupExecution: (sessionId: string) => void;
  onKillAll?: () => void;
  onCleanupAll?: () => void;
  showAll: boolean;
  onToggleShowAll: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}

export const ExecutionsList: React.FC<ExecutionsListProps> = ({
  executions,
  currentSessionId,
  onSelectExecution,
  onKillExecution,
  onCleanupExecution,
  onKillAll,
  onCleanupAll,
  showAll,
  onToggleShowAll,
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

  const stats = {
    running: executions.filter((e) => e.status === 'running').length,
    pending: executions.filter((e) => e.status === 'pending').length,
    completed: executions.filter((e) => e.status === 'completed').length,
    failed: executions.filter((e) => e.status === 'failed').length,
    killed: executions.filter((e) => e.status === 'killed').length,
  };

  const activeCount = stats.running + stats.pending;

  const displayedExecutions = showAll
    ? executions
    : executions.filter((e) => e.status === 'running' || e.status === 'pending');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.headerContent}
          onClick={onToggleExpanded}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleExpanded();
            }
          }}
        >
          <h3 className={styles.title}>Executions ({displayedExecutions.length})</h3>
          <div className={styles.stats}>
            {activeCount > 0 && <span className={styles.statActive}>{activeCount} active</span>}
            {stats.completed > 0 && (
              <span className={styles.statCompleted}>{stats.completed} completed</span>
            )}
            {stats.failed > 0 && <span className={styles.statFailed}>{stats.failed} failed</span>}
          </div>
        </button>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.filterButton}
            onClick={(e) => {
              e.stopPropagation();
              onToggleShowAll();
            }}
            title={showAll ? 'Show active only' : 'Show all'}
          >
            {showAll ? 'All' : 'Active'}
          </button>
          {activeCount > 0 && onKillAll && (
            <button
              type="button"
              className={styles.killAllButton}
              onClick={(e) => {
                e.stopPropagation();
                onKillAll();
              }}
              title="Kill all active executions"
            >
              Kill All
            </button>
          )}
          {(stats.completed > 0 || stats.failed > 0 || stats.killed > 0) && onCleanupAll && (
            <button
              type="button"
              className={styles.cleanupAllButton}
              onClick={(e) => {
                e.stopPropagation();
                onCleanupAll();
              }}
              title="Cleanup all completed executions"
            >
              Cleanup All
            </button>
          )}
          <button type="button" className={styles.toggleButton} onClick={onToggleExpanded}>
            {expanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className={styles.list}>
          {displayedExecutions.length === 0 ? (
            <div className={styles.emptyMessage}>
              {showAll ? 'No executions' : 'No active executions'}
            </div>
          ) : (
            displayedExecutions.map((execution) => (
              <button
                type="button"
                key={execution.sessionId}
                className={`${styles.item} ${
                  execution.sessionId === currentSessionId ? styles.active : ''
                }`}
                onClick={() => onSelectExecution(execution.sessionId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectExecution(execution.sessionId);
                  }
                }}
              >
                <div className={styles.itemHeader}>
                  <span className={styles.sessionId}>{execution.sessionId.slice(0, 8)}...</span>
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
                  {execution.pid && <span className={styles.pid}>PID: {execution.pid}</span>}
                </div>

                <div className={styles.itemActions}>
                  {(execution.status === 'running' || execution.status === 'pending') && (
                    <button
                      type="button"
                      className={styles.killButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        onKillExecution(execution.sessionId);
                      }}
                      title="Kill execution"
                    >
                      Kill
                    </button>
                  )}
                  {(execution.status === 'completed' ||
                    execution.status === 'failed' ||
                    execution.status === 'killed') && (
                    <button
                      type="button"
                      className={styles.cleanupButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCleanupExecution(execution.sessionId);
                      }}
                      title="Remove from list"
                    >
                      Cleanup
                    </button>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
