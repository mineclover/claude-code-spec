/**
 * WorkflowEngine - Automates task execution loop
 *
 * Responsibilities:
 * - Automatic task selection and execution
 * - Dependency-based scheduling
 * - Error handling and retry logic
 * - Progress monitoring and reporting
 * - Workflow lifecycle management
 *
 * Integrates with:
 * - TaskLifecycleManager: Task state management
 * - TaskRouter: Task execution routing
 * - AgentPoolManager: Agent availability
 */

import type { ProcessManager } from '@context-action/code-api';
import { appLogger } from '../main/app-context';
import type { Task } from '../types/task';
import type { AgentPoolManager } from './AgentPoolManager';
import { TaskLifecycleManager } from './TaskLifecycleManager';
import type { TaskExecutionOptions, TaskRouter } from './TaskRouter';

export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export interface WorkflowConfig {
  projectPath: string;
  maxConcurrent?: number; // Maximum concurrent task executions
  maxRetries?: number; // Maximum retry attempts per task
  retryDelay?: number; // Delay between retries in ms
  autoStart?: boolean; // Auto-start workflow on initialization
}

export interface WorkflowState {
  status: WorkflowStatus;
  startedAt?: string;
  completedAt?: string;
  currentTasks: Set<string>; // Currently executing task IDs
  failedTasks: Map<string, number>; // Task ID → Retry count
  completedCount: number;
  totalTasks: number;
}

export interface WorkflowStats {
  status: WorkflowStatus;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  elapsedTime: number; // Milliseconds
  estimatedRemaining?: number; // Milliseconds
}

export interface WorkflowEvent {
  type:
    | 'workflow:started'
    | 'workflow:paused'
    | 'workflow:resumed'
    | 'workflow:completed'
    | 'workflow:failed'
    | 'task:started'
    | 'task:completed'
    | 'task:failed'
    | 'task:retrying';
  timestamp: string;
  data: Record<string, any>;
}

type WorkflowEventListener = (event: WorkflowEvent) => void;

export class WorkflowEngine {
  private config: Required<WorkflowConfig>;
  private lifecycleManager: TaskLifecycleManager;
  private taskRouter: TaskRouter;
  private agentPool: AgentPoolManager;

  private state: WorkflowState;
  private eventListeners: WorkflowEventListener[] = [];
  private executionLoop: Promise<void> | null = null;
  private shouldStop = false;

  constructor(
    config: WorkflowConfig,
    taskRouter: TaskRouter,
    agentPool: AgentPoolManager,
    processManager: ProcessManager,
  ) {
    this.config = {
      maxConcurrent: 3,
      maxRetries: 3,
      retryDelay: 5000,
      autoStart: false,
      ...config,
    };

    this.lifecycleManager = new TaskLifecycleManager(config.projectPath);
    this.taskRouter = taskRouter;
    this.agentPool = agentPool;

    this.state = {
      status: 'idle',
      currentTasks: new Set(),
      failedTasks: new Map(),
      completedCount: 0,
      totalTasks: 0,
    };

    appLogger.info('WorkflowEngine initialized', {
      module: 'WorkflowEngine',
      projectPath: config.projectPath,
      maxConcurrent: this.config.maxConcurrent,
    });

    if (this.config.autoStart) {
      void this.startWorkflow();
    }
  }

  /**
   * Start workflow execution
   */
  async startWorkflow(): Promise<void> {
    if (this.state.status === 'running') {
      appLogger.warn('Workflow already running', {
        module: 'WorkflowEngine',
      });
      return;
    }

    appLogger.info('Starting workflow', {
      module: 'WorkflowEngine',
    });

    // Initialize workflow
    await this.initializeWorkflow();

    this.state.status = 'running';
    this.state.startedAt = new Date().toISOString();
    this.shouldStop = false;

    this.emitEvent({
      type: 'workflow:started',
      timestamp: this.state.startedAt,
      data: {
        totalTasks: this.state.totalTasks,
      },
    });

    // Start execution loop
    this.executionLoop = this.runExecutionLoop();
  }

  /**
   * Pause workflow execution
   */
  async pauseWorkflow(): Promise<void> {
    if (this.state.status !== 'running') {
      appLogger.warn('Workflow not running, cannot pause', {
        module: 'WorkflowEngine',
      });
      return;
    }

    appLogger.info('Pausing workflow', {
      module: 'WorkflowEngine',
    });

    this.shouldStop = true;
    this.state.status = 'paused';

    this.emitEvent({
      type: 'workflow:paused',
      timestamp: new Date().toISOString(),
      data: {
        completedCount: this.state.completedCount,
        currentTasks: Array.from(this.state.currentTasks),
      },
    });

    // Wait for current tasks to complete
    if (this.executionLoop) {
      await this.executionLoop;
      this.executionLoop = null;
    }
  }

