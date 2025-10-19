/**
 * ProcessManager - Manages multiple Claude CLI executions
 *
 * Enables parallel execution of Claude CLI sessions with independent
 * stream handling and execution lifecycle management.
 *
 * Uses sessionId (from Claude CLI session logs) as the primary identifier
 * for tracking executions, enabling persistence and recovery.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { ClaudeClient, type ClaudeClientOptions } from '../lib/ClaudeClient';
import type { StreamEvent } from '../lib/types';
import { isSystemInitEvent } from '../lib/types';

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'killed';

export interface ExecutionInfo {
  sessionId: string;
  projectPath: string;
  query: string;
  status: ExecutionStatus;
  pid: number | null;
  client: ClaudeClient;
  events: StreamEvent[];
  errors: string[];
  startTime: number;
  endTime: number | null;
  mcpConfig?: string;
  model?: 'sonnet' | 'opus';
  skillId?: string;
  skillScope?: 'global' | 'project';
}

export interface StartExecutionParams {
  projectPath: string;
  query: string;
  sessionId?: string;
  mcpConfig?: string;
  model?: 'sonnet' | 'opus';
  skillId?: string;
  skillScope?: 'global' | 'project';
  onStream?: (sessionId: string, event: StreamEvent) => void;
  onError?: (sessionId: string, error: string) => void;
  onComplete?: (sessionId: string, code: number) => void;
}

export class ProcessManager {
  private executions: Map<string, ExecutionInfo> = new Map();
  private maxConcurrent: number = 10; // Maximum concurrent executions
  private executionsChangeListener?: () => void;

  /**
   * Set listener for executions state changes
   */
  setExecutionsChangeListener(listener: () => void): void {
    this.executionsChangeListener = listener;
  }

  /**
   * Notify listeners of executions state change
   */
  private notifyExecutionsChanged(): void {
    if (this.executionsChangeListener) {
      this.executionsChangeListener();
    }
  }

  /**
   * Start a new execution
   * Returns a Promise that resolves with sessionId once it's received from Claude CLI
   */
  async startExecution(params: StartExecutionParams): Promise<string> {
    // Check concurrent execution limit
    const activeCount = this.getActiveExecutions().length;
    if (activeCount >= this.maxConcurrent) {
      throw new Error(`Maximum concurrent executions (${this.maxConcurrent}) reached`);
    }

    console.log('[ProcessManager] Starting execution:', {
      projectPath: params.projectPath,
      query: params.query.substring(0, 50) + '...',
      resumeSession: params.sessionId || 'new',
      skillId: params.skillId,
      skillScope: params.skillScope,
    });

    // Load skill content if specified
    let enhancedQuery = params.query;
    if (params.skillId && params.skillScope) {
      try {
        const skillContent = await this.loadSkillContent(params.skillId, params.skillScope, params.projectPath);
        if (skillContent) {
          enhancedQuery = `# Skill Context\n\n${skillContent}\n\n---\n\n# User Query\n\n${params.query}`;
          console.log('[ProcessManager] Enhanced query with skill:', params.skillId);
        }
      } catch (error) {
        console.error('[ProcessManager] Failed to load skill:', error);
        // Continue without skill if loading fails
      }
    }

    // For resume, we already have sessionId
    if (params.sessionId) {
      if (this.executions.has(params.sessionId)) {
        throw new Error(`Execution with sessionId ${params.sessionId} already exists`);
      }
    }

    // Create a promise to wait for sessionId from system:init event
    let resolveSessionId: (sessionId: string) => void;
    let rejectSessionId: (error: Error) => void;
    const sessionIdPromise = new Promise<string>((resolve, reject) => {
      resolveSessionId = resolve;
      rejectSessionId = reject;
    });

    // Temporary execution info (will be updated with sessionId)
    let tempExecution: ExecutionInfo | null = null;

    // Create client with execution-specific callbacks
    const clientOptions: ClaudeClientOptions = {
      cwd: params.projectPath,
      model: params.model,
      sessionId: params.sessionId,
      mcpConfig: params.mcpConfig,
      onStream: (event: StreamEvent) => {
        // Extract sessionId from system:init event
        if (isSystemInitEvent(event) && !params.sessionId) {
          const newSessionId = event.session_id;
          console.log('[ProcessManager] Received sessionId from system:init:', newSessionId);

          // Resolve the promise
          resolveSessionId!(newSessionId);

          // Update tempExecution with sessionId and store in map
          if (tempExecution) {
            tempExecution.sessionId = newSessionId;
            this.executions.set(newSessionId, tempExecution);
            tempExecution = null; // Clear temp reference

            // Notify listeners of new execution
            this.notifyExecutionsChanged();
          }
        }

        // Get current sessionId
        const currentSessionId =
          params.sessionId ||
          this.executions.get(
            Array.from(this.executions.keys()).find(
              (key) => this.executions.get(key) === tempExecution,
            ) || '',
          )?.sessionId;

        // Store event
        if (tempExecution) {
          tempExecution.events.push(event);
        } else if (currentSessionId) {
          const execution = this.executions.get(currentSessionId);
          if (execution) {
            execution.events.push(event);
          }
        }

        // Forward to callback with sessionId
        if (params.onStream && currentSessionId) {
          params.onStream(currentSessionId, event);
        }
      },
      onError: (error: string) => {
        const currentSessionId = params.sessionId || tempExecution?.sessionId;

        // Store error
        if (tempExecution) {
          tempExecution.errors.push(error);
        } else if (currentSessionId) {
          const execution = this.executions.get(currentSessionId);
          if (execution) {
            execution.errors.push(error);
          }
        }

        // Forward to callback
        if (params.onError && currentSessionId) {
          params.onError(currentSessionId, error);
        }
      },
      onClose: (code: number) => {
        const currentSessionId = params.sessionId || tempExecution?.sessionId;

        if (tempExecution) {
          tempExecution.status = code === 0 ? 'completed' : 'failed';
          tempExecution.endTime = Date.now();
        } else if (currentSessionId) {
          const execution = this.executions.get(currentSessionId);
          if (execution) {
            execution.status = code === 0 ? 'completed' : 'failed';
            execution.endTime = Date.now();

            console.log('[ProcessManager] Execution completed:', {
              sessionId: currentSessionId,
              status: execution.status,
              duration: execution.endTime - execution.startTime,
            });

            // Notify listeners of status change
            this.notifyExecutionsChanged();
          }
        }

        // Forward to callback
        if (params.onComplete && currentSessionId) {
          params.onComplete(currentSessionId, code);
        }
      },
    };

    const client = new ClaudeClient(clientOptions);

    // Create execution info
    const executionInfo: ExecutionInfo = {
      sessionId: params.sessionId || '', // Will be updated from system:init if empty
      projectPath: params.projectPath,
      query: params.query,
      status: 'pending',
      pid: null,
      client,
      events: [],
      errors: [],
      startTime: Date.now(),
      endTime: null,
      mcpConfig: params.mcpConfig,
      model: params.model,
      skillId: params.skillId,
      skillScope: params.skillScope,
    };

    // If resuming, store immediately with sessionId
    if (params.sessionId) {
      this.executions.set(params.sessionId, executionInfo);
      resolveSessionId!(params.sessionId);
      // Notify listeners of new execution
      this.notifyExecutionsChanged();
    } else {
      // New execution: store in temp until we get sessionId
      tempExecution = executionInfo;
    }

    // Execute query (use enhanced query if skill was loaded)
    try {
      const process = client.execute(enhancedQuery);
      executionInfo.pid = process.pid || null;
      executionInfo.status = 'running';

      console.log('[ProcessManager] Execution started:', {
        sessionId: params.sessionId || 'pending',
        pid: executionInfo.pid,
      });

      // Notify listeners of status change to running
      if (params.sessionId) {
        this.notifyExecutionsChanged();
      }
    } catch (error) {
      executionInfo.status = 'failed';
      executionInfo.endTime = Date.now();
      const errorMsg = error instanceof Error ? error.message : String(error);
      executionInfo.errors.push(errorMsg);

      console.error('[ProcessManager] Execution failed to start:', {
        sessionId: params.sessionId || 'unknown',
        error: errorMsg,
      });

      // Reject sessionId promise if not resuming
      if (!params.sessionId) {
        rejectSessionId!(new Error(`Execution failed to start: ${errorMsg}`));
      }

      throw error;
    }

    // Wait for sessionId with timeout (will resolve immediately if resuming)
    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(
        () => reject(new Error('Timeout waiting for sessionId from Claude CLI')),
        10000, // 10 second timeout
      ),
    );

    try {
      const finalSessionId = await Promise.race([sessionIdPromise, timeoutPromise]);
      return finalSessionId;
    } catch (error) {
      // Cleanup on timeout or error
      if (tempExecution) {
        tempExecution.status = 'failed';
        tempExecution.endTime = Date.now();
        tempExecution.errors.push(
          error instanceof Error ? error.message : 'SessionId resolution failed',
        );
      }
      throw error;
    }
  }

  /**
   * Get execution info by sessionId
   */
  getExecution(sessionId: string): ExecutionInfo | undefined {
    return this.executions.get(sessionId);
  }

  /**
   * Get all executions
   */
  getAllExecutions(): ExecutionInfo[] {
    return Array.from(this.executions.values());
  }

  /**
   * Get active (running or pending) executions
   */
  getActiveExecutions(): ExecutionInfo[] {
    return this.getAllExecutions().filter(
      (exec) => exec.status === 'running' || exec.status === 'pending',
    );
  }

  /**
   * Get completed executions
   */
  getCompletedExecutions(): ExecutionInfo[] {
    return this.getAllExecutions().filter(
      (exec) => exec.status === 'completed' || exec.status === 'failed' || exec.status === 'killed',
    );
  }

  /**
   * Kill an execution
   */
  killExecution(sessionId: string): void {
    const execution = this.executions.get(sessionId);

    if (!execution) {
      throw new Error(`Execution not found: ${sessionId}`);
    }

    if (execution.status !== 'running' && execution.status !== 'pending') {
      console.warn('[ProcessManager] Execution already terminated:', {
        sessionId,
        status: execution.status,
      });
      return;
    }

    console.log('[ProcessManager] Killing execution:', sessionId);

    try {
      execution.client.kill();
      execution.status = 'killed';
      execution.endTime = Date.now();

      // Notify listeners of status change
      this.notifyExecutionsChanged();
    } catch (error) {
      console.error('[ProcessManager] Failed to kill execution:', {
        sessionId,
        error,
      });
    }
  }

  /**
   * Clean up an execution (remove from memory)
   */
  cleanupExecution(sessionId: string): void {
    const execution = this.executions.get(sessionId);

    if (!execution) {
      console.warn('[ProcessManager] Execution not found for cleanup:', sessionId);
      return;
    }

    // Only cleanup completed executions
    if (execution.status === 'running' || execution.status === 'pending') {
      throw new Error('Cannot cleanup active execution. Kill it first.');
    }

    console.log('[ProcessManager] Cleaning up execution:', sessionId);
    this.executions.delete(sessionId);

    // Notify listeners of execution removal
    this.notifyExecutionsChanged();
  }

  /**
   * Clean up all completed executions
   */
  cleanupAllCompleted(): number {
    const completedIds = this.getCompletedExecutions().map((e) => e.sessionId);

    for (const id of completedIds) {
      this.cleanupExecution(id);
    }

    console.log('[ProcessManager] Cleaned up executions:', completedIds.length);
    return completedIds.length;
  }

  /**
   * Kill all active executions
   */
  killAll(): void {
    const activeExecutions = this.getActiveExecutions();

    console.log('[ProcessManager] Killing all executions:', activeExecutions.length);

    for (const execution of activeExecutions) {
      this.killExecution(execution.sessionId);
    }
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    total: number;
    running: number;
    pending: number;
    completed: number;
    failed: number;
    killed: number;
  } {
    const executions = this.getAllExecutions();

    return {
      total: executions.length,
      running: executions.filter((e) => e.status === 'running').length,
      pending: executions.filter((e) => e.status === 'pending').length,
      completed: executions.filter((e) => e.status === 'completed').length,
      failed: executions.filter((e) => e.status === 'failed').length,
      killed: executions.filter((e) => e.status === 'killed').length,
    };
  }

  /**
   * Set maximum concurrent executions
   */
  setMaxConcurrent(max: number): void {
    if (max < 1) {
      throw new Error('Maximum concurrent executions must be at least 1');
    }
    this.maxConcurrent = max;
    console.log('[ProcessManager] Max concurrent set to:', max);
  }

  /**
   * Get maximum concurrent executions
   */
  getMaxConcurrent(): number {
    return this.maxConcurrent;
  }

  /**
   * Load skill content from filesystem
   */
  private async loadSkillContent(skillId: string, scope: 'global' | 'project', projectPath: string): Promise<string | null> {
    try {
      let skillPath: string;

      if (scope === 'global') {
        skillPath = path.join(os.homedir(), '.claude', 'skills', skillId, 'SKILL.md');
      } else {
        skillPath = path.join(projectPath, '.claude', 'skills', skillId, 'SKILL.md');
      }

      console.log('[ProcessManager] Loading skill from:', skillPath);
      const content = await fs.readFile(skillPath, 'utf-8');
      return content;
    } catch (error) {
      console.error('[ProcessManager] Failed to read skill file:', error);
      return null;
    }
  }
}

// Singleton instance
export const processManager = new ProcessManager();
