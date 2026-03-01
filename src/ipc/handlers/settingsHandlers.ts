/**
 * Settings IPC Handlers
 * Merged: App settings + MCP config + project settings
 */

import type { SettingsService } from '../../services/appSettings';
import {
  createBackup,
  createMcpConfig,
  createMcpDefaultConfig,
  deleteSettingsFile,
  findSettingsFiles,
  getMcpServerCandidates,
  getMcpServerList,
  listMcpConfigs,
  loadBackupFromFile,
  readSettingsFile,
  restoreBackup,
  saveBackupToFile,
  validateMcpJson,
  writeSettingsFile,
} from '../../services/settings';
import type {
  MaintenanceRegistryDocument,
  MaintenanceRegistryService,
} from '../../types/maintenance-registry';
import type { IPCRouter } from '../IPCRouter';

export function registerSettingsHandlers(
  router: IPCRouter,
  settingsService: SettingsService,
): void {
  // ---- App Settings ----
  router.handle('get-all', async () => {
    return settingsService.getAllSettings();
  });

  router.handle('get-settings-path', async () => {
    return settingsService.getSettingsPath();
  });

  router.handle('get-claude-projects-path', async () => {
    return settingsService.getClaudeProjectsPath();
  });

  router.handle('set-claude-projects-path', async (_event, projectsPath: string) => {
    settingsService.setClaudeProjectsPath(projectsPath);
    return { success: true };
  });

  router.handle('get-current-project-path', async () => {
    return settingsService.getCurrentProjectPath();
  });

  router.handle('get-current-project-dir-name', async () => {
    return settingsService.getCurrentProjectDirName();
  });

  router.handle(
    'set-current-project',
    async (_event, projectPath: string, projectDirName: string) => {
      settingsService.setCurrentProject(projectPath, projectDirName);
      return { success: true };
    },
  );

  router.handle('clear-current-project', async () => {
    settingsService.clearCurrentProject();
    return { success: true };
  });

  router.handle('get-maintenance-registry', async () => {
    return settingsService.getMaintenanceRegistry();
  });

  router.handle(
    'set-maintenance-registry',
    async (_event, registry: MaintenanceRegistryDocument) => {
      settingsService.setMaintenanceRegistry(registry);
      return { success: true };
    },
  );

  router.handle('get-maintenance-services', async () => {
    return settingsService.getMaintenanceServices();
  });

  router.handle(
    'set-maintenance-services',
    async (_event, services: MaintenanceRegistryService[]) => {
      settingsService.setMaintenanceServices(services);
      return { success: true };
    },
  );

  // ---- MCP Resource Paths ----
  router.handle('get-mcp-resource-paths', async () => {
    return settingsService.getMcpResourcePaths();
  });

  router.handle('set-mcp-resource-paths', async (_event, paths: string[]) => {
    settingsService.setMcpResourcePaths(paths);
    return { success: true };
  });

  router.handle('add-mcp-resource-path', async (_event, path: string) => {
    settingsService.addMcpResourcePath(path);
    return { success: true };
  });

  router.handle('remove-mcp-resource-path', async (_event, path: string) => {
    settingsService.removeMcpResourcePath(path);
    return { success: true };
  });

  router.handle('get-default-paths', async () => {
    return settingsService.getDefaultPaths();
  });

  router.handle('get-default-mcp-resource-paths', async () => {
    return settingsService.getDefaultMcpResourcePaths();
  });

  // ---- Document Paths ----
  router.handle('get-claude-docs-path', async () => {
    return settingsService.getClaudeDocsPath();
  });

  router.handle('set-claude-docs-path', async (_event, docsPath: string) => {
    settingsService.setClaudeDocsPath(docsPath);
    return { success: true };
  });

  router.handle('get-controller-docs-path', async () => {
    return settingsService.getControllerDocsPath();
  });

  router.handle('set-controller-docs-path', async (_event, docsPath: string) => {
    settingsService.setControllerDocsPath(docsPath);
    return { success: true };
  });

  router.handle('get-metadata-path', async () => {
    return settingsService.getMetadataPath();
  });

  router.handle('set-metadata-path', async (_event, metadataPath: string) => {
    settingsService.setMetadataPath(metadataPath);
    return { success: true };
  });

  // ---- Project Settings Files ----
  router.handle('find-files', async (_event, projectPath: string) => {
    return findSettingsFiles(projectPath);
  });

  router.handle('read-file', async (_event, filePath: string) => {
    return readSettingsFile(filePath);
  });

  router.handle('write-file', async (_event, filePath: string, content: string) => {
    return writeSettingsFile(filePath, content);
  });

  router.handle('delete-file', async (_event, filePath: string) => {
    return deleteSettingsFile(filePath);
  });

  router.handle('validate-mcp-json', async (_event, content: string) => {
    return validateMcpJson(content);
  });

  // ---- MCP Config Management ----
  router.handle('list-mcp-configs', async (_event, projectPath: string) => {
    return listMcpConfigs(projectPath);
  });

  router.handle('get-mcp-servers', async (_event, projectPath?: string) => {
    const additionalPaths = settingsService.getMcpResourcePaths();
    return getMcpServerList({ additionalPaths, projectPath });
  });

  router.handle('get-mcp-server-candidates', async (_event, projectPath?: string) => {
    const additionalPaths = settingsService.getMcpResourcePaths();
    return getMcpServerCandidates({ additionalPaths, projectPath });
  });

  router.handle(
    'create-mcp-config',
    async (_event, projectPath: string, name: string, servers: string[]) => {
      const additionalPaths = settingsService.getMcpResourcePaths();
      return createMcpConfig(projectPath, name, servers, { additionalPaths });
    },
  );

  router.handle(
    'create-mcp-default-config',
    async (
      _event,
      projectPath: string,
      target: 'project' | 'claude' | 'codex' | 'gemini',
      servers: string[],
    ) => {
      const additionalPaths = settingsService.getMcpResourcePaths();
      return createMcpDefaultConfig(projectPath, target, servers, { additionalPaths });
    },
  );

  // ---- Backup ----
  router.handle('create-backup', async (_event, projectPath: string) => {
    return createBackup(projectPath);
  });

  router.handle('save-backup', async (_event, backup: unknown, filePath: string) => {
    return saveBackupToFile(backup as Parameters<typeof saveBackupToFile>[0], filePath);
  });

  router.handle('load-backup', async (_event, filePath: string) => {
    return loadBackupFromFile(filePath);
  });

  router.handle('restore-backup', async (_event, backup: unknown) => {
    return restoreBackup(backup as Parameters<typeof restoreBackup>[0]);
  });
}
