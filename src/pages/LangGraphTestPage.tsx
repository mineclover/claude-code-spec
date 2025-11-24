/**
 * LangGraphTestPage - POC Test Page for LangGraph integration
 */

import { useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import type { WorkflowState } from '../services/LangGraphEngine';
import type { Task } from '../types/task';
import styles from './LangGraphTestPage.module.css';

export const LangGraphTestPage: React.FC = () => {
  const { projectPath } = useProject();
  const [workflowId, setWorkflowId] = useState('');
  const [state, setState] = useState<WorkflowState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartTest = async () => {
    if (!projectPath) {
      alert('Please select a project first (Settings page)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create test tasks
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
          title: 'Test Task 2',
          description: 'Count the total number of files found in the previous task',
          assigned_agent: 'claude-sonnet-4',
          status: 'pending',
          area: 'Test',
          dependencies: ['test-task-001'],
        },
      ];

      const wfId = `langgraph-test-${Date.now()}`;
      setWorkflowId(wfId);

      console.log('Starting LangGraph workflow:', wfId);
      const result = await window.langGraphAPI.startWorkflow(wfId, projectPath, testTasks);

      console.log('Workflow completed:', result);
      setState(result.state);
      alert('Workflow completed successfully!');
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      console.error('Workflow error:', err);
      alert(`Workflow failed: ${errorMessage}`);
    } finally {
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

  return (
    <div className={styles.container}>
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

      {state && (
        <div className={styles.stateContainer}>
          <h2>📊 Workflow State</h2>

          <div className={styles.stateGrid}>
            <div className={styles.stateCard}>
              <h3>✅ Completed Tasks</h3>
              <div className={styles.taskList}>
                {state.completedTasks.length > 0 ? (
                  state.completedTasks.map((taskId) => (
                    <div key={taskId} className={styles.taskItem}>
                      {taskId}
                    </div>
                  ))
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
