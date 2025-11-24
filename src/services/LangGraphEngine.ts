/**
 * LangGraphEngine - Workflow execution engine using LangGraph
 *
 * POC Implementation:
 * - Simple sequential task execution
 * - State management with checkpoints
 * - Integration with ProcessManager and AgentTracker
 *
 * Phase 2 Implementation:
 * - Real-time state updates via EventEmitter
 * - Stream event to state mapping
 * - CentralDatabase integration
 * - Checkpoint resume mechanism
 */

import type { ProcessManager, StreamEvent } from '@context-action/code-api';
import { Annotation, END, MemorySaver, StateGraph } from '@langchain/langgraph';
import { EventEmitter } from 'node:events';
import { appLogger } from '../main/app-context';
import type { Task } from '../types/task';
import type { WorkflowExecution } from '../types/report';
import type { AgentTracker } from './AgentTracker';
import type { CentralDatabase } from './CentralDatabase';

// Type guards for stream events
function isAssistantEvent(
  event: StreamEvent,
): event is Extract<StreamEvent, { type: 'assistant' }> {
  return event.type === 'assistant';
}

function isResultEvent(event: StreamEvent): event is Extract<StreamEvent, { type: 'result' }> {
  return event.type === 'result';
}

// Task execution status
export type TaskExecutionStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface TaskProgress {
  status: TaskExecutionStatus;
  currentTool?: string; // Current tool being used
  eventCount: number; // Number of events received
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    totalCostUSD: number;
  };
  lastActivity: number; // Timestamp of last activity
}

// Phase 4: Approval request
export interface ApprovalRequest {
  taskId: string;
  message: string;
  approver?: string;
  requestedAt: number;
}

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
  // Phase 2: Real-time task progress tracking
  taskProgress: Annotation<Record<string, TaskProgress>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  // Phase 4: Human-in-the-loop
  pendingApprovals: Annotation<ApprovalRequest[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  startTime: Annotation<number>,
  lastUpdateTime: Annotation<number>,
});

export type WorkflowState = typeof WorkflowStateAnnotation.State;

// Event types for real-time updates
export interface StateUpdateEvent {
  workflowId: string;
  state: WorkflowState;
  taskId?: string;
  eventType: 'task_started' | 'task_completed' | 'task_failed' | 'workflow_completed';
}

export class LangGraphEngine extends EventEmitter {
  private processManager: ProcessManager;
  private agentTracker: AgentTracker;
  private database: CentralDatabase;
  private checkpointer = new MemorySaver();
  // Phase 4: Approval handling
  private approvalResolvers: Map<string, (approved: boolean) => void> = new Map();

  constructor(
    processManager: ProcessManager,
    agentTracker: AgentTracker,
    database: CentralDatabase,
  ) {
    super();
    this.processManager = processManager;
    this.agentTracker = agentTracker;
    this.database = database;

    appLogger.info('LangGraphEngine initialized', {
      module: 'LangGraphEngine',
    });
  }

  /**
   * Phase 4: Request approval for a task (Human-in-the-loop)
   */
  private async requestApproval(
    workflowId: string,
    task: Task,
    state: WorkflowState,
  ): Promise<boolean> {
    if (!task.approval?.required) {
      return true; // No approval required
    }

    const approvalRequest: ApprovalRequest = {
      taskId: task.id,
      message: task.approval.message,
      approver: task.approval.approver,
      requestedAt: Date.now(),
    };

    appLogger.info('Requesting approval', {
      module: 'LangGraphEngine',
      workflowId,
      taskId: task.id,
    });

    // Emit approval request event
    this.emit('approvalRequest', {
      workflowId,
      taskId: task.id,
      request: approvalRequest,
      state,
    });

    // Wait for approval with optional timeout
    return new Promise<boolean>((resolve) => {
      this.approvalResolvers.set(task.id, resolve);

      if (task.approval?.timeout) {
        setTimeout(() => {
          if (this.approvalResolvers.has(task.id)) {
            appLogger.warn('Approval timeout', {
              module: 'LangGraphEngine',
              taskId: task.id,
            });
            this.approvalResolvers.delete(task.id);
            resolve(false); // Timeout = rejection
          }
        }, task.approval.timeout);
      }
    });
  }

  /**
   * Phase 4: Respond to approval request
   */
  respondToApproval(taskId: string, approved: boolean): void {
    const resolver = this.approvalResolvers.get(taskId);
    if (resolver) {
      appLogger.info('Approval response received', {
        module: 'LangGraphEngine',
        taskId,
        approved,
      });
      resolver(approved);
      this.approvalResolvers.delete(taskId);
    } else {
      appLogger.warn('No pending approval for task', {
        module: 'LangGraphEngine',
        taskId,
      });
    }
  }

