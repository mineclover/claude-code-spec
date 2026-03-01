/**
 * Dialog IPC Handlers
 * Handles system dialog operations
 */

import { dialog } from 'electron';
import type { IPCRouter } from '../IPCRouter';

export function registerDialogHandlers(router: IPCRouter): void {
  // Select directory
  router.handle('selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });
}
