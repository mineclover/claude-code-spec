/**
 * LangGraphEngine - Workflow execution engine using LangGraph
 *
 * POC Implementation:
 * - Simple sequential task execution
 * - State management with checkpoints
 * - Integration with ProcessManager and AgentTracker
 */

import type { ProcessManager } from '@context-action/code-api';
import { Annotation, END, MemorySaver, StateGraph } from '@langchain/langgraph';
import { appLogger } from '../main/app-context';
import type { Task } from '../types/task';
import type { AgentTracker } from './AgentTracker';

// State annotation for workflow
const WorkflowStateAnnotation = Annotation.Root({
  workflowId: Annotation<string>,
  projectPath: Annotation<string>,
  currentTask: Annotation<string>,
  completedTasks: Annotation<string[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  failedTasks: Annotation<string[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  results: Annotation<Record<string, any>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  logs: Annotation<string[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  startTime: Annotation<number>,
  lastUpdateTime: Annotation<number>,
});

export type WorkflowState = typeof WorkflowStateAnnotation.State;

export class LangGraphEngine {
  private processManager: ProcessManager;
  private agentTracker: AgentTracker;
  private checkpointer = new MemorySaver();

  constructor(processManager: ProcessManager, agentTracker: AgentTracker) {
    this.processManager = processManager;
    this.agentTracker = agentTracker;

    appLogger.info('LangGraphEngine initialized', {
      module: 'LangGraphEngine',
    });
  }

  /**
   * Build a simple sequential graph from tasks
   */
  buildSimpleGraph(tasks: Task[]) {
    const graph = new StateGraph(WorkflowStateAnnotation);

    appLogger.info('Building LangGraph', {
      module: 'LangGraphEngine',
      taskCount: tasks.length,
      taskIds: tasks.map((t) => t.id),
    });

    // Add nodes for each task
    for (const task of tasks) {
      graph.addNode(task.id, async (state: WorkflowState) => {
        appLogger.info('Executing task node', {
          module: 'LangGraphEngine',
          taskId: task.id,
          workflowId: state.workflowId,
        });

        // Register execution
        const sessionId = `${state.workflowId}-${task.id}`;
        await this.agentTracker.registerExecution(sessionId, {
          taskId: task.id,
          agentName: task.assigned_agent,
          projectPath: state.projectPath,
        });

        try {
          // Execute Claude CLI
          const result = await this.executeClaudeTask(task, state);

          // Update tracker
          await this.agentTracker.updateStatus(sessionId, 'completed');

          appLogger.info('Task completed successfully', {
            module: 'LangGraphEngine',
            taskId: task.id,
            sessionId,
          });

          return {
            completedTasks: [task.id],
            results: { [task.id]: result },
            logs: [`Task ${task.id} completed successfully`],
            lastUpdateTime: Date.now(),
          };
        } catch (error) {
          await this.agentTracker.updateStatus(sessionId, 'failed');

          appLogger.error('Task execution failed', {
            module: 'LangGraphEngine',
            taskId: task.id,
            sessionId,
            error: String(error),
          });

          return {
            failedTasks: [task.id],
            results: { [task.id]: { error: String(error) } },
            logs: [`Task ${task.id} failed: ${String(error)}`],
            lastUpdateTime: Date.now(),
          };
        }
      });
    }

    // Add sequential edges
    if (tasks.length > 0) {
      graph.addEdge('__start__', tasks[0].id);
      for (let i = 0; i < tasks.length - 1; i++) {
        graph.addEdge(tasks[i].id, tasks[i + 1].id);
      }
      graph.addEdge(tasks[tasks.length - 1].id, END);
    }

    return graph.compile({ checkpointer: this.checkpointer });
  }

  /**
   * Execute a single Claude task
   */
  private async executeClaudeTask(task: Task, state: WorkflowState): Promise<any> {
    const query = this.buildQueryFromTask(task, state);
    const sessionId = `${state.workflowId}-${task.id}`;

    appLogger.info('Starting Claude CLI execution', {
      module: 'LangGraphEngine',
      taskId: task.id,
      sessionId,
      agent: task.assigned_agent,
    });

    // Execute via ProcessManager
    const execution = this.processManager.executeCommand({
      projectPath: state.projectPath,
      query,
      sessionId,
    });

    // Monitor heartbeats
    const heartbeatInterval = setInterval(() => {
      this.agentTracker.updateHeartbeat(sessionId);
    }, 30000); // Every 30 seconds

    try {
      // Wait for completion
      const result = await new Promise<any>((resolve, reject) => {
        const events: any[] = [];

        execution.on('stream', (event) => {
          events.push(event);
          this.agentTracker.updateHeartbeat(sessionId);
        });

        execution.on('complete', () => {
          resolve({ success: true, events });
        });

        execution.on('error', (error) => {
          reject(new Error(`Execution error: ${error}`));
        });
      });

      clearInterval(heartbeatInterval);
      return result;
    } catch (error) {
      clearInterval(heartbeatInterval);
      throw error;
    }
  }

  /**
   * Build query string from task
   */
  private buildQueryFromTask(task: Task, state: WorkflowState): string {
    let query = task.description;

    // Add context from previous results if available
    if (task.dependencies && task.dependencies.length > 0) {
      const prevResults = task.dependencies.map((depId) => state.results[depId]).filter(Boolean);

      if (prevResults.length > 0) {
        query += '\n\nPrevious results:\n';
        query += JSON.stringify(prevResults, null, 2);
      }
    }

    return query;
  }

  /**
   * Start workflow execution
   */
  async startWorkflow(
    workflowId: string,
    projectPath: string,
    tasks: Task[],
  ): Promise<WorkflowState> {
    appLogger.info('Starting LangGraph workflow', {
      module: 'LangGraphEngine',
      workflowId,
      projectPath,
      taskCount: tasks.length,
    });

    const graph = this.buildSimpleGraph(tasks);

    const initialState: WorkflowState = {
      workflowId,
      projectPath,
      currentTask: tasks[0]?.id || '',
      completedTasks: [],
      failedTasks: [],
      results: {},
      logs: ['Workflow started'],
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
    };

    const config = {
      configurable: { thread_id: workflowId },
    };

    try {
      // Invoke graph
      const finalState = await graph.invoke(initialState, config);

      appLogger.info('Workflow completed', {
        module: 'LangGraphEngine',
        workflowId,
        completedTasks: finalState.completedTasks.length,
        failedTasks: finalState.failedTasks.length,
      });

      return finalState;
    } catch (error) {
      appLogger.error('Workflow execution failed', {
        module: 'LangGraphEngine',
        workflowId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get current workflow state
   */
  async getWorkflowState(workflowId: string): Promise<WorkflowState | null> {
    const config = { configurable: { thread_id: workflowId } };

    try {
      const checkpoint = await this.checkpointer.get(config);
      if (!checkpoint) {
        appLogger.warn('No checkpoint found', {
          module: 'LangGraphEngine',
          workflowId,
        });
        return null;
      }

      return checkpoint.channel_values as WorkflowState;
    } catch (error) {
      appLogger.error('Failed to get workflow state', {
        module: 'LangGraphEngine',
        workflowId,
        error: String(error),
      });
      return null;
    }
  }

  /**
   * Resume workflow from checkpoint
   */
  async resumeWorkflow(workflowId: string, tasks: Task[]): Promise<WorkflowState> {
    appLogger.info('Resuming workflow', {
      module: 'LangGraphEngine',
      workflowId,
    });

    // Get checkpoint
    const config = { configurable: { thread_id: workflowId } };
    const checkpoint = await this.checkpointer.get(config);

    if (!checkpoint) {
      throw new Error(`No checkpoint found for workflow: ${workflowId}`);
    }

    // Rebuild graph
    const graph = this.buildSimpleGraph(tasks);

    // Get current state
    const currentState = checkpoint.channel_values as WorkflowState;

    // Find next task to execute
    const completedSet = new Set(currentState.completedTasks);
    const nextTask = tasks.find((t) => !completedSet.has(t.id));

    if (!nextTask) {
      appLogger.info('All tasks already completed', {
        module: 'LangGraphEngine',
        workflowId,
      });
      return currentState;
    }

    // Resume from next task
    try {
      const finalState = await graph.invoke(currentState, config);

      appLogger.info('Workflow resumed and completed', {
        module: 'LangGraphEngine',
        workflowId,
        completedTasks: finalState.completedTasks.length,
      });

      return finalState;
    } catch (error) {
      appLogger.error('Failed to resume workflow', {
        module: 'LangGraphEngine',
        workflowId,
        error: String(error),
      });
      throw error;
    }
  }
}
