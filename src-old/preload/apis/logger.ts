import { contextBridge, ipcRenderer } from 'electron';
import type { LoggerAPI } from '../../types/api';

export function exposeLoggerAPI(): void {
  contextBridge.exposeInMainWorld('loggerAPI', {
    getLogFiles: () => ipcRenderer.invoke('logger:get-files'),

    readLogFile: (filePath: string) => ipcRenderer.invoke('logger:read-file', filePath),

    analyzePatterns: (filePath: string) => ipcRenderer.invoke('logger:analyze-patterns', filePath),

    exportJSON: (filePath: string, outputPath: string) =>
      ipcRenderer.invoke('logger:export-json', filePath, outputPath),

    rotateLogs: () => ipcRenderer.invoke('logger:rotate'),

    getSessionLog: (sessionId: string) => ipcRenderer.invoke('logger:get-session-log', sessionId),

    readSessionLog: (sessionId: string) => ipcRenderer.invoke('logger:read-session-log', sessionId),
  } as LoggerAPI);
}
