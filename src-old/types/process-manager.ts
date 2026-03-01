/**
 * Process manager types
 * Migrated from @context-action/code-api
 */

import type { StreamEvent } from './stream-events';

export interface StartExecutionParams {
  projectPath: string;
  query: string;
  mcpConfig?: string;
  skillId?: string;
  skillScope?: 'global' | 'project';
  model?: string;
  permissionMode?: string;
  systemPrompt?: string;
  resume?: string;
}

export interface ExecutionInfo {
  sessionId: string;
  pid: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  projectPath: string;
  query: string;
  events: StreamEvent[];
  skillId?: string;
  skillScope?: 'global' | 'project';
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface ProcessManagerEvents {
  started: (sessionId: string, pid: number) => void;
  stream: (sessionId: string, event: StreamEvent) => void;
  error: (sessionId: string, error: string) => void;
  complete: (sessionId: string, exitCode: number) => void;
}

export interface ProcessManager {
  startExecution(params: StartExecutionParams): Promise<string>;
  getExecution(sessionId: string): ExecutionInfo | undefined;
  getAllExecutions(): ExecutionInfo[];
  killExecution(sessionId: string): boolean;
  cleanupExecution(sessionId: string): boolean;
  on<K extends keyof ProcessManagerEvents>(event: K, listener: ProcessManagerEvents[K]): void;
  off<K extends keyof ProcessManagerEvents>(event: K, listener: ProcessManagerEvents[K]): void;
}