  /**
   * Resume paused workflow
   */
  async resumeWorkflow(): Promise<void> {
    if (this.state.status !== 'paused') {
      appLogger.warn('Workflow not paused, cannot resume', {
        module: 'WorkflowEngine',
      });
      return;
    }

    appLogger.info('Resuming workflow', {
      module: 'WorkflowEngine',
    });

    this.state.status = 'running';
    this.shouldStop = false;

    this.emitEvent({
      type: 'workflow:resumed',
      timestamp: new Date().toISOString(),
      data: {},
    });

    this.executionLoop = this.runExecutionLoop();
  }

  /**
   * Stop workflow execution
   */
  async stopWorkflow(): Promise<void> {
    appLogger.info('Stopping workflow', {
      module: 'WorkflowEngine',
    });

    this.shouldStop = true;

    if (this.executionLoop) {
      await this.executionLoop;
      this.executionLoop = null;
    }

    this.state.status = 'idle';
    this.state.currentTasks.clear();

    appLogger.info('Workflow stopped', {
      module: 'WorkflowEngine',
    });
  }

  /**
   * Get workflow statistics
   */
  async getStats(): Promise<WorkflowStats> {
    const taskStats = await this.lifecycleManager.getTaskStats();

    const elapsedTime = this.state.startedAt
      ? Date.now() - new Date(this.state.startedAt).getTime()
      : 0;

    // Estimate remaining time based on average task completion time
    let estimatedRemaining: number | undefined;
    if (this.state.completedCount > 0 && taskStats.pending > 0) {
      const avgTaskTime = elapsedTime / this.state.completedCount;
      estimatedRemaining = avgTaskTime * taskStats.pending;
    }

    return {
      status: this.state.status,
      totalTasks: taskStats.total,
      completedTasks: taskStats.completed,
      failedTasks: taskStats.cancelled,
      inProgressTasks: taskStats.inProgress,
      pendingTasks: taskStats.pending,
      elapsedTime,
      estimatedRemaining,
    };
  }

