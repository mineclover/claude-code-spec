/**
 * IPC handlers setup
 */

import { registerAppSettingsHandlers } from '../ipc/handlers/appSettingsHandlers';
import { registerBookmarksHandlers } from '../ipc/handlers/bookmarksHandlers';
import { registerClaudeHandlers } from '../ipc/handlers/claudeHandlers';
import { registerClaudeSessionsHandlers } from '../ipc/handlers/claudeSessionsHandlers';
import { registerDialogHandlers } from '../ipc/handlers/dialogHandlers';
import { registerDocsHandlers } from '../ipc/handlers/docsHandlers';
import { registerFileHandlers } from '../ipc/handlers/fileHandlers';
import { registerLoggerHandlers } from '../ipc/handlers/loggerHandlers';
import { registerMetadataHandlers } from '../ipc/handlers/metadataHandlers';
import { registerSettingsHandlers } from '../ipc/handlers/settingsHandlers';
import { registerTaskHandlers } from '../ipc/handlers/taskHandlers';
import { ipcRegistry } from '../ipc/IPCRouter';
import { settingsService } from '../services/appSettings';
import { logger, loggerConfig, sessionManager } from './app-context';

/**
 * Register all IPC handlers
 */
export function setupIPCHandlers(): void {
  // Dialog handlers
  const dialogRouter = ipcRegistry.router('dialog');
  registerDialogHandlers(dialogRouter);

  // Claude handlers
  const claudeRouter = ipcRegistry.router('claude');
  registerClaudeHandlers(claudeRouter, {
    sessionManager,
    logger,
  });

  // Logger handlers
  const loggerRouter = ipcRegistry.router('logger');
  registerLoggerHandlers(loggerRouter, loggerConfig);

  // Settings handlers
  const settingsRouter = ipcRegistry.router('settings');
  registerSettingsHandlers(settingsRouter);

  // Bookmarks handlers
  const bookmarksRouter = ipcRegistry.router('bookmarks');
  registerBookmarksHandlers(bookmarksRouter);

  // Claude sessions handlers
  const claudeSessionsRouter = ipcRegistry.router('claude-sessions');
  registerClaudeSessionsHandlers(claudeSessionsRouter);

  // App settings handlers
  const appSettingsRouter = ipcRegistry.router('app-settings');
  registerAppSettingsHandlers(appSettingsRouter, settingsService);

  // Docs handlers
  const docsRouter = ipcRegistry.router('docs');
  registerDocsHandlers(docsRouter);

  // Metadata handlers
  const metadataRouter = ipcRegistry.router('metadata');
  registerMetadataHandlers(metadataRouter, settingsService);

  // File handlers
  const fileRouter = ipcRegistry.router('file');
  registerFileHandlers(fileRouter);

  // Task handlers
  const taskRouter = ipcRegistry.router('task');
  registerTaskHandlers(taskRouter);

  console.log('[Main] Registered IPC channels:', ipcRegistry.getAllChannels());
}
