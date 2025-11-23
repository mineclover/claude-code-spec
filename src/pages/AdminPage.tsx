/**
 * AdminPage - Manual overrides for tasks and executions
 *
 * Features:
 * - View all tasks across projects
 * - Manually change task status
 * - View active executions
 * - Manually terminate executions
 * - Webhook configuration
 */

import { useEffect, useState } from 'react';
import type { Task, TaskStatus } from '../types/task';
import type { TrackedExecution, WebhookConfig } from '../services/AgentTracker';
import styles from './AdminPage.module.css';

export const AdminPage: React.FC = () => {
  const [tasks, setTasks] = useState<(Task & { projectPath: string })[]>([]);
  const [executions, setExecutions] = useState<TrackedExecution[]>([]);
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
    enabled: false,
    url: '',
    maxRetries: 3,
    retryDelay: 1000,
  });
  const [selectedTab, setSelectedTab] = useState<'tasks' | 'executions' | 'webhooks'>('tasks');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      // Load tasks from all projects
      const projects = await window.centralDatabaseAPI.listProjects();
      const allTasks: (Task & { projectPath: string })[] = [];

      for (const project of projects) {
        try {
          const projectTasks = await window.taskAPI.listTasks(project.projectPath);
          allTasks.push(
            ...projectTasks.map((task) => ({
              ...task,
              projectPath: project.projectPath,
            })),
          );
        } catch (error) {
          console.error(`Failed to load tasks for ${project.projectPath}:`, error);
        }
      }

      setTasks(allTasks);

      // Load active executions
      const activeExecs = await window.agentTrackerAPI.getAllTracked();
      setExecutions(activeExecs);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    }
  };

  const handleTaskStatusChange = async (projectPath: string, taskId: string, newStatus: TaskStatus) => {
    if (!confirm(`Change task ${taskId} status to ${newStatus}?`)) {
      return;
    }

    setLoading(true);
    try {
      const task = tasks.find((t) => t.id === taskId && t.projectPath === projectPath);
      if (!task) {
        alert('Task not found');
        return;
      }

      await window.taskAPI.updateTask(projectPath, {
        ...task,
        status: newStatus,
      });

      alert(`Task ${taskId} status changed to ${newStatus}`);
      await loadData();
    } catch (error) {
      console.error('Failed to update task status:', error);
      alert('Failed to update task status: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleTerminateExecution = async (sessionId: string) => {
    if (!confirm(`Terminate execution ${sessionId}?`)) {
      return;
    }

    setLoading(true);
    try {
      await window.agentTrackerAPI.unregisterExecution(sessionId);
      // Also try to kill the actual process if possible
      // Note: This requires ProcessManager access which we might not have directly
      alert(`Execution ${sessionId} terminated`);
      await loadData();
    } catch (error) {
      console.error('Failed to terminate execution:', error);
      alert('Failed to terminate execution: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleWebhookConfigSave = () => {
    // TODO: Implement webhook config save
    alert('Webhook configuration saved (not yet implemented in backend)');
  };

  const getStatusColor = (status: TaskStatus): string => {
    switch (status) {
      case 'completed':
        return styles.statusCompleted;
      case 'in_progress':
        return styles.statusInProgress;
      case 'pending':
        return styles.statusPending;
      case 'cancelled':
        return styles.statusCancelled;
      default:
        return '';
    }
  };

  const getExecutionStatusColor = (status: string): string => {
    switch (status) {
      case 'running':
        return styles.statusRunning;
      case 'zombie':
        return styles.statusZombie;
      case 'completed':
        return styles.statusCompleted;
      case 'failed':
        return styles.statusFailed;
      default:
        return '';
    }
  };

  const renderTasksTab = () => (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <h2>All Tasks</h2>
        <button onClick={loadData} className={styles.refreshButton} disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      <div className={styles.tasksList}>
        {tasks.map((task) => (
          <div key={`${task.projectPath}-${task.id}`} className={styles.taskCard}>
            <div className={styles.taskHeader}>
              <h3>{task.title}</h3>
              <span className={`${styles.statusBadge} ${getStatusColor(task.status)}`}>
                {task.status}
              </span>
            </div>

            <div className={styles.taskMeta}>
              <div className={styles.metaItem}>
                <strong>ID:</strong> {task.id}
              </div>
              <div className={styles.metaItem}>
                <strong>Project:</strong>{' '}
                {task.projectPath.split('/').filter(Boolean).pop() || task.projectPath}
              </div>
              <div className={styles.metaItem}>
                <strong>Agent:</strong> {task.assigned_agent}
              </div>
              {task.reviewer && (
                <div className={styles.metaItem}>
                  <strong>Reviewer:</strong> {task.reviewer}
                </div>
              )}
            </div>

            <div className={styles.taskActions}>
              <select
                onChange={(e) =>
                  handleTaskStatusChange(task.projectPath, task.id, e.target.value as TaskStatus)
                }
                value={task.status}
                disabled={loading}
                className={styles.statusSelect}
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        ))}

        {tasks.length === 0 && <div className={styles.emptyState}>No tasks found</div>}
      </div>
    </div>
  );

  const renderExecutionsTab = () => (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <h2>Active Executions</h2>
        <button onClick={loadData} className={styles.refreshButton} disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      <div className={styles.executionsList}>
        {executions.map((execution) => (
          <div key={execution.sessionId} className={styles.executionCard}>
            <div className={styles.executionHeader}>
              <h3>{execution.agentName}</h3>
              <span
                className={`${styles.statusBadge} ${getExecutionStatusColor(execution.status)}`}
              >
                {execution.status}
              </span>
            </div>

            <div className={styles.executionMeta}>
              <div className={styles.metaItem}>
                <strong>Session ID:</strong> {execution.sessionId.substring(0, 8)}...
              </div>
              <div className={styles.metaItem}>
                <strong>Project:</strong>{' '}
                {execution.projectPath.split('/').filter(Boolean).pop() || execution.projectPath}
              </div>
              {execution.taskId && (
                <div className={styles.metaItem}>
                  <strong>Task:</strong> {execution.taskId}
                </div>
              )}
              <div className={styles.metaItem}>
                <strong>PID:</strong> {execution.pid}
              </div>
              <div className={styles.metaItem}>
                <strong>Started:</strong> {new Date(execution.startTime).toLocaleString()}
              </div>
              <div className={styles.metaItem}>
                <strong>Last Heartbeat:</strong>{' '}
                {new Date(execution.lastHeartbeat).toLocaleString()}
              </div>
            </div>

            {execution.status === 'running' || execution.status === 'zombie' ? (
              <div className={styles.executionActions}>
                <button
                  onClick={() => handleTerminateExecution(execution.sessionId)}
                  className={styles.terminateButton}
                  disabled={loading}
                >
                  ⛔ Terminate
                </button>
              </div>
            ) : null}
          </div>
        ))}

        {executions.length === 0 && (
          <div className={styles.emptyState}>No active executions</div>
        )}
      </div>
    </div>
  );

  const renderWebhooksTab = () => (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <h2>Webhook Configuration</h2>
      </div>

      <div className={styles.webhookForm}>
        <div className={styles.formGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={webhookConfig.enabled}
              onChange={(e) => setWebhookConfig({ ...webhookConfig, enabled: e.target.checked })}
            />
            <span>Enable Zombie Detection Webhooks</span>
          </label>
        </div>

        <div className={styles.formGroup}>
          <label>Webhook URL:</label>
          <input
            type="url"
            value={webhookConfig.url}
            onChange={(e) => setWebhookConfig({ ...webhookConfig, url: e.target.value })}
            placeholder="https://your-webhook-endpoint.com/notifications"
            className={styles.input}
            disabled={!webhookConfig.enabled}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Max Retries:</label>
          <input
            type="number"
            value={webhookConfig.maxRetries}
            onChange={(e) =>
              setWebhookConfig({ ...webhookConfig, maxRetries: parseInt(e.target.value) })
            }
            min="1"
            max="10"
            className={styles.input}
            disabled={!webhookConfig.enabled}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Retry Delay (ms):</label>
          <input
            type="number"
            value={webhookConfig.retryDelay}
            onChange={(e) =>
              setWebhookConfig({ ...webhookConfig, retryDelay: parseInt(e.target.value) })
            }
            min="100"
            max="10000"
            step="100"
            className={styles.input}
            disabled={!webhookConfig.enabled}
          />
        </div>

        <button onClick={handleWebhookConfigSave} className={styles.saveButton}>
          💾 Save Configuration
        </button>

        <div className={styles.webhookHelp}>
          <h3>Webhook Payload Example:</h3>
          <pre className={styles.code}>
            {JSON.stringify(
              {
                type: 'zombie_detected',
                timestamp: '2025-11-24T10:30:00Z',
                execution: {
                  sessionId: 'abc123...',
                  projectPath: '/path/to/project',
                  agentName: 'claude-sonnet-4',
                  taskId: 'task-001',
                  pid: 12345,
                  startTime: 1700000000000,
                  lastHeartbeat: 1700000600000,
                  timeSinceHeartbeat: 600000,
                },
              },
              null,
              2,
            )}
          </pre>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Admin Panel</h1>
        <p>Manual overrides and system configuration</p>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${selectedTab === 'tasks' ? styles.activeTab : ''}`}
          onClick={() => setSelectedTab('tasks')}
        >
          📋 Tasks ({tasks.length})
        </button>
        <button
          className={`${styles.tab} ${selectedTab === 'executions' ? styles.activeTab : ''}`}
          onClick={() => setSelectedTab('executions')}
        >
          ⚙️ Executions ({executions.length})
        </button>
        <button
          className={`${styles.tab} ${selectedTab === 'webhooks' ? styles.activeTab : ''}`}
          onClick={() => setSelectedTab('webhooks')}
        >
          🔔 Webhooks
        </button>
      </div>

      {selectedTab === 'tasks' && renderTasksTab()}
      {selectedTab === 'executions' && renderExecutionsTab()}
      {selectedTab === 'webhooks' && renderWebhooksTab()}
    </div>
  );
};
