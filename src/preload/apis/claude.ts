import { contextBridge, ipcRenderer } from 'electron';
import type {
  ClaudeAPI,
  ClaudeCompleteData,
  ClaudeErrorData,
  ClaudeStartedData,
  ClaudeStreamData,
} from '../../types/api';

export function exposeClaudeAPI(): void {
  contextBridge.exposeInMainWorld('claudeAPI', {
    executeClaudeCommand: (projectPath: string, query: string, sessionId?: string) =>
      ipcRenderer.invoke('claude:execute', projectPath, query, sessionId),

    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),

    getSessions: () => ipcRenderer.invoke('claude:get-sessions'),

    getCurrentSession: () => ipcRenderer.invoke('claude:get-current-session'),

    resumeSession: (sessionId: string, projectPath: string, query: string) =>
      ipcRenderer.invoke('claude:resume-session', sessionId, projectPath, query),

    clearSessions: () => ipcRenderer.invoke('claude:clear-sessions'),

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
