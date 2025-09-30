import { contextBridge, ipcRenderer } from 'electron';
import type { StreamEvent } from './lib/types';

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
  executeClaudeCommand: (projectPath: string, query: string, sessionId?: string) => Promise<{ success: boolean; pid?: number; error?: string }>;

  // Directory selection
  selectDirectory: () => Promise<string | null>;

  // Session management
  getSessions: () => Promise<SessionInfo[]>;
  getCurrentSession: () => Promise<string | null>;
  resumeSession: (sessionId: string, projectPath: string, query: string) => Promise<{ success: boolean; pid?: number; error?: string }>;
  clearSessions: () => Promise<{ success: boolean }>;

  // Event listeners
  onClaudeStarted: (callback: (data: ClaudeStartedData) => void) => void;
  onClaudeStream: (callback: (data: ClaudeStreamData) => void) => void;
  onClaudeError: (callback: (data: ClaudeErrorData) => void) => void;
  onClaudeComplete: (callback: (data: ClaudeCompleteData) => void) => void;
}

contextBridge.exposeInMainWorld('claudeAPI', {
  executeClaudeCommand: (projectPath: string, query: string, sessionId?: string) =>
    ipcRenderer.invoke('claude:execute', projectPath, query, sessionId),

  selectDirectory: () =>
    ipcRenderer.invoke('dialog:selectDirectory'),

  getSessions: () =>
    ipcRenderer.invoke('claude:get-sessions'),

  getCurrentSession: () =>
    ipcRenderer.invoke('claude:get-current-session'),

  resumeSession: (sessionId: string, projectPath: string, query: string) =>
    ipcRenderer.invoke('claude:resume-session', sessionId, projectPath, query),

  clearSessions: () =>
    ipcRenderer.invoke('claude:clear-sessions'),

  onClaudeStarted: (callback: (data: { pid: number }) => void) => {
    ipcRenderer.on('claude:started', (_event, data) => callback(data));
  },

  onClaudeStream: (callback: (data: { pid: number; data: StreamEvent }) => void) => {
    ipcRenderer.on('claude:stream', (_event, data) => callback(data));
  },

  onClaudeError: (callback: (data: { pid?: number; error: string }) => void) => {
    ipcRenderer.on('claude:error', (_event, data) => callback(data));
  },

  onClaudeComplete: (callback: (data: { pid: number; code: number }) => void) => {
    ipcRenderer.on('claude:complete', (_event, data) => callback(data));
  },
} as ClaudeAPI);