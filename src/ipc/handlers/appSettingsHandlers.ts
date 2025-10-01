/**
 * App Settings IPC Handlers
 * Handles application settings operations
 */

import type { IPCRouter } from '../IPCRouter';
import type { SettingsService } from '../../services/appSettings';

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
  router.handle('set-current-project', async (_event, projectPath: string, projectDirName: string) => {
    settingsService.setCurrentProject(projectPath, projectDirName);
    return { success: true };
  });

  // Clear current project
  router.handle('clear-current-project', async () => {
    settingsService.clearCurrentProject();
    return { success: true };
  });
}
