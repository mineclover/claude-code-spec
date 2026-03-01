/**
 * LangGraphVisualizerPage - Visualize workflow execution with ReactFlow
 *
 * Phase 3: Visualization
 * - Graph structure visualization
 * - Real-time execution state updates
 * - State inspector and log viewer
 */

import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useProject } from '../contexts/ProjectContext';
import type { StateUpdateEvent, WorkflowState } from '../services/LangGraphEngine';
import type { Task } from '../types/task';
import type { ApprovalRequestEvent } from '../preload/apis/langGraph';
import {
  tasksToNodes,
  tasksToEdges,
  updateNodesWithProgress,
  type TaskNodeData,
} from '../lib/graphToReactFlow';
import styles from './LangGraphVisualizerPage.module.css';

export const LangGraphVisualizerPage: React.FC = () => {
  const { projectPath } = useProject();
  const [workflowId, setWorkflowId] = useState('');
  const [state, setState] = useState<WorkflowState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node<TaskNodeData> | null>(null);

  // Phase 4: Human-in-the-loop approval state
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequestEvent | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<TaskNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Subscribe to real-time state updates
  useEffect(() => {
    const unsubscribe = window.langGraphAPI.onStateUpdate((event: StateUpdateEvent) => {
      console.log('State update received:', event);

      // Only update if it's for our current workflow
      if (workflowId && event.workflowId === workflowId) {
        setState(event.state);

        // Update node colors based on progress
        setNodes((currentNodes) =>
          updateNodesWithProgress(currentNodes, event.state.taskProgress || {}),
        );

        // Auto-stop loading when workflow completes
        if (event.eventType === 'workflow_completed') {
          setLoading(false);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [workflowId, setNodes]);

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

    try {
      // Create test tasks with dependencies
      // Phase 4: Add approval requirement to task-c to test human-in-the-loop
      const testTasks: Task[] = [
        {
          id: 'task-a',
          title: 'Task A',
          description: 'List all TypeScript files',
          assigned_agent: 'claude-sonnet-4',
          status: 'pending',
          area: 'Test',
        },
        {
          id: 'task-b',
          title: 'Task B',
          description: 'Count files from Task A',
          assigned_agent: 'claude-sonnet-4',
          status: 'pending',
          area: 'Test',
          dependencies: ['task-a'],
        },
        {
          id: 'task-c',
          title: 'Task C (Requires Approval)',
          description: 'Analyze file types',
          assigned_agent: 'claude-sonnet-4',
          status: 'pending',
          area: 'Test',
          dependencies: ['task-a'],
          approval: {
            required: true,
            message:
              'Task C will analyze file types. This may take some time. Do you want to proceed?',
            approver: 'human',
          },
        },
        {
          id: 'task-d',
          title: 'Task D',
          description: 'Generate summary report',
          assigned_agent: 'claude-sonnet-4',
          status: 'pending',
          area: 'Test',
          dependencies: ['task-b', 'task-c'],
        },
      ];

      // Initialize graph
      const initialNodes = tasksToNodes(testTasks);
      const initialEdges = tasksToEdges(testTasks);

      setNodes(initialNodes);
      setEdges(initialEdges);

      const wfId = `langgraph-viz-${Date.now()}`;
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

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node<TaskNodeData>) => {
    setSelectedNode(node);
  }, []);

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
        <h1>🔮 LangGraph Visualizer</h1>
        <p>Visual workflow execution with dependency tracking</p>
      </div>

      <div className={styles.controls}>
        <button
          onClick={handleStartTest}
          disabled={loading || !projectPath}
          className={styles.startButton}
        >
          {loading ? '⏳ Running...' : '▶️ Start Workflow'}
        </button>
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
        <div className={styles.mainContent}>
          <div className={styles.graphSection}>
            <div className={styles.graphContainer}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                fitView
                minZoom={0.5}
                maxZoom={2}
              >
                <Background />
                <Controls />
                <MiniMap
                  nodeColor={(node) => {
                    const data = node.data as TaskNodeData;
                    switch (data.status) {
                      case 'running':
                        return '#3b82f6';
                      case 'completed':
                        return '#10b981';
                      case 'failed':
                        return '#ef4444';
                      default:
                        return '#e2e8f0';
                    }
                  }}
                />
              </ReactFlow>
            </div>

            {loading && (
              <div className={styles.loadingOverlay}>
                <div className={styles.loadingSpinner}>⏳ Executing workflow...</div>
              </div>
            )}
          </div>

          <div className={styles.sidePanel}>
            {selectedNode && (
              <div className={styles.nodeInspector}>
                <h3>📋 Task Details</h3>
                <div className={styles.nodeInfo}>
                  <div className={styles.infoItem}>
                    <strong>ID:</strong> {selectedNode.data.task.id}
                  </div>
                  <div className={styles.infoItem}>
                    <strong>Title:</strong> {selectedNode.data.task.title}
                  </div>
                  <div className={styles.infoItem}>
                    <strong>Status:</strong>{' '}
                    <span className={`${styles.badge} ${styles[selectedNode.data.status]}`}>
                      {selectedNode.data.status}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <strong>Agent:</strong> {selectedNode.data.task.assigned_agent}
                  </div>

                  {selectedNode.data.progress && (
                    <>
                      <div className={styles.infoItem}>
                        <strong>Events:</strong> {selectedNode.data.progress.eventCount}
                      </div>
                      {selectedNode.data.progress.currentTool && (
                        <div className={styles.infoItem}>
                          <strong>Current Tool:</strong> {selectedNode.data.progress.currentTool}
                        </div>
                      )}
                      {selectedNode.data.progress.tokenUsage && (
                        <div className={styles.infoItem}>
                          <strong>Tokens:</strong>{' '}
                          {selectedNode.data.progress.tokenUsage.inputTokens} in /{' '}
                          {selectedNode.data.progress.tokenUsage.outputTokens} out
                          <br />
                          <strong>Cost:</strong> $
                          {selectedNode.data.progress.tokenUsage.totalCostUSD.toFixed(4)}
                        </div>
                      )}
                    </>
                  )}

                  <div className={styles.infoItem}>
                    <strong>Description:</strong>
                    <p>{selectedNode.data.task.description}</p>
                  </div>

                  {selectedNode.data.task.dependencies &&
                    selectedNode.data.task.dependencies.length > 0 && (
                      <div className={styles.infoItem}>
                        <strong>Dependencies:</strong>
                        <ul>
                          {selectedNode.data.task.dependencies.map((dep) => (
                            <li key={dep}>{dep}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              </div>
            )}

            {state && (
              <div className={styles.stateInspector}>
                <h3>📊 Workflow State</h3>
                <div className={styles.stateSummary}>
                  <div className={styles.statItem}>
                    <strong>Completed:</strong> {state.completedTasks.length}
                  </div>
                  <div className={styles.statItem}>
                    <strong>Failed:</strong> {state.failedTasks.length}
                  </div>
                  <div className={styles.statItem}>
                    <strong>Logs:</strong> {state.logs.length}
                  </div>
                </div>

                <div className={styles.logsSection}>
                  <h4>Recent Logs</h4>
                  <div className={styles.logsList}>
                    {state.logs.slice(-5).map((log, idx) => (
                      <div key={idx} className={styles.logItem}>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={styles.instructions}>
        <h3>📖 How to Use</h3>
        <ol>
          <li>Select a project in Settings</li>
          <li>Click "Start Workflow" to run a test with 4 dependent tasks</li>
          <li>Watch the graph nodes change color as tasks execute</li>
          <li>Click on nodes to see detailed task information</li>
          <li>View real-time logs and state in the side panel</li>
        </ol>
        <p>
          <strong>Node Colors:</strong> Gray (Pending) → Blue (Running) → Green (Completed) / Red
          (Failed)
        </p>
      </div>
    </div>
  );
};
