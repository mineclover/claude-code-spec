/**
 * App preload API. Currently exposes only an error-subscription channel that
 * mirrors the main-side errorReporter via `app:error`.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { ErrorReport } from '../../lib/errorChannel';
import type { AppAPI } from '../../types/api/app';

const APP_ERROR_CHANNEL = 'app:error';

export function exposeAppAPI(): void {
  contextBridge.exposeInMainWorld('appAPI', {
    onError: (callback: (report: ErrorReport) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, report: ErrorReport) => {
        callback(report);
      };
      ipcRenderer.on(APP_ERROR_CHANNEL, handler);
      return () => ipcRenderer.removeListener(APP_ERROR_CHANNEL, handler);
    },
  } as AppAPI);
}
