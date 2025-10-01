/**
 * App Settings IPC Handlers
 * Handles application settings operations
 */

import type { SettingsService } from '../../services/appSettings';
import type { IPCRouter } from '../IPCRouter';

export function registerAppSettingsHandlers(
  router: IPCRouter,
  settingsService: SettingsService,
): void {
  // Get all settings
  router.handle('get-all', async () => {
    return settingsService.getAllSettings();
  });

  // Get Claude projects path
  router.handle('get-claude-projects-path', async () => {
    return settingsService.getClaudeProjectsPath();
  });

  // Set Claude projects path
  router.handle('set-claude-projects-path', async (_event, projectsPath: string) => {
    settingsService.setClaudeProjectsPath(projectsPath);
    return { success: true };
  });

  // Get current project path
  router.handle('get-current-project-path', async () => {
    return settingsService.getCurrentProjectPath();
  });

  // Get current project dir name
  router.handle('get-current-project-dir-name', async () => {
    return settingsService.getCurrentProjectDirName();
  });

  // Set current project
  router.handle(
    'set-current-project',
    async (_event, projectPath: string, projectDirName: string) => {
      settingsService.setCurrentProject(projectPath, projectDirName);
      return { success: true };
    },
  );

  // Clear current project
  router.handle('clear-current-project', async () => {
    settingsService.clearCurrentProject();
    return { success: true };
  });

  // Get MCP resource paths
  router.handle('get-mcp-resource-paths', async () => {
    return settingsService.getMcpResourcePaths();
  });

  // Set MCP resource paths
  router.handle('set-mcp-resource-paths', async (_event, paths: string[]) => {
    settingsService.setMcpResourcePaths(paths);
    return { success: true };
  });

  // Add MCP resource path
  router.handle('add-mcp-resource-path', async (_event, path: string) => {
    settingsService.addMcpResourcePath(path);
    return { success: true };
  });

  // Remove MCP resource path
  router.handle('remove-mcp-resource-path', async (_event, path: string) => {
    settingsService.removeMcpResourcePath(path);
    return { success: true };
  });

  // Get OS-specific default paths
  router.handle('get-default-paths', async () => {
    return settingsService.getDefaultPaths();
  });

  // Get default MCP resource paths
  router.handle('get-default-mcp-resource-paths', async () => {
    return settingsService.getDefaultMcpResourcePaths();
  });
}
