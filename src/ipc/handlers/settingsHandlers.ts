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
  listMcpConfigs,
  getMcpServerList,
  createMcpConfig,
} from '../../services/settings';
import { settingsService } from '../../services/appSettings';

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

  // ============================================================================
  // MCP Configuration Management
  // ============================================================================

  // List MCP config files
  router.handle('list-mcp-configs', async (_event, projectPath: string) => {
    return listMcpConfigs(projectPath);
  });

  // Get MCP server list from ~/.claude.json and additional resource paths
  router.handle('get-mcp-servers', async (_event) => {
    const additionalPaths = settingsService.getMcpResourcePaths();
    return getMcpServerList(additionalPaths);
  });

  // Create MCP config file
  router.handle('create-mcp-config', async (_event, projectPath: string, name: string, servers: string[]) => {
    return createMcpConfig(projectPath, name, servers);
  });
}
