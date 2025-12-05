/**
 * Session manager types
 * Migrated from @context-action/code-api
 */

import type { ExecutionInfo, StartExecutionParams } from './process-manager';
import type { StreamEvent } from './stream-events';

export interface SessionManagerEvents {
  started: (sessionId: string, pid: number) => void;
  stream: (sessionId: string, event: StreamEvent) => void;
  error: (sessionId: string, error: string) => void;
  complete: (sessionId: string, exitCode: number) => void;
}

export interface SessionManager {
  startExecution(params: StartExecutionParams): Promise<string>;
  getExecution(sessionId: string): ExecutionInfo | undefined;
  getAllExecutions(): ExecutionInfo[];
  killExecution(sessionId: string): boolean;
  cleanupExecution(sessionId: string): boolean;
  on<K extends keyof SessionManagerEvents>(event: K, listener: SessionManagerEvents[K]): void;
  off<K extends keyof SessionManagerEvents>(event: K, listener: SessionManagerEvents[K]): void;
}

/**
 * Placeholder SessionManager implementation
 * The actual implementation should be in services
 */
export class SessionManagerImpl implements SessionManager {
  private executions = new Map<string, ExecutionInfo>();
  private listeners = new Map<string, Set<Function>>();

  async startExecution(_params: StartExecutionParams): Promise<string> {
    throw new Error('Not implemented - use ClaudeQueryAPI instead');
  }

  getExecution(sessionId: string): ExecutionInfo | undefined {
    return this.executions.get(sessionId);
  }

  getAllExecutions(): ExecutionInfo[] {
    return Array.from(this.executions.values());
  }

  killExecution(_sessionId: string): boolean {
    return false;
  }

  cleanupExecution(sessionId: string): boolean {
    return this.executions.delete(sessionId);
  }

  on<K extends keyof SessionManagerEvents>(event: K, listener: SessionManagerEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off<K extends keyof SessionManagerEvents>(event: K, listener: SessionManagerEvents[K]): void {
    this.listeners.get(event)?.delete(listener);
  }
}

// Export singleton placeholder
export const sessionManager = new SessionManagerImpl();
