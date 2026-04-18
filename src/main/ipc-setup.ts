/**
 * IPC handlers setup - 5 domain routers
 */

import { setupAppErrorBroadcast } from '../ipc/handlers/appHandlers';
import { registerDialogHandlers } from '../ipc/handlers/dialogHandlers';
import {
  registerExecuteHandlers,
  setupExecutionEventForwarding,
} from '../ipc/handlers/executeHandlers';
import { registerMcpHandlers } from '../ipc/handlers/mcpHandlers';
import { registerMoaiHandlers } from '../ipc/handlers/moaiHandlers';
import { registerSessionsHandlers } from '../ipc/handlers/sessionsHandlers';
import { registerSettingsHandlers } from '../ipc/handlers/settingsHandlers';
import { registerToolsHandlers } from '../ipc/handlers/toolsHandlers';
import { ipcRegistry } from '../ipc/IPCRouter';
import { settingsService } from '../services/appSettings';

export function setupIPCHandlers(): void {
  // Dialog
  const dialogRouter = ipcRegistry.router('dialog');
  registerDialogHandlers(dialogRouter);

  // Execute
  const executeRouter = ipcRegistry.router('execute');
  registerExecuteHandlers(executeRouter);
  setupExecutionEventForwarding();

  // Sessions
  const sessionsRouter = ipcRegistry.router('sessions');
  registerSessionsHandlers(sessionsRouter);

  // Settings (merged: app settings + MCP + project settings)
  const settingsRouter = ipcRegistry.router('settings');
  registerSettingsHandlers(settingsRouter, settingsService);

  // Tools
  const toolsRouter = ipcRegistry.router('tools');
  registerToolsHandlers(toolsRouter);

  // MoAI
  const moaiRouter = ipcRegistry.router('moai');
  registerMoaiHandlers(moaiRouter);

  // MCP (Registry + Policy + Resolver)
  const mcpRouter = ipcRegistry.router('mcp');
  registerMcpHandlers(mcpRouter);

  // App-wide error broadcast — bridges errorReporter to renderer toasts.
  setupAppErrorBroadcast();

  console.log('[Main] Registered IPC channels:', ipcRegistry.getAllChannels());
}
