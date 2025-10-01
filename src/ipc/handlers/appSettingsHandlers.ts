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
}