  /**
   * Analyze task dependencies and determine execution levels
   * Returns tasks grouped by execution level (0 = no deps, 1 = depends on level 0, etc.)
   */
  private analyzeDependencies(tasks: Task[]): Task[][] {
    const taskMap = new Map<string, Task>();
    const levels: Task[][] = [];
    const taskLevels = new Map<string, number>();

    // Build task map
    for (const task of tasks) {
      taskMap.set(task.id, task);
    }

    // Calculate level for each task (topological sort by level)
    const calculateLevel = (taskId: string, visited = new Set<string>()): number => {
      if (taskLevels.has(taskId)) {
        return taskLevels.get(taskId)!;
      }

      if (visited.has(taskId)) {
        throw new Error(`Circular dependency detected involving task: ${taskId}`);
      }

      visited.add(taskId);
      const task = taskMap.get(taskId);

      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // If no dependencies, level is 0
      if (!task.dependencies || task.dependencies.length === 0) {
        taskLevels.set(taskId, 0);
        return 0;
      }

      // Calculate level based on dependencies
      let maxDepLevel = -1;
      for (const depId of task.dependencies) {
        const depLevel = calculateLevel(depId, new Set(visited));
        maxDepLevel = Math.max(maxDepLevel, depLevel);
      }

      const level = maxDepLevel + 1;
      taskLevels.set(taskId, level);
      return level;
    };

    // Calculate levels for all tasks
    for (const task of tasks) {
      calculateLevel(task.id);
    }

    // Group tasks by level
    for (const task of tasks) {
      const level = taskLevels.get(task.id)!;
      if (!levels[level]) {
        levels[level] = [];
      }
      levels[level].push(task);
    }

    return levels;
  }

  /**
   * Build a dependency-aware graph from tasks
   * Tasks with dependencies will execute after their dependencies complete
   * Tasks at the same level (no inter-dependencies) can execute in parallel
   */
  buildGraph(tasks: Task[]) {
    const graph = new StateGraph(WorkflowStateAnnotation);

    appLogger.info('Building LangGraph with dependencies', {
      module: 'LangGraphEngine',
      taskCount: tasks.length,
      taskIds: tasks.map((t) => t.id),
    });

    // Analyze dependencies and group by execution level
    const levels = this.analyzeDependencies(tasks);

    appLogger.info('Dependency analysis complete', {
      module: 'LangGraphEngine',
      levelCount: levels.length,
      levels: levels.map((level, idx) => ({
        level: idx,
        tasks: level.map((t) => t.id),
      })),
    });

    // Add nodes for each task
    for (const task of tasks) {
      graph.addNode(task.id, async (state: WorkflowState) => {
        appLogger.info('Executing task node', {
          module: 'LangGraphEngine',
          taskId: task.id,
          workflowId: state.workflowId,
        });

        // Emit task_started event
        this.emit('stateUpdate', {
          workflowId: state.workflowId,
          state: {
            ...state,
            currentTask: task.id,
          },
          taskId: task.id,
          eventType: 'task_started',
        } as StateUpdateEvent);

        // Phase 4: Request approval if required (Human-in-the-loop)
        if (task.approval?.required) {
          const approved = await this.requestApproval(state.workflowId, task, state);
          if (!approved) {
            // Approval denied
            appLogger.warn('Task approval denied', {
              module: 'LangGraphEngine',
              taskId: task.id,
            });

            const deniedState = {
              failedTasks: [task.id],
              results: { [task.id]: { error: 'Approval denied by user' } },
              logs: [`Task ${task.id} approval denied`],
              taskProgress: {
                [task.id]: {
                  status: 'failed' as const,
                  eventCount: 0,
                  lastActivity: Date.now(),
                },
              },
              lastUpdateTime: Date.now(),
            };

            this.emit('stateUpdate', {
              workflowId: state.workflowId,
              state: {
                ...state,
                ...deniedState,
              },
              taskId: task.id,
              eventType: 'task_failed',
            } as StateUpdateEvent);

            return deniedState;
          }
        }

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
            progress: result.progress,
          });

          const updatedState = {
            completedTasks: [task.id],
            results: { [task.id]: result },
            logs: [`Task ${task.id} completed successfully`],
            taskProgress: {
              [task.id]: result.progress || {
                status: 'completed',
                eventCount: result.events?.length || 0,
                lastActivity: Date.now(),
              },
            },
            lastUpdateTime: Date.now(),
          };

          // Emit task_completed event
          this.emit('stateUpdate', {
            workflowId: state.workflowId,
            state: {
              ...state,
              ...updatedState,
            },
            taskId: task.id,
            eventType: 'task_completed',
          } as StateUpdateEvent);

          return updatedState;
        } catch (error) {
          await this.agentTracker.updateStatus(sessionId, 'failed');

          appLogger.error('Task execution failed', {
            module: 'LangGraphEngine',
            taskId: task.id,
            sessionId,
            error: String(error),
          });

          const errorState = {
            failedTasks: [task.id],
            results: { [task.id]: { error: String(error) } },
            logs: [`Task ${task.id} failed: ${String(error)}`],
            taskProgress: {
              [task.id]: {
                status: 'failed',
                eventCount: 0,
                lastActivity: Date.now(),
              },
            },
            lastUpdateTime: Date.now(),
          };

          // Emit task_failed event
          this.emit('stateUpdate', {
            workflowId: state.workflowId,
            state: {
              ...state,
              ...errorState,
            },
            taskId: task.id,
            eventType: 'task_failed',
          } as StateUpdateEvent);

          return errorState;
        }
      });
    }

    // Add edges based on dependencies
    if (tasks.length === 0) {
      return graph.compile({ checkpointer: this.checkpointer });
    }

    // Connect __start__ to all level 0 tasks (no dependencies)
    const level0Tasks = levels[0] || [];
    for (const task of level0Tasks) {
      graph.addEdge('__start__', task.id);
    }

    // Connect tasks to their dependencies
    for (const task of tasks) {
      if (task.dependencies && task.dependencies.length > 0) {
        // Add edge from each dependency to this task
        for (const depId of task.dependencies) {
          graph.addEdge(depId, task.id);
        }
      }
    }

    // Connect final level tasks to END
    const finalLevel = levels[levels.length - 1] || [];
    for (const task of finalLevel) {
      graph.addEdge(task.id, END);
    }

    appLogger.info('Graph edges configured', {
      module: 'LangGraphEngine',
      startNodes: level0Tasks.map((t) => t.id),
      endNodes: finalLevel.map((t) => t.id),
    });

    return graph.compile({ checkpointer: this.checkpointer });
  }

  /**
   * Build a simple sequential graph from tasks (legacy, for backward compatibility)
   */
  buildSimpleGraph(tasks: Task[]) {
    // Redirect to buildGraph which handles both cases
    return this.buildGraph(tasks);
  }

  /**
   * Execute a single Claude task with real-time progress tracking
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

    // Execute via ProcessManager with data-flow output style
    await this.processManager.startExecution({
      projectPath: state.projectPath,
      query,
      sessionId,
      outputStyle: 'data-flow', // Use data-flow style for workflow data tracking
      agentName: task.assigned_agent,
      taskId: task.id,
    });

    // Get execution info
    const executionInfo = this.processManager.getExecution(sessionId);
    if (!executionInfo) {
      throw new Error(`Execution not found: ${sessionId}`);
    }
    const execution = executionInfo.client;

    // Initialize task progress
    const progress: TaskProgress = {
      status: 'running',
      eventCount: 0,
      lastActivity: Date.now(),
    };

    // Monitor heartbeats
    const heartbeatInterval = setInterval(() => {
      this.agentTracker.updateHeartbeat(sessionId);
    }, 30000); // Every 30 seconds

    try {
      // Wait for completion with real-time event analysis
      const result = await new Promise<any>((resolve, reject) => {
        const events: StreamEvent[] = [];

        execution.on('stream', (event: StreamEvent) => {
          events.push(event);
          progress.eventCount++;
          progress.lastActivity = Date.now();

          this.agentTracker.updateHeartbeat(sessionId);

          // Analyze assistant events for tool usage
          if (isAssistantEvent(event) && 'message' in event) {
            const toolUses = event.message.content.filter((c) => c.type === 'tool_use');
            if (toolUses.length > 0) {
              const lastTool = toolUses[toolUses.length - 1];
              if ('name' in lastTool) {
                progress.currentTool = lastTool.name;
                appLogger.debug('Tool use detected', {
                  module: 'LangGraphEngine',
                  taskId: task.id,
                  tool: lastTool.name,
                });
              }
            }
          }

          // Analyze result event for token usage
          if (isResultEvent(event)) {
            const usage = event.usage;
            progress.tokenUsage = {
              inputTokens: usage.input_tokens || 0,
              outputTokens: usage.output_tokens || 0,
              cacheReadTokens: usage.cache_read_input_tokens || 0,
              totalCostUSD: event.total_cost_usd || 0,
            };

            appLogger.info('Task execution metrics', {
              module: 'LangGraphEngine',
              taskId: task.id,
              tokenUsage: progress.tokenUsage,
            });
          }
        });

        execution.on('complete', () => {
          progress.status = 'completed';
          resolve({ success: true, events, progress });
        });

        execution.on('error', (error) => {
          progress.status = 'failed';
          reject(new Error(`Execution error: ${error}`));
        });
      });

      clearInterval(heartbeatInterval);
      return result;
    } catch (error) {
      clearInterval(heartbeatInterval);
      progress.status = 'failed';
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
    const startTime = Date.now();

    appLogger.info('Starting LangGraph workflow', {
      module: 'LangGraphEngine',
      workflowId,
      projectPath,
      taskCount: tasks.length,
    });

    // Create initial workflow execution record
    const workflowExecution: WorkflowExecution = {
      workflowId,
      projectPath,
      status: 'running',
      startedAt: new Date().toISOString(),
      tasks: {
        total: tasks.length,
        completed: 0,
        failed: 0,
        taskIds: tasks.map((t) => t.id),
      },
      metrics: {
        totalTokens: { input: 0, output: 0, cacheRead: 0 },
        totalCost: 0,
        avgTaskDuration: 0,
      },
    };

    // Save initial workflow state
    await this.database.saveWorkflowExecution(workflowExecution);

    const graph = this.buildSimpleGraph(tasks);

    const initialState: WorkflowState = {
      workflowId,
      projectPath,
      currentTask: tasks[0]?.id || '',
      completedTasks: [],
      failedTasks: [],
      results: {},
      logs: ['Workflow started'],
      taskProgress: {},
      startTime,
      lastUpdateTime: Date.now(),
    };

    const config = {
      configurable: { thread_id: workflowId },
    };

    try {
      // Invoke graph
      const finalState = await graph.invoke(initialState, config);

      // Calculate aggregate metrics from taskProgress
      const allProgress = Object.values(finalState.taskProgress);
      const totalTokens = {
        input: allProgress.reduce((sum, p) => sum + (p.tokenUsage?.inputTokens || 0), 0),
        output: allProgress.reduce((sum, p) => sum + (p.tokenUsage?.outputTokens || 0), 0),
        cacheRead: allProgress.reduce((sum, p) => sum + (p.tokenUsage?.cacheReadTokens || 0), 0),
      };

      // Update workflow execution with final state
      workflowExecution.status =
        finalState.failedTasks.length > 0
          ? finalState.completedTasks.length > 0
            ? 'partial'
            : 'failed'
          : 'completed';
      workflowExecution.completedAt = new Date().toISOString();
      workflowExecution.duration = Date.now() - startTime;
      workflowExecution.tasks.completed = finalState.completedTasks.length;
      workflowExecution.tasks.failed = finalState.failedTasks.length;
      workflowExecution.metrics = {
        totalTokens,
        totalCost: allProgress.reduce((sum, p) => sum + (p.tokenUsage?.totalCostUSD || 0), 0),
        avgTaskDuration: tasks.length > 0 ? (Date.now() - startTime) / tasks.length : 0,
      };
      workflowExecution.finalState = {
        completedTasks: finalState.completedTasks,
        failedTasks: finalState.failedTasks,
        logs: finalState.logs,
      };

      // Save final workflow state
      await this.database.saveWorkflowExecution(workflowExecution);

      appLogger.info('Workflow completed', {
        module: 'LangGraphEngine',
        workflowId,
        completedTasks: finalState.completedTasks.length,
        failedTasks: finalState.failedTasks.length,
        duration: workflowExecution.duration,
        totalCost: workflowExecution.metrics.totalCost,
      });

      // Emit workflow_completed event
      this.emit('stateUpdate', {
        workflowId,
        state: finalState,
        eventType: 'workflow_completed',
      } as StateUpdateEvent);

      return finalState;
    } catch (error) {
      // Update workflow execution with error
      workflowExecution.status = 'failed';
      workflowExecution.completedAt = new Date().toISOString();
      workflowExecution.duration = Date.now() - startTime;
      workflowExecution.error = String(error);

      await this.database.saveWorkflowExecution(workflowExecution);

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
