import type { StreamEvent } from '../../lib/types';

export interface SessionInfo {
  sessionId: string;
  cwd: string;
  query: string;
  timestamp: number;
  lastResult?: string;
}

export interface ClaudeStreamData {
  pid: number;
  data: StreamEvent;
}

export interface ClaudeErrorData {
  pid?: number;
  error: string;
}

export interface ClaudeCompleteData {
  pid: number;
  code: number;
}

export interface ClaudeStartedData {
  pid: number;
}

export interface ClaudeAPI {
  // Execute claude command
  executeClaudeCommand: (
    projectPath: string,
    query: string,
    sessionId?: string,
  ) => Promise<{ success: boolean; pid?: number; error?: string }>;

  // Directory selection
  selectDirectory: () => Promise<string | null>;

  // Session management
  getSessions: () => Promise<SessionInfo[]>;
  getCurrentSession: () => Promise<string | null>;
  resumeSession: (
    sessionId: string,
    projectPath: string,
    query: string,
  ) => Promise<{ success: boolean; pid?: number; error?: string }>;
  clearSessions: () => Promise<{ success: boolean }>;

  // Event listeners
  onClaudeStarted: (callback: (data: ClaudeStartedData) => void) => void;
  onClaudeStream: (callback: (data: ClaudeStreamData) => void) => void;
  onClaudeError: (callback: (data: ClaudeErrorData) => void) => void;
  onClaudeComplete: (callback: (data: ClaudeCompleteData) => void) => void;
}
