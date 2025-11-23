import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useProject } from '../contexts/ProjectContext';
import type { WorkflowEvent, WorkflowStats } from '../services/WorkflowEngine';
import type { TaskListItem } from '../types/task';
import styles from './WorkflowPage.module.css';

interface WorkflowHistoryEntry {
  timestamp: string;
  type: string;
  message: string;
  data?: any;
}

export const WorkflowPage: React.FC = () => {
  const { projectPath } = useProject();

  // Workflow state
  const [workflowStats, setWorkflowStats] = useState<WorkflowStats | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [history, setHistory] = useState<WorkflowHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Load workflow stats
  const loadWorkflowStats = useCallback(async () => {
    if (!projectPath) return;

    try {
      const stats = await window.workflowAPI.getWorkflowStats(projectPath);
      setWorkflowStats(stats);
      setIsRunning(stats.status === 'running');
    } catch (error) {
      console.error('Failed to load workflow stats:', error);
    }
  }, [projectPath]);

  // Load tasks list
  const loadTasks = useCallback(async () => {
    if (!projectPath) return;

    try {
      const tasksList = await window.taskAPI.listTasks(projectPath);
      setTasks(tasksList);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  }, [projectPath]);

  // Initial load
  useEffect(() => {
    loadWorkflowStats();
    loadTasks();
  }, [loadWorkflowStats, loadTasks]);

  // Subscribe to workflow events
  useEffect(() => {
    if (!projectPath) return;

    const unsubscribe = window.workflowAPI.onWorkflowEvent((event: WorkflowEvent) => {
      console.log('Workflow event:', event);

      // Add to history
      const entry: WorkflowHistoryEntry = {
        timestamp: event.timestamp,
        type: event.type,
        message: formatEventMessage(event),
        data: event.data,
      };
      setHistory((prev) => [entry, ...prev].slice(0, 100)); // Keep last 100 entries

      // Update stats
      loadWorkflowStats();
      loadTasks();

      // Show toast notifications for important events
      if (event.type === 'workflow:started') {
        toast.success('Workflow started');
      } else if (event.type === 'workflow:completed') {
        toast.success('Workflow completed!');
      } else if (event.type === 'workflow:failed') {
        toast.error('Workflow failed');
      } else if (event.type === 'task:completed') {
        toast.success(`Task ${event.data.taskId} completed`);
      } else if (event.type === 'task:failed') {
        toast.error(`Task ${event.data.taskId} failed`);
      }
    });

    return unsubscribe;
  }, [projectPath, loadWorkflowStats, loadTasks, formatEventMessage]);

  // Auto-refresh stats every 5 seconds when running
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      loadWorkflowStats();
      loadTasks();
    }, 5000);

    return () => clearInterval(interval);
  }, [isRunning, loadWorkflowStats, loadTasks]);

  // Workflow controls
  const handleStartWorkflow = async () => {
    if (!projectPath) return;

    setLoading(true);
    try {
      await window.workflowAPI.startWorkflow(projectPath);
      toast.success('Workflow starting...');
    } catch (error) {
      console.error('Failed to start workflow:', error);
      toast.error('Failed to start workflow');
    } finally {
      setLoading(false);
    }
  };

  const handlePauseWorkflow = async () => {
    if (!projectPath) return;

    setLoading(true);
    try {
      await window.workflowAPI.pauseWorkflow(projectPath);
      toast.success('Workflow pausing...');
    } catch (error) {
      console.error('Failed to pause workflow:', error);
      toast.error('Failed to pause workflow');
    } finally {
      setLoading(false);
    }
  };

  const handleResumeWorkflow = async () => {
    if (!projectPath) return;

    setLoading(true);
    try {
      await window.workflowAPI.resumeWorkflow(projectPath);
      toast.success('Workflow resuming...');
    } catch (error) {
      console.error('Failed to resume workflow:', error);
      toast.error('Failed to resume workflow');
    } finally {
      setLoading(false);
    }
  };

  const handleStopWorkflow = async () => {
    if (!projectPath) return;

    if (
      !confirm('Are you sure you want to stop the workflow? Running tasks will complete first.')
    ) {
      return;
    }

    setLoading(true);
    try {
      await window.workflowAPI.stopWorkflow(projectPath);
      toast.success('Workflow stopping...');
    } catch (error) {
      console.error('Failed to stop workflow:', error);
      toast.error('Failed to stop workflow');
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const formatEventMessage = (event: WorkflowEvent): string => {
    switch (event.type) {
      case 'workflow:started':
        return `Workflow started with ${event.data.totalTasks} tasks`;
      case 'workflow:paused':
        return `Workflow paused (${event.data.completedCount} tasks completed)`;
      case 'workflow:resumed':
        return 'Workflow resumed';
      case 'workflow:completed':
        return `Workflow completed! ${event.data.completedTasks}/${event.data.totalTasks} tasks successful`;
      case 'workflow:failed':
        return 'Workflow failed';
      case 'task:started':
        return `Started: ${event.data.taskId} - ${event.data.title}`;
      case 'task:completed':
        return `Completed: ${event.data.taskId}`;
      case 'task:failed':
        return `Failed: ${event.data.taskId} - ${event.data.error}`;
      case 'task:retrying':
        return `Retrying: ${event.data.taskId} (attempt ${event.data.retryCount})`;
      default:
        return event.type;
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
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

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'idle':
        return '#6c757d';
      case 'running':
        return '#28a745';
      case 'paused':
        return '#ffc107';
      case 'completed':
        return '#17a2b8';
      case 'failed':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const getTaskStatusBadge = (status: string): string => {
    switch (status) {
      case 'pending':
        return styles.statusPending;
      case 'in_progress':
        return styles.statusInProgress;
      case 'completed':
        return styles.statusCompleted;
      case 'cancelled':
        return styles.statusCancelled;
      default:
        return '';
    }
  };

  if (!projectPath) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h2>No Project Selected</h2>
          <p>Please select a project to view workflow</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Workflow Automation</h1>
        <div className={styles.headerActions}>
          {!isRunning && workflowStats?.status !== 'paused' && (
            <button
              type="button"
              onClick={handleStartWorkflow}
              disabled={loading}
              className={styles.startButton}
            >
              {loading ? 'Starting...' : 'Start Workflow'}
            </button>
          )}
          {isRunning && (
            <>
              <button
                type="button"
                onClick={handlePauseWorkflow}
                disabled={loading}
                className={styles.pauseButton}
              >
                {loading ? 'Pausing...' : 'Pause'}
              </button>
              <button
                type="button"
                onClick={handleStopWorkflow}
                disabled={loading}
                className={styles.stopButton}
              >
                {loading ? 'Stopping...' : 'Stop'}
              </button>
            </>
          )}
          {workflowStats?.status === 'paused' && (
            <button
              type="button"
              onClick={handleResumeWorkflow}
              disabled={loading}
              className={styles.resumeButton}
            >
              {loading ? 'Resuming...' : 'Resume'}
            </button>
          )}
        </div>
      </header>

      {/* Workflow Status Dashboard */}
      {workflowStats && (
        <section className={styles.statusDashboard}>
          <div className={styles.statusCard}>
            <div className={styles.statusHeader}>
              <h2>Workflow Status</h2>
              <span
                className={styles.statusBadge}
                style={{ backgroundColor: getStatusColor(workflowStats.status) }}
              >
                {workflowStats.status.toUpperCase()}
              </span>
            </div>
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Total Tasks</span>
                <span className={styles.statValue}>{workflowStats.totalTasks}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Completed</span>
                <span className={`${styles.statValue} ${styles.statSuccess}`}>
                  {workflowStats.completedTasks}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>In Progress</span>
                <span className={`${styles.statValue} ${styles.statInfo}`}>
                  {workflowStats.inProgressTasks}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Pending</span>
                <span className={styles.statValue}>{workflowStats.pendingTasks}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Failed</span>
                <span className={`${styles.statValue} ${styles.statDanger}`}>
                  {workflowStats.failedTasks}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Elapsed Time</span>
                <span className={styles.statValue}>
                  {formatDuration(workflowStats.elapsedTime)}
                </span>
              </div>
              {workflowStats.estimatedRemaining && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Est. Remaining</span>
                  <span className={styles.statValue}>
                    {formatDuration(workflowStats.estimatedRemaining)}
                  </span>
                </div>
              )}
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Progress</span>
                <span className={styles.statValue}>
                  {workflowStats.totalTasks > 0
                    ? Math.round((workflowStats.completedTasks / workflowStats.totalTasks) * 100)
                    : 0}
                  %
                </span>
              </div>
            </div>
            {workflowStats.totalTasks > 0 && (
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${(workflowStats.completedTasks / workflowStats.totalTasks) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
        </section>
      )}

      <div className={styles.mainContent}>
        {/* Task Queue View */}
        <section className={styles.taskQueue}>
          <h2>Task Queue</h2>
          {tasks.length === 0 ? (
            <div className={styles.emptyQueue}>
              <p>No tasks available</p>
            </div>
          ) : (
            <div className={styles.taskList}>
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`${styles.taskCard} ${
                    task.status === 'in_progress' ? styles.taskCardActive : ''
                  }`}
                >
                  <div className={styles.taskHeader}>
                    <h3>{task.title}</h3>
                    <span className={getTaskStatusBadge(task.status)}>{task.status}</span>
                  </div>
                  <div className={styles.taskMeta}>
                    <span className={styles.taskId}>{task.id}</span>
                    <span className={styles.taskArea}>{task.area}</span>
                    <span className={styles.taskAgent}>{task.assigned_agent}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Execution History Log */}
        <section className={styles.historyLog}>
          <h2>Execution History</h2>
          {history.length === 0 ? (
            <div className={styles.emptyHistory}>
              <p>No events yet. Start the workflow to see execution history.</p>
            </div>
          ) : (
            <div className={styles.historyList}>
              {history.map((entry, index) => (
                <div key={`${entry.timestamp}-${index}`} className={styles.historyEntry}>
                  <span className={styles.historyTime}>
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={styles.historyType}>{entry.type}</span>
                  <span className={styles.historyMessage}>{entry.message}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
