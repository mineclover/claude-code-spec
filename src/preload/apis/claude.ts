import { contextBridge, ipcRenderer } from 'electron';
import type {
  ClaudeAPI,
  ClaudeCompleteData,
  ClaudeErrorData,
  ClaudeStartedData,
  ClaudeStreamData,
  ExecutionInfo,
  ExecutionStats,
} from '../../types/api';

export function exposeClaudeAPI(): void {
  contextBridge.exposeInMainWorld('claudeAPI', {
    executeClaudeCommand: (projectPath: string, query: string, sessionId?: string, mcpConfig?: string, model?: 'sonnet' | 'opus') =>
      ipcRenderer.invoke('claude:execute', projectPath, query, sessionId, mcpConfig, model),

    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),

    getSessions: () => ipcRenderer.invoke('claude:get-sessions'),

    getCurrentSession: () => ipcRenderer.invoke('claude:get-current-session'),

    resumeSession: (sessionId: string, projectPath: string, query: string) =>
      ipcRenderer.invoke('claude:resume-session', sessionId, projectPath, query),

    clearSessions: () => ipcRenderer.invoke('claude:clear-sessions'),

    // Execution management (ProcessManager)
    getExecution: (sessionId: string) => ipcRenderer.invoke('get-execution', sessionId),

    getAllExecutions: () => ipcRenderer.invoke('get-all-executions'),

    getActiveExecutions: () => ipcRenderer.invoke('get-active-executions'),

    killExecution: (sessionId: string) => ipcRenderer.invoke('kill-execution', sessionId),

    cleanupExecution: (sessionId: string) => ipcRenderer.invoke('cleanup-execution', sessionId),

    getExecutionStats: () => ipcRenderer.invoke('get-execution-stats'),

    killAllExecutions: () => ipcRenderer.invoke('kill-all-executions'),

    cleanupAllCompleted: () => ipcRenderer.invoke('cleanup-all-completed'),

    onClaudeStarted: (callback: (data: ClaudeStartedData) => void) => {
      ipcRenderer.on('claude:started', (_event, data) => callback(data));
    },

    onClaudeStream: (callback: (data: ClaudeStreamData) => void) => {
      ipcRenderer.on('claude:stream', (_event, data) => callback(data));
    },

    onClaudeError: (callback: (data: ClaudeErrorData) => void) => {
      ipcRenderer.on('claude:error', (_event, data) => callback(data));
    },

    onClaudeComplete: (callback: (data: ClaudeCompleteData) => void) => {
      ipcRenderer.on('claude:complete', (_event, data) => callback(data));
    },
  } as ClaudeAPI);
}
