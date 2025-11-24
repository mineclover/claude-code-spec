/**
 * LangGraphEngine - Workflow execution engine using LangGraph
 *
 * POC Implementation:
 * - Simple sequential task execution
 * - State management with checkpoints
 * - Integration with ProcessManager and AgentTracker
 */

import type { ProcessManager, StreamEvent } from '@context-action/code-api';
import { Annotation, END, MemorySaver, StateGraph } from '@langchain/langgraph';
import { appLogger } from '../main/app-context';
import type { Task } from '../types/task';
import type { AgentTracker } from './AgentTracker';

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

          return {
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
            taskProgress: {
              [task.id]: {
                status: 'failed',
                eventCount: 0,
                lastActivity: Date.now(),
              },
            },
            lastUpdateTime: Date.now(),
          };
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

    // Execute via ProcessManager
    const execution = this.processManager.executeCommand({
      projectPath: state.projectPath,
      query,
      sessionId,
    });

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
      taskProgress: {},
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
