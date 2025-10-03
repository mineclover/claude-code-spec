import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { WorkAreasConfig } from '../../types/workArea';
import type { IPCRouter } from '../IPCRouter';

export function registerWorkAreaHandlers(router: IPCRouter) {
  /**
   * Get all work areas from config
   */
  router.handle('getWorkAreas', async ({ projectPath }) => {
    try {
      const configPath = path.join(projectPath, '.claude', 'work-areas.json');

      try {
        const content = await fs.readFile(configPath, 'utf-8');
        const config: WorkAreasConfig = JSON.parse(content);
        return config.areas;
      } catch (error) {
        // If file doesn't exist, return default areas
        console.error('Failed to read work-areas.json:', error);
        return [];
      }
    } catch (error) {
      console.error('Failed to get work areas:', error);
      return [];
    }
  });

  /**
   * Update work areas config
   */
  router.handle('updateWorkAreas', async ({ projectPath, areas }) => {
    try {
      const configPath = path.join(projectPath, '.claude', 'work-areas.json');
      const config: WorkAreasConfig = { areas };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

      return { success: true };
    } catch (error) {
      console.error('Failed to update work areas:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update work areas',
      };
    }
  });
}
