import { contextBridge, ipcRenderer } from 'electron';
import type { ClaudeSessionsAPI } from '../../types/api';

export function exposeSessionsAPI(): void {
  contextBridge.exposeInMainWorld('claudeSessionsAPI', {
    getAllProjects: () => ipcRenderer.invoke('claude-sessions:get-all-projects'),

    getTotalCount: () => ipcRenderer.invoke('claude-sessions:get-total-count'),

    getAllProjectsPaginated: (page: number, pageSize: number) =>
      ipcRenderer.invoke('claude-sessions:get-all-projects-paginated', page, pageSize),

    getProjectSessions: (projectPath: string) =>
      ipcRenderer.invoke('claude-sessions:get-project-sessions', projectPath),

    getProjectSessionsBasic: (projectPath: string) =>
      ipcRenderer.invoke('claude-sessions:get-project-sessions-basic', projectPath),

    getProjectSessionsPaginated: (projectPath: string, page: number, pageSize: number) =>
      ipcRenderer.invoke('claude-sessions:get-paginated', projectPath, page, pageSize),

    getProjectSessionCount: (projectPath: string) =>
      ipcRenderer.invoke('claude-sessions:get-count', projectPath),

    getSessionMetadata: (projectPath: string, sessionId: string) =>
      ipcRenderer.invoke('claude-sessions:get-session-metadata', projectPath, sessionId),

    readLog: (projectPath: string, sessionId: string) =>
      ipcRenderer.invoke('claude-sessions:read-log', projectPath, sessionId),

    getSummary: (projectPath: string, sessionId: string) =>
      ipcRenderer.invoke('claude-sessions:get-summary', projectPath, sessionId),

    getPreview: (projectPath: string, sessionId: string) =>
      ipcRenderer.invoke('claude-sessions:get-preview', projectPath, sessionId),
  } as ClaudeSessionsAPI);
}
