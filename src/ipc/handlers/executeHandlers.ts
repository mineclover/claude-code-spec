/**
 * Execute IPC Handlers
 * Handles CLI execution requests and stream events
 */

import { BrowserWindow } from 'electron';
import { multiCliExecutionService } from '../../services/MultiCliExecutionService';
import type { ExecutionRequest } from '../../types/execution';
import type { IPCRouter } from '../IPCRouter';

export function registerExecuteHandlers(router: IPCRouter): void {
  // Start execution
  router.handle('start', async (_event, request: ExecutionRequest) => {
    return multiCliExecutionService.execute(request);
  });

  // Get execution info
  router.handle('get', async (_event, sessionId: string) => {
    return multiCliExecutionService.getExecution(sessionId) ?? null;
  });

  // Get all executions
  router.handle('get-all', async () => {
    return multiCliExecutionService.getAllExecutions();
  });

  // Kill execution
  router.handle('kill', async (_event, sessionId: string) => {
    multiCliExecutionService.killExecution(sessionId);
  });

  // Cleanup execution
  router.handle('cleanup', async (_event, sessionId: string) => {
    multiCliExecutionService.cleanupExecution(sessionId);
  });
}

/**
 * Setup event forwarding from MultiCliExecutionService to renderer
 */
export function setupExecutionEventForwarding(): void {
  multiCliExecutionService.onStream((sessionId, event) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('execute:stream', sessionId, event);
    }
  });

  multiCliExecutionService.onComplete((sessionId) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('execute:complete', sessionId);
    }
  });

  multiCliExecutionService.onError((sessionId, error) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('execute:error', sessionId, error);
    }
  });
}
