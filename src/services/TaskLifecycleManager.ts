/**
 * TaskLifecycleManager - Manages task lifecycle, state transitions, and dependencies
 *
 * Responsibilities:
 * - Task state transitions (pending → in_progress → completed)
 * - Dependency resolution and checking
 * - Task execution eligibility
 * - Status updates and history tracking
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { TaskValidator } from '../lib/TaskValidator';
import { generateTaskMarkdown, parseTaskMarkdown } from '../lib/taskParser';
import { appLogger } from '../main/app-context';
import type { Task, TaskMetadata } from '../types/task';

export interface TaskDependency {
  taskId: string;
  dependsOn: string[]; // Task IDs
}

export interface TaskExecutionCheck {
  canExecute: boolean;
  reason?: string;
  blockingTasks?: string[];
}

export interface TaskStatusUpdate {
  taskId: string;
  oldStatus: TaskMetadata['status'];
  newStatus: TaskMetadata['status'];
  timestamp: string;
  updatedBy?: string; // Agent or human identifier
}

export class TaskLifecycleManager {
  private projectPath: string;
  private statusHistory: TaskStatusUpdate[] = [];

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.validator = new TaskValidator(projectPath);

    appLogger.info('TaskLifecycleManager initialized', {
      module: 'TaskLifecycleManager',
      projectPath,
    });
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    try {
      const taskPath = path.join(this.projectPath, 'workflow', 'tasks', `${taskId}.md`);
      const content = await fs.readFile(taskPath, 'utf-8');
      return parseTaskMarkdown(content);
    } catch (error) {
      appLogger.error('Failed to get task', error instanceof Error ? error : undefined, {
        module: 'TaskLifecycleManager',
        taskId,
      });
      return null;
    }
  }

  /**
   * Update task status with validation
   */
  async updateTaskStatus(
    taskId: string,
    newStatus: TaskMetadata['status'],
    updatedBy?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const task = await this.getTask(taskId);

      if (!task) {
        return { success: false, error: 'Task not found' };
      }

      // Validate state transition
      const transitionValid = this.isValidStateTransition(task.status, newStatus);
      if (!transitionValid) {
        return {
          success: false,
          error: `Invalid state transition: ${task.status} → ${newStatus}`,
        };
      }

      // Record old status for history
      const oldStatus = task.status;

      // Update task
      task.status = newStatus;
      task.updated = new Date().toISOString();

      // Save task
      const content = generateTaskMarkdown(task);
      const taskPath = path.join(this.projectPath, 'workflow', 'tasks', `${taskId}.md`);
      await fs.writeFile(taskPath, content, 'utf-8');

      // Record status change
      this.statusHistory.push({
        taskId,
        oldStatus,
        newStatus,
        timestamp: task.updated,
        updatedBy,
      });

      appLogger.info('Task status updated', {
        module: 'TaskLifecycleManager',
        taskId,
        oldStatus,
        newStatus,
        updatedBy,
      });

      return { success: true };
    } catch (error) {
      appLogger.error('Failed to update task status', error instanceof Error ? error : undefined, {
        module: 'TaskLifecycleManager',
        taskId,
        newStatus,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if state transition is valid
   */
  private isValidStateTransition(
    currentStatus: TaskMetadata['status'],
    newStatus: TaskMetadata['status'],
  ): boolean {
    // Define valid transitions
    const validTransitions: Record<TaskMetadata['status'], TaskMetadata['status'][]> = {
      pending: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'pending', 'cancelled'],
      completed: ['in_progress'], // Allow reopening
      cancelled: ['pending'], // Allow reactivation
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Check if task can be executed (dependencies satisfied)
   */
  async canExecuteTask(taskId: string): Promise<TaskExecutionCheck> {
    const task = await this.getTask(taskId);

    if (!task) {
      return {
        canExecute: false,
        reason: 'Task not found',
      };
    }

    // Check if already completed or cancelled
    if (task.status === 'completed') {
      return {
        canExecute: false,
        reason: 'Task already completed',
      };
    }

    if (task.status === 'cancelled') {
      return {
        canExecute: false,
        reason: 'Task is cancelled',
      };
    }

    // Extract dependencies from description (look for "depends on task-XXX" pattern)
    const dependencies = this.extractDependencies(task.description);

    if (dependencies.length === 0) {
      return { canExecute: true };
    }

    // Check if all dependencies are completed
    const blockingTasks: string[] = [];

    for (const depId of dependencies) {
      const depTask = await this.getTask(depId);

      if (!depTask) {
        appLogger.warn('Dependency task not found', {
          module: 'TaskLifecycleManager',
          taskId,
          dependencyId: depId,
        });
        continue;
      }

      if (depTask.status !== 'completed') {
        blockingTasks.push(depId);
      }
    }

    if (blockingTasks.length > 0) {
      return {
        canExecute: false,
        reason: `Waiting for ${blockingTasks.length} dependency task(s) to complete`,
        blockingTasks,
      };
    }

    return { canExecute: true };
  }

  /**
   * Extract task dependencies from description
   * Looks for patterns like "depends on task-001" or "requires task-002"
   */
  private extractDependencies(description: string): string[] {
    const dependencies: string[] = [];
    const patterns = [
      /depends on (task-\d+)/gi,
      /requires (task-\d+)/gi,
      /after (task-\d+)/gi,
      /blocked by (task-\d+)/gi,
    ];

    for (const pattern of patterns) {
      const matches = description.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && !dependencies.includes(match[1])) {
          dependencies.push(match[1]);
        }
      }
    }

    return dependencies;
  }

  /**
   * Get all executable tasks (no blocking dependencies)
   */
  async getExecutableTasks(): Promise<Task[]> {
    const allTasks = await this.getAllTasks();
    const executableTasks: Task[] = [];

    for (const task of allTasks) {
      const check = await this.canExecuteTask(task.id);

      if (check.canExecute) {
        executableTasks.push(task);
      }
    }

    return executableTasks;
  }

  /**
   * Get all tasks
   */
  private async getAllTasks(): Promise<Task[]> {
    const tasks: Task[] = [];

    try {
      const tasksDir = path.join(this.projectPath, 'workflow', 'tasks');
      const files = await fs.readdir(tasksDir);
      const taskFiles = files.filter((f) => f.endsWith('.md'));

      for (const file of taskFiles) {
        const taskId = path.basename(file, '.md');
        const task = await this.getTask(taskId);

        if (task) {
          tasks.push(task);
        }
      }
    } catch (error) {
      appLogger.error('Failed to get all tasks', error instanceof Error ? error : undefined, {
        module: 'TaskLifecycleManager',
      });
    }

    return tasks;
  }

  /**
   * Get tasks by status
   */
  async getTasksByStatus(status: TaskMetadata['status']): Promise<Task[]> {
    const allTasks = await this.getAllTasks();
    return allTasks.filter((task) => task.status === status);
  }

  /**
   * Get next task to execute (highest priority, no blockers)
   */
  async getNextTask(): Promise<Task | null> {
    const executableTasks = await this.getExecutableTasks();

    if (executableTasks.length === 0) {
      return null;
    }

    // Prioritize by:
    // 1. Tasks with status 'in_progress' (resume interrupted work)
    // 2. Tasks with earliest creation date (FIFO)

    const inProgressTasks = executableTasks.filter((t) => t.status === 'in_progress');
    if (inProgressTasks.length > 0) {
      return inProgressTasks[0];
    }

    // Sort by creation date
    executableTasks.sort((a, b) => {
      const dateA = new Date(a.created).getTime();
      const dateB = new Date(b.created).getTime();
      return dateA - dateB;
    });

    return executableTasks[0];
  }

  /**
   * Start task execution (mark as in_progress)
   */
  async startTask(
    taskId: string,
    agentName?: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Check if task can be executed
    const check = await this.canExecuteTask(taskId);

    if (!check.canExecute) {
      return {
        success: false,
        error: check.reason,
      };
    }

    // Update status to in_progress
    return await this.updateTaskStatus(taskId, 'in_progress', agentName);
  }

  /**
   * Complete task (mark as completed)
   */
  async completeTask(
    taskId: string,
    agentName?: string,
    reviewNotes?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const task = await this.getTask(taskId);

      if (!task) {
        return { success: false, error: 'Task not found' };
      }

      // Add review notes if provided
      if (reviewNotes) {
        task.reviewNotes = reviewNotes;
      }

      // Update status
      task.status = 'completed';
      task.updated = new Date().toISOString();

      // Save
      const content = generateTaskMarkdown(task);
      const taskPath = path.join(this.projectPath, 'workflow', 'tasks', `${taskId}.md`);
      await fs.writeFile(taskPath, content, 'utf-8');

      // Record history
      this.statusHistory.push({
        taskId,
        oldStatus: 'in_progress',
        newStatus: 'completed',
        timestamp: task.updated,
        updatedBy: agentName,
      });

      appLogger.info('Task completed', {
        module: 'TaskLifecycleManager',
        taskId,
        agentName,
      });

      return { success: true };
    } catch (error) {
      appLogger.error('Failed to complete task', error instanceof Error ? error : undefined, {
        module: 'TaskLifecycleManager',
        taskId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get status history
   */
  getStatusHistory(): TaskStatusUpdate[] {
    return [...this.statusHistory];
  }

  /**
   * Get task statistics
   */
  async getTaskStats(): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    executable: number;
  }> {
    const allTasks = await this.getAllTasks();
    const executableTasks = await this.getExecutableTasks();

    return {
      total: allTasks.length,
      pending: allTasks.filter((t) => t.status === 'pending').length,
      inProgress: allTasks.filter((t) => t.status === 'in_progress').length,
      completed: allTasks.filter((t) => t.status === 'completed').length,
      cancelled: allTasks.filter((t) => t.status === 'cancelled').length,
      executable: executableTasks.length,
    };
  }
}
