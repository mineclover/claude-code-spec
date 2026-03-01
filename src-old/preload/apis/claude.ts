import { contextBridge, ipcRenderer } from 'electron';
import type {
  ClaudeAPI,
  ClaudeCompleteData,
  ClaudeErrorData,
  ClaudeStartedData,
  ClaudeStreamData,
  ExecutionInfo,
} from '../../types/api';

export function exposeClaudeAPI(): void {
  contextBridge.exposeInMainWorld('claudeAPI', {
    executeClaudeCommand: (
      projectPath: string,
      query: string,
      sessionId?: string,
      mcpConfig?: string,
      model?: 'sonnet' | 'opus' | 'heroku',
      skillId?: string,
      skillScope?: 'global' | 'project',
      outputStyle?: string,
    ) =>
      ipcRenderer.invoke(
        'claude:execute',
        projectPath,
        query,
        sessionId,
        mcpConfig,
        model,
        skillId,
        skillScope,
        outputStyle,
      ),

    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),

    getSessions: () => ipcRenderer.invoke('claude:get-sessions'),

    getCurrentSession: () => ipcRenderer.invoke('claude:get-current-session'),

    resumeSession: (sessionId: string, projectPath: string, query: string) =>
      ipcRenderer.invoke('claude:resume-session', sessionId, projectPath, query),

    clearSessions: () => ipcRenderer.invoke('claude:clear-sessions'),

    // Execution management (ProcessManager)
    getExecution: (sessionId: string) => ipcRenderer.invoke('claude:get-execution', sessionId),

    getAllExecutions: () => ipcRenderer.invoke('claude:get-all-executions'),

    getActiveExecutions: () => ipcRenderer.invoke('claude:get-active-executions'),

    killExecution: (sessionId: string) => ipcRenderer.invoke('claude:kill-execution', sessionId),

    cleanupExecution: (sessionId: string) =>
      ipcRenderer.invoke('claude:cleanup-execution', sessionId),

    getExecutionStats: () => ipcRenderer.invoke('claude:get-execution-stats'),

    killAllExecutions: () => ipcRenderer.invoke('claude:kill-all-executions'),

    cleanupAllCompleted: () => ipcRenderer.invoke('claude:cleanup-all-completed'),

    onClaudeStarted: (callback: (data: ClaudeStartedData) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: ClaudeStartedData) =>
        callback(data);
      ipcRenderer.on('claude:started', handler);
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener('claude:started', handler);
      };
    },

    onClaudeStream: (callback: (data: ClaudeStreamData) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: ClaudeStreamData) => callback(data);
      ipcRenderer.on('claude:stream', handler);
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener('claude:stream', handler);
      };
    },

    onClaudeError: (callback: (data: ClaudeErrorData) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: ClaudeErrorData) => callback(data);
      ipcRenderer.on('claude:error', handler);
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener('claude:error', handler);
      };
    },

    onClaudeComplete: (callback: (data: ClaudeCompleteData) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: ClaudeCompleteData) =>
        callback(data);
      ipcRenderer.on('claude:complete', handler);
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener('claude:complete', handler);
      };
    },

    onExecutionsUpdated: (callback: (executions: Array<Omit<ExecutionInfo, 'events'>>) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        executions: Array<Omit<ExecutionInfo, 'events'>>,
      ) => callback(executions);
      ipcRenderer.on('executions:updated', handler);
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener('executions:updated', handler);
      };
    },
  } as ClaudeAPI);
}
