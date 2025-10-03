import type { StreamEvent } from '../../lib/types';

export interface SessionInfo {
  sessionId: string;
  cwd: string;
  query: string;
  timestamp: number;
  lastResult?: string;
}

export interface ExecutionInfo {
  sessionId: string;
  projectPath: string;
  query: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'killed';
  pid: number | null;
  events: StreamEvent[];
  errors: string[];
  startTime: number;
  endTime: number | null;
  mcpConfig?: string;
  model?: 'sonnet' | 'opus';
}

export interface ExecutionStats {
  total: number;
  running: number;
  pending: number;
  completed: number;
  failed: number;
  killed: number;
}

export interface ClaudeStreamData {
  sessionId: string;
  pid: number | null;
  data: StreamEvent;
}

export interface ClaudeErrorData {
  sessionId: string;
  pid?: number | null;
  error: string;
}

export interface ClaudeCompleteData {
  sessionId: string;
  pid: number | null;
  code: number;
}

export interface ClaudeStartedData {
  sessionId: string;
  pid: number | null;
}

export interface ClaudeAPI {
  // Execute claude command
  executeClaudeCommand: (
    projectPath: string,
    query: string,
    sessionId?: string,
    mcpConfig?: string,
    model?: 'sonnet' | 'opus',
  ) => Promise<{ success: boolean; sessionId?: string; pid?: number; error?: string }>;

  // Directory selection
  selectDirectory: () => Promise<string | null>;

  // Session management
  getSessions: () => Promise<SessionInfo[]>;
  getCurrentSession: () => Promise<string | null>;
  resumeSession: (
    sessionId: string,
    projectPath: string,
    query: string,
  ) => Promise<{ success: boolean; sessionId?: string; pid?: number; error?: string }>;
  clearSessions: () => Promise<{ success: boolean }>;

  // Execution management (ProcessManager)
  getExecution: (sessionId: string) => Promise<ExecutionInfo | null>;
  getAllExecutions: () => Promise<Array<Omit<ExecutionInfo, 'events'>>>;
  getActiveExecutions: () => Promise<Array<Omit<ExecutionInfo, 'events'>>>;
  killExecution: (sessionId: string) => Promise<{ success: boolean }>;
  cleanupExecution: (sessionId: string) => Promise<{ success: boolean }>;
  getExecutionStats: () => Promise<ExecutionStats>;
  killAllExecutions: () => Promise<{ success: boolean; count: number }>;
  cleanupAllCompleted: () => Promise<{ success: boolean; count: number }>;

  // Event listeners
  onClaudeStarted: (callback: (data: ClaudeStartedData) => void) => void;
  onClaudeStream: (callback: (data: ClaudeStreamData) => void) => void;
  onClaudeError: (callback: (data: ClaudeErrorData) => void) => void;
  onClaudeComplete: (callback: (data: ClaudeCompleteData) => void) => void;
  onExecutionsUpdated: (
    callback: (executions: Array<Omit<ExecutionInfo, 'events'>>) => void,
  ) => void;
}
