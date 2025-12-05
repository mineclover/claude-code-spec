/**
 * ProcessManager - Manages Claude CLI executions using SDK
 *
 * Migrated from @context-action/code-api CLI spawn to SDK-based implementation
 */

import { EventEmitter } from 'node:events';
import { createClaudeAgent, type ClaudeModel } from '@packages/ai-sdk-cli';
import { v4 as uuidv4 } from 'uuid';
import type { StreamEvent } from '../types/stream-events';

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ExecutionInfo {
  sessionId: string;
  projectPath: string;
  query: string;
  status: ExecutionStatus;
  pid: number | null;
  events: StreamEvent[];
  errors: string[];
  startTime?: number;
  endTime?: number;
  mcpConfig?: string;
  model?: string;
  skillId?: string;
  skillScope?: 'global' | 'project';
  agentName?: string;
  taskId?: string;
}

export interface StartExecutionParams {
  projectPath: string;
  query: string;
  sessionId?: string;
  mcpConfig?: string;
  model?: string;
  skillId?: string;
  skillScope?: 'global' | 'project';
  outputStyle?: string;
  agentName?: string;
  taskId?: string;
  onStream?: (sessionId: string, event: StreamEvent) => void;
  onError?: (sessionId: string, error: string) => void;
  onComplete?: (sessionId: string, code: number) => void;
}

export interface ProcessManagerStats {
  total: number;
  running: number;
  completed: number;
  failed: number;
}

/**
 * Model name mapping
 */
function mapModelName(model?: string): ClaudeModel | undefined {
  if (!model) return undefined;

  const modelMap: Record<string, ClaudeModel> = {
    sonnet: 'claude-sonnet-4-5',
    opus: 'claude-opus-4-5',
    haiku: 'claude-haiku-3-5',
    heroku: 'claude-haiku-3-5', // Legacy typo support
    'claude-sonnet-4-5': 'claude-sonnet-4-5',
    'claude-opus-4-5': 'claude-opus-4-5',
    'claude-haiku-3-5': 'claude-haiku-3-5',
  };

  return modelMap[model];
}

/**
 * ProcessManager class for managing Claude executions
 */
export class ProcessManager extends EventEmitter {
  private executions = new Map<string, ExecutionInfo>();
  private abortControllers = new Map<string, AbortController>();
  private executionsChangeListener?: () => void;

  /**
   * Start a new execution
   */
  async startExecution(params: StartExecutionParams): Promise<string> {
    const {
      projectPath,
      query,
      sessionId: providedSessionId,
      mcpConfig,
      model,
      skillId,
      skillScope,
      outputStyle,
      agentName,
      taskId,
      onStream,
      onError,
      onComplete,
    } = params;

    // Generate or use provided session ID
    const sessionId = providedSessionId || uuidv4();

    // Create execution info
    const execution: ExecutionInfo = {
      sessionId,
      projectPath,
      query,
      status: 'pending',
      pid: null, // SDK doesn't have PID
      events: [],
      errors: [],
      startTime: Date.now(),
      mcpConfig,
      model,
      skillId,
      skillScope,
      agentName,
      taskId,
    };

    this.executions.set(sessionId, execution);
    this.notifyExecutionsChange();

    // Create abort controller
    const abortController = new AbortController();
    this.abortControllers.set(sessionId, abortController);

    // Start execution asynchronously
    this.runExecution(execution, {
      outputStyle,
      abortController,
      onStream,
      onError,
      onComplete,
    }).catch((error) => {
      console.error('[ProcessManager] Execution error:', error);
    });

    return sessionId;
  }

