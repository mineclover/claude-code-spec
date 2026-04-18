/**
 * App-wide IPC handlers.
 *
 * Today this is a single concern: broadcast every ErrorReport produced by the
 * main-process errorReporter onto the `app:error` channel so the renderer can
 * surface it via toast.
 *
 * No `invoke` actions yet — the renderer subscribes via `ipcRenderer.on`.
 */

import { BrowserWindow } from 'electron';
import { errorReporter } from '../../services/errorReporter';

const APP_ERROR_CHANNEL = 'app:error';

export function setupAppErrorBroadcast(): () => void {
  return errorReporter.subscribe((report) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (win.isDestroyed()) continue;
      win.webContents.send(APP_ERROR_CHANNEL, report);
    }
  });
}