  /**
   * Subscribe to workflow events
   */
  on(listener: WorkflowEventListener): () => void {
    this.eventListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Initialize workflow state
   */
  private async initializeWorkflow(): Promise<void> {
    appLogger.info('Initializing workflow', {
      module: 'WorkflowEngine',
    });

    // Load all tasks
    const taskStats = await this.lifecycleManager.getTaskStats();
    this.state.totalTasks = taskStats.total;
    this.state.completedCount = taskStats.completed;
    this.state.currentTasks.clear();
    this.state.failedTasks.clear();

    appLogger.info('Workflow initialized', {
      module: 'WorkflowEngine',
      totalTasks: this.state.totalTasks,
      pending: taskStats.pending,
      inProgress: taskStats.inProgress,
      completed: taskStats.completed,
    });
  }

  /**
   * Main execution loop
   */
  private async runExecutionLoop(): Promise<void> {
    appLogger.info('Starting execution loop', {
      module: 'WorkflowEngine',
    });

    while (!this.shouldStop) {
      try {
        // Check if we have capacity for more tasks
        if (this.state.currentTasks.size >= this.config.maxConcurrent) {
          // Wait before checking again
          await this.sleep(1000);
          continue;
        }

        // Get next task
        const nextTask = await this.lifecycleManager.getNextTask();

        if (!nextTask) {
          // No executable tasks available
          if (this.state.currentTasks.size === 0) {
            // All tasks completed or no tasks left
            await this.completeWorkflow();
            break;
          }

          // Wait for current tasks to complete
          await this.sleep(2000);
          continue;
        }

        // Execute task (non-blocking)
        void this.executeTask(nextTask);

        // Small delay to prevent tight loop
        await this.sleep(100);
      } catch (error) {
        appLogger.error(
          'Error in execution loop',
          error instanceof Error ? error : undefined,
          {
            module: 'WorkflowEngine',
          },
        );

        await this.sleep(5000); // Wait before retrying
      }
    }

    appLogger.info('Execution loop stopped', {
      module: 'WorkflowEngine',
    });
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: Task): Promise<void> {
    const taskId = task.id;

    // Mark as currently executing
    this.state.currentTasks.add(taskId);

    appLogger.info('Executing task', {
      module: 'WorkflowEngine',
      taskId,
      assignedAgent: task.assigned_agent,
    });

    this.emitEvent({
      type: 'task:started',
      timestamp: new Date().toISOString(),
      data: {
        taskId,
        title: task.title,
        assignedAgent: task.assigned_agent,
      },
    });

    try {
      // Start task (mark as in_progress)
      const startResult = await this.lifecycleManager.startTask(taskId, task.assigned_agent);

      if (!startResult.success) {
        throw new Error(startResult.error || 'Failed to start task');
      }

      // Route task to agent
      const taskWithPath = {
        ...task,
        projectPath: this.config.projectPath,
      };

      const sessionId = await this.taskRouter.routeTask(taskWithPath as any);

      appLogger.info('Task execution initiated', {
        module: 'WorkflowEngine',
        taskId,
        sessionId,
      });

      // Wait for execution to complete
      await this.waitForExecution(sessionId);

      // Mark task as completed
      await this.lifecycleManager.completeTask(taskId, task.assigned_agent);

      this.state.completedCount++;

      appLogger.info('Task completed successfully', {
        module: 'WorkflowEngine',
        taskId,
        sessionId,
      });

      this.emitEvent({
        type: 'task:completed',
        timestamp: new Date().toISOString(),
        data: {
          taskId,
          sessionId,
        },
      });

      // Reset retry count on success
      this.state.failedTasks.delete(taskId);
    } catch (error) {
      appLogger.error(
        'Task execution failed',
        error instanceof Error ? error : undefined,
        {
          module: 'WorkflowEngine',
          taskId,
        },
      );

      // Handle retry logic
      const retryCount = this.state.failedTasks.get(taskId) || 0;

      if (retryCount < this.config.maxRetries) {
        // Retry
        this.state.failedTasks.set(taskId, retryCount + 1);

        appLogger.info('Retrying task', {
          module: 'WorkflowEngine',
          taskId,
          retryCount: retryCount + 1,
          maxRetries: this.config.maxRetries,
        });

        this.emitEvent({
          type: 'task:retrying',
          timestamp: new Date().toISOString(),
          data: {
            taskId,
            retryCount: retryCount + 1,
            error: error instanceof Error ? error.message : String(error),
          },
        });

        // Reset task to pending for retry
        await this.lifecycleManager.updateTaskStatus(taskId, 'pending');

        // Wait before retry
        await this.sleep(this.config.retryDelay);
      } else {
        // Max retries exceeded, mark as failed
        await this.lifecycleManager.updateTaskStatus(taskId, 'cancelled');

        this.emitEvent({
          type: 'task:failed',
          timestamp: new Date().toISOString(),
          data: {
            taskId,
            error: error instanceof Error ? error.message : String(error),
            retryCount,
          },
        });
      }
    } finally {
      // Remove from currently executing
      this.state.currentTasks.delete(taskId);
    }
  }

  /**
   * Wait for execution to complete
   * TODO: Implement proper execution completion tracking
   */
  private async waitForExecution(sessionId: string): Promise<void> {
    // For now, just wait a fixed time
    // In a real implementation, we would subscribe to execution completion events
    await this.sleep(1000);

    // TODO: Implement proper waiting logic
    // - Subscribe to ProcessManager completion events
    // - Check execution status
    // - Wait until status is 'completed' or 'failed'
  }

  /**
   * Complete workflow
   */
  private async completeWorkflow(): Promise<void> {
    this.state.status = 'completed';
    this.state.completedAt = new Date().toISOString();

    const stats = await this.getStats();

    appLogger.info('Workflow completed', {
      module: 'WorkflowEngine',
      totalTasks: stats.totalTasks,
      completedTasks: stats.completedTasks,
      failedTasks: stats.failedTasks,
      elapsedTime: stats.elapsedTime,
    });

    this.emitEvent({
      type: 'workflow:completed',
      timestamp: this.state.completedAt,
      data: {
        totalTasks: stats.totalTasks,
        completedTasks: stats.completedTasks,
        failedTasks: stats.failedTasks,
        elapsedTime: stats.elapsedTime,
      },
    });
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: WorkflowEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        appLogger.error(
          'Error in event listener',
          error instanceof Error ? error : undefined,
          {
            module: 'WorkflowEngine',
            eventType: event.type,
          },
        );
      }
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
