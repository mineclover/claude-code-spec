import * as fs from 'node:fs/promises';
import type { IPCRouter } from '../IPCRouter';

/**
 * Register file operation IPC handlers
 */
export function registerFileHandlers(router: IPCRouter): void {
  router.handle('read', async (_event, filePath: string): Promise<string> => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  router.handle('write', async (_event, filePath: string, content: string): Promise<void> => {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write file: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}
