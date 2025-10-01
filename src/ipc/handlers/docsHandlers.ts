/**
 * Docs IPC Handlers
 * Handles documentation file operations
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { IPCRouter } from '../IPCRouter';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

async function readDirectoryStructure(dirPath: string): Promise<FileNode[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip hidden files and directories
      if (entry.name.startsWith('.')) {
        continue;
      }

      if (entry.isDirectory()) {
        const children = await readDirectoryStructure(fullPath);
        nodes.push({
          name: entry.name,
          path: fullPath,
          type: 'directory',
          children,
        });
      } else {
        nodes.push({
          name: entry.name,
          path: fullPath,
          type: 'file',
        });
      }
    }

    // Sort: directories first, then files, both alphabetically
    return nodes.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    });
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return [];
  }
}

export function registerDocsHandlers(router: IPCRouter): void {
  // Read directory structure
  router.handle('read-structure', async (_event, rootPath: string) => {
    try {
      const structure = await readDirectoryStructure(rootPath);
      return structure;
    } catch (error) {
      console.error('Error reading docs structure:', error);
      throw error;
    }
  });

  // Read file content
  router.handle('read-file', async (_event, filePath: string) => {
    try {
      // Clean the file path - remove any trailing backticks or quotes
      const cleanPath = filePath.replace(/[`'"]+$/, '').trim();
      const content = await fs.readFile(cleanPath, 'utf-8');
      return content;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      throw error;
    }
  });
}