  /**
   * Run the execution with SDK
   */
  private async runExecution(
    execution: ExecutionInfo,
    options: {
      outputStyle?: string;
      abortController: AbortController;
      onStream?: (sessionId: string, event: StreamEvent) => void;
      onError?: (sessionId: string, error: string) => void;
      onComplete?: (sessionId: string, code: number) => void;
    },
  ): Promise<void> {
    const { outputStyle, abortController, onStream, onError, onComplete } = options;

    // Update status to running
    execution.status = 'running';
    this.notifyExecutionsChange();

    try {
      // Create agent
      const agent = createClaudeAgent({
        cwd: execution.projectPath,
        model: mapModelName(execution.model),
        permissionMode: 'bypassPermissions',
      });

      // Build query with output style hint if provided
      const enhancedQuery = outputStyle
        ? `/output-style ${outputStyle}\n\n${execution.query}`
        : execution.query;

      // Emit system init event
      const initEvent: StreamEvent = {
        type: 'system',
        subtype: 'init',
        session_id: execution.sessionId,
        cwd: execution.projectPath,
        model: execution.model || 'sonnet',
        tools: [],
        mcp_servers: [],
        permissionMode: 'bypassPermissions',
      };
      execution.events.push(initEvent);
      onStream?.(execution.sessionId, initEvent);

      // Stream execution
      let resultText = '';

      for await (const message of agent.stream(enhancedQuery)) {
        if (abortController.signal.aborted) {
          throw new Error('Execution aborted');
        }

        // Convert SDK message to StreamEvent format
        const event: StreamEvent = this.convertToStreamEvent(message, execution.sessionId);
        execution.events.push(event);
        onStream?.(execution.sessionId, event);

        // Extract result text from assistant messages
        if (event.type === 'assistant' && 'message' in event) {
          const msg = event.message as { content?: Array<{ type: string; text?: string }> };
          if (msg.content) {
            for (const block of msg.content) {
              if (block.type === 'text' && block.text) {
                resultText += block.text;
              }
            }
          }
        }
      }

      // Emit result event
      const resultEvent: StreamEvent = {
        type: 'result',
        subtype: 'success',
        session_id: execution.sessionId,
        result: resultText,
        is_error: false,
        duration_ms: Date.now() - (execution.startTime || Date.now()),
        duration_api_ms: 0,
        num_turns: 1,
        total_cost_usd: 0,
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          service_tier: 'default',
        },
      };
      execution.events.push(resultEvent);
      onStream?.(execution.sessionId, resultEvent);

      // Update execution status
      execution.status = 'completed';
      execution.endTime = Date.now();
      this.notifyExecutionsChange();

      onComplete?.(execution.sessionId, 0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      execution.status = 'failed';
      execution.endTime = Date.now();
      execution.errors.push(errorMessage);
      this.notifyExecutionsChange();

      // Emit error event
      const errorEvent: StreamEvent = {
        type: 'error',
        error: {
          type: 'execution_error',
          message: errorMessage,
        },
      };
      execution.events.push(errorEvent);
      onStream?.(execution.sessionId, errorEvent);

      onError?.(execution.sessionId, errorMessage);
      onComplete?.(execution.sessionId, 1);
    } finally {
      this.abortControllers.delete(execution.sessionId);
    }
  }

  /**
   * Convert SDK message to StreamEvent format
   */
  private convertToStreamEvent(message: unknown, sessionId: string): StreamEvent {
    // If it's already a stream event, return it
    if (typeof message === 'object' && message !== null && 'type' in message) {
      return { ...(message as StreamEvent), session_id: sessionId };
    }

    // Otherwise wrap it as an assistant message
    return {
      type: 'assistant',
      session_id: sessionId,
      message,
    };
  }

  /**
   * Get execution by session ID
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
   * Get active (running) executions
   */
  getActiveExecutions(): ExecutionInfo[] {
    return this.getAllExecutions().filter((exec) => exec.status === 'running');
  }

  /**
   * Kill an execution
   */
  killExecution(sessionId: string): void {
    const abortController = this.abortControllers.get(sessionId);
    if (abortController) {
      abortController.abort();
    }

    const execution = this.executions.get(sessionId);
    if (execution && execution.status === 'running') {
      execution.status = 'failed';
      execution.endTime = Date.now();
      execution.errors.push('Killed by user');
      this.notifyExecutionsChange();
    }
  }

  /**
   * Kill all running executions
   */
  killAll(): void {
    for (const [sessionId, abortController] of this.abortControllers) {
      abortController.abort();

      const execution = this.executions.get(sessionId);
      if (execution && execution.status === 'running') {
        execution.status = 'failed';
        execution.endTime = Date.now();
        execution.errors.push('Killed by killAll');
      }
    }
    this.abortControllers.clear();
    this.notifyExecutionsChange();
  }

  /**
   * Cleanup an execution (remove from tracking)
   */
  cleanupExecution(sessionId: string): void {
    this.abortControllers.delete(sessionId);
    this.executions.delete(sessionId);
    this.notifyExecutionsChange();
  }

  /**
   * Cleanup all completed/failed executions
   */
  cleanupAllCompleted(): number {
    let count = 0;
    for (const [sessionId, execution] of this.executions) {
      if (execution.status === 'completed' || execution.status === 'failed') {
        this.executions.delete(sessionId);
        count++;
      }
    }
    this.notifyExecutionsChange();
    return count;
  }

  /**
   * Get execution stats
   */
  getStats(): ProcessManagerStats {
    const executions = this.getAllExecutions();
    return {
      total: executions.length,
      running: executions.filter((e) => e.status === 'running').length,
      completed: executions.filter((e) => e.status === 'completed').length,
      failed: executions.filter((e) => e.status === 'failed').length,
    };
  }

  /**
   * Set listener for executions change
   */
  setExecutionsChangeListener(listener: () => void): void {
    this.executionsChangeListener = listener;
  }

  /**
   * Notify executions change
   */
  private notifyExecutionsChange(): void {
    this.executionsChangeListener?.();
  }
}

// Export singleton instance
export const processManager = new ProcessManager();
