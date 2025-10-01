/**
 * Settings IPC Handlers
 * Handles project settings operations
 */

import type { IPCRouter } from '../IPCRouter';
import {
  createBackup,
  deleteSettingsFile,
  findSettingsFiles,
  loadBackupFromFile,
  readSettingsFile,
  restoreBackup,
  saveBackupToFile,
  validateMcpJson,
  writeSettingsFile,
} from '../../services/settings';

export function registerSettingsHandlers(router: IPCRouter): void {
  // Find all settings files
  router.handle('find-files', async (_event, projectPath: string) => {
    return findSettingsFiles(projectPath);
  });

  // Create backup
  router.handle('create-backup', async (_event, projectPath: string) => {
    return createBackup(projectPath);
  });

  // Save backup to file
  router.handle('save-backup', async (_event, backup: unknown, filePath: string) => {
    return saveBackupToFile(backup, filePath);
  });

  // Load backup from file
  router.handle('load-backup', async (_event, filePath: string) => {
    return loadBackupFromFile(filePath);
  });

  // Restore backup
  router.handle('restore-backup', async (_event, backup: unknown) => {
    return restoreBackup(backup);
  });

  // Read settings file
  router.handle('read-file', async (_event, filePath: string) => {
    return readSettingsFile(filePath);
  });

  // Write settings file
  router.handle('write-file', async (_event, filePath: string, content: string) => {
    return writeSettingsFile(filePath, content);
  });

  // Delete settings file
  router.handle('delete-file', async (_event, filePath: string) => {
    return deleteSettingsFile(filePath);
  });

  // Validate MCP JSON
  router.handle('validate-mcp-json', async (_event, content: string) => {
    return validateMcpJson(content);
  });
}
