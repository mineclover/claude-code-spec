/**
 * LangGraphTestPage - POC Test Page for LangGraph integration
 *
 * Phase 2 Enhancement:
 * - Real-time state updates via event subscription
 * - Live progress tracking for each task
 * - Task status visualization
 */

import { useEffect, useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import type { StateUpdateEvent, WorkflowState } from '../services/LangGraphEngine';
import type { Task } from '../types/task';
import type { ApprovalRequestEvent } from '../preload/apis/langGraph';
import styles from './LangGraphTestPage.module.css';

export const LangGraphTestPage: React.FC = () => {
  const { projectPath } = useProject();
  const [workflowId, setWorkflowId] = useState('');
  const [state, setState] = useState<WorkflowState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveUpdates, setLiveUpdates] = useState<StateUpdateEvent[]>([]);

  // Phase 4: Human-in-the-loop approval state
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequestEvent | null>(null);

  // Subscribe to real-time state updates
  useEffect(() => {
    const unsubscribe = window.langGraphAPI.onStateUpdate((event: StateUpdateEvent) => {
      console.log('State update received:', event);

      // Only update if it's for our current workflow
      if (workflowId && event.workflowId === workflowId) {
        setState(event.state);
        setLiveUpdates((prev) => [...prev, event]);

        // Auto-stop loading when workflow completes
        if (event.eventType === 'workflow_completed') {
          setLoading(false);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [workflowId]);

  // Phase 4: Subscribe to approval requests
  useEffect(() => {
    const unsubscribe = window.langGraphAPI.onApprovalRequest(
      (event: ApprovalRequestEvent) => {
        console.log('Approval request received:', event);

        // Only show approval request for our current workflow
        if (workflowId && event.workflowId === workflowId) {
          setApprovalRequest(event);
        }
      },
    );

    return () => {
      unsubscribe();
    };
  }, [workflowId]);

  const handleStartTest = async () => {
    if (!projectPath) {
      alert('Please select a project first (Settings page)');
      return;
    }

    setLoading(true);
    setError(null);
    setLiveUpdates([]);

    try {
      // Create test tasks
      // Phase 4: Add approval requirement to test-task-002
      const testTasks: Task[] = [
        {
          id: 'test-task-001',
          title: 'Test Task 1',
          description: 'List all TypeScript files in the src/ directory',
          assigned_agent: 'claude-sonnet-4',
          status: 'pending',
          area: 'Test',
        },
        {
          id: 'test-task-002',
          title: 'Test Task 2 (Requires Approval)',
          description: 'Count the total number of files found in the previous task',
          assigned_agent: 'claude-sonnet-4',
          status: 'pending',
          area: 'Test',
          dependencies: ['test-task-001'],
          approval: {
            required: true,
            message:
              'Task 2 will count files from Task 1. This requires approval before execution.',
            approver: 'human',
          },
        },
      ];

      const wfId = `langgraph-test-${Date.now()}`;
      setWorkflowId(wfId);

      console.log('Starting LangGraph workflow:', wfId);

      // Start workflow (non-blocking, state updates will come via events)
      window.langGraphAPI
        .startWorkflow(wfId, projectPath, testTasks)
        .then((result) => {
          console.log('Workflow completed:', result);
          alert('Workflow completed successfully!');
        })
        .catch((err) => {
          const errorMessage = (err as Error).message;
          setError(errorMessage);
          console.error('Workflow error:', err);
          alert(`Workflow failed: ${errorMessage}`);
          setLoading(false);
        });
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      console.error('Workflow error:', err);
      alert(`Workflow failed: ${errorMessage}`);
      setLoading(false);
    }
  };

  const handleGetState = async () => {
    if (!workflowId) {
      alert('No workflow ID. Start a workflow first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Getting workflow state:', workflowId);
      const currentState = await window.langGraphAPI.getWorkflowState(workflowId);

      if (currentState) {
        setState(currentState);
        console.log('Current state:', currentState);
      } else {
        alert('No state found for this workflow ID');
      }
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      console.error('Failed to get state:', err);
    } finally {
      setLoading(false);
    }
  };

  // Phase 4: Handle approval response
  const handleApprovalResponse = async (approved: boolean) => {
    if (!approvalRequest) return;

    try {
      await window.langGraphAPI.respondToApproval(approvalRequest.taskId, approved);
      setApprovalRequest(null); // Clear approval request
    } catch (err) {
      console.error('Failed to respond to approval:', err);
      alert(`Failed to respond to approval: ${(err as Error).message}`);
    }
  };

  return (
    <div className={styles.container}>
      {/* Phase 4: Approval Modal */}
      {approvalRequest && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>🤚 Approval Required</h2>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.approvalInfo}>
                <div className={styles.approvalItem}>
                  <strong>Task ID:</strong> {approvalRequest.taskId}
                </div>
                <div className={styles.approvalItem}>
                  <strong>Task Title:</strong>{' '}
                  {approvalRequest.state.tasks.find((t) => t.id === approvalRequest.taskId)?.title}
                </div>
                {approvalRequest.request.approver && (
                  <div className={styles.approvalItem}>
                    <strong>Approver:</strong> {approvalRequest.request.approver}
                  </div>
                )}
              </div>
              <div className={styles.approvalMessage}>{approvalRequest.request.message}</div>
            </div>
            <div className={styles.modalFooter}>
              <button
                onClick={() => handleApprovalResponse(false)}
                className={`${styles.modalButton} ${styles.rejectButton}`}
              >
                ❌ Reject
              </button>
              <button
                onClick={() => handleApprovalResponse(true)}
                className={`${styles.modalButton} ${styles.approveButton}`}
              >
                ✅ Approve
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.header}>
        <h1>🧪 LangGraph POC Test</h1>
        <p>Test the LangGraph workflow engine with simple sequential tasks</p>
      </div>

      <div className={styles.controls}>
        <button
          onClick={handleStartTest}
          disabled={loading || !projectPath}
          className={styles.startButton}
        >
          {loading ? '⏳ Running...' : '▶️ Start Test Workflow'}
        </button>

        {workflowId && (
          <button onClick={handleGetState} disabled={loading} className={styles.stateButton}>
            🔍 Get Current State
          </button>
        )}
      </div>

      {!projectPath && (
        <div className={styles.warning}>
          <strong>⚠️ No project selected</strong>
          <p>Please go to Settings page and select a project directory first.</p>
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <h3>❌ Error</h3>
          <pre>{error}</pre>
        </div>
      )}

      {workflowId && (
        <div className={styles.infoBox}>
          <strong>🆔 Workflow ID:</strong> <code>{workflowId}</code>
        </div>
      )}

      {liveUpdates.length > 0 && (
        <div className={styles.liveUpdatesSection}>
          <h2>📡 Live Updates</h2>
          <div className={styles.updatesList}>
            {liveUpdates.map((update, idx) => (
              <div
                key={idx}
                className={`${styles.updateItem} ${styles[`event-${update.eventType}`]}`}
              >
                <span className={styles.updateTime}>
                  {new Date(update.state.lastUpdateTime).toLocaleTimeString()}
                </span>
                <span className={styles.updateEvent}>
                  {update.eventType === 'task_started' && '▶️ Task Started'}
                  {update.eventType === 'task_completed' && '✅ Task Completed'}
                  {update.eventType === 'task_failed' && '❌ Task Failed'}
                  {update.eventType === 'workflow_completed' && '🎉 Workflow Completed'}
                </span>
                {update.taskId && <span className={styles.updateTaskId}>{update.taskId}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {state && (
        <div className={styles.stateContainer}>
          <h2>📊 Workflow State</h2>

          <div className={styles.stateGrid}>
            <div className={styles.stateCard}>
              <h3>✅ Completed Tasks</h3>
              <div className={styles.taskList}>
                {state.completedTasks.length > 0 ? (
                  state.completedTasks.map((taskId) => {
                    const progress = state.taskProgress?.[taskId];
                    return (
                      <div key={taskId} className={styles.taskItem}>
                        <div>{taskId}</div>
                        {progress && (
                          <div className={styles.progressInfo}>
                            <small>
                              Events: {progress.eventCount} |{' '}
                              {progress.currentTool && `Tool: ${progress.currentTool} | `}
                              {progress.tokenUsage &&
                                `Tokens: ${progress.tokenUsage.inputTokens}/${progress.tokenUsage.outputTokens} | Cost: $${progress.tokenUsage.totalCostUSD.toFixed(4)}`}
                            </small>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.emptyState}>No completed tasks yet</div>
                )}
              </div>
            </div>

            <div className={styles.stateCard}>
              <h3>❌ Failed Tasks</h3>
              <div className={styles.taskList}>
                {state.failedTasks.length > 0 ? (
                  state.failedTasks.map((taskId) => (
                    <div key={taskId} className={styles.taskItem}>
                      {taskId}
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>No failed tasks</div>
                )}
              </div>
            </div>
          </div>

          <div className={styles.resultsSection}>
            <h3>📝 Results</h3>
            <pre className={styles.jsonDisplay}>{JSON.stringify(state.results, null, 2)}</pre>
          </div>

          <div className={styles.logsSection}>
            <h3>📋 Logs</h3>
            <div className={styles.logsList}>
              {state.logs.map((log, idx) => (
                <div key={idx} className={styles.logItem}>
                  {log}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.fullStateSection}>
            <details>
              <summary>
                <strong>🔍 Full State (Debug)</strong>
              </summary>
              <pre className={styles.jsonDisplay}>{JSON.stringify(state, null, 2)}</pre>
            </details>
          </div>
        </div>
      )}

      <div className={styles.instructions}>
        <h3>📖 Instructions</h3>
        <ol>
          <li>Make sure you have selected a project in Settings</li>
          <li>Click "Start Test Workflow" to run 2 test tasks sequentially</li>
          <li>Wait for completion (may take 1-2 minutes)</li>
          <li>View the results and state information below</li>
          <li>Use "Get Current State" to refresh the state if needed</li>
        </ol>
      </div>
    </div>
  );
};
