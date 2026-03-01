/**
 * Execute preload API
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { ExecuteAPI } from '../../types/api';
import type { ExecutionRequest } from '../../types/execution';
import type { StreamEvent } from '../../types/stream-events';

export function exposeExecuteAPI(): void {
  contextBridge.exposeInMainWorld('executeAPI', {
    execute: (request: ExecutionRequest) => ipcRenderer.invoke('execute:start', request),
    getExecution: (sessionId: string) => ipcRenderer.invoke('execute:get', sessionId),
    getAllExecutions: () => ipcRenderer.invoke('execute:get-all'),
    killExecution: (sessionId: string) => ipcRenderer.invoke('execute:kill', sessionId),
    cleanupExecution: (sessionId: string) => ipcRenderer.invoke('execute:cleanup', sessionId),
    onStream: (callback: (sessionId: string, event: StreamEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, sessionId: string, streamEvent: StreamEvent) => {
        callback(sessionId, streamEvent);
      };
      ipcRenderer.on('execute:stream', handler);
      return () => ipcRenderer.removeListener('execute:stream', handler);
    },
    onComplete: (callback: (sessionId: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, sessionId: string) => {
        callback(sessionId);
      };
      ipcRenderer.on('execute:complete', handler);
      return () => ipcRenderer.removeListener('execute:complete', handler);
    },
    onError: (callback: (sessionId: string, error: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, sessionId: string, error: string) => {
        callback(sessionId, error);
      };
      ipcRenderer.on('execute:error', handler);
      return () => ipcRenderer.removeListener('execute:error', handler);
    },
  } as ExecuteAPI);
}
