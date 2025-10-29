/**
 * Output-Style IPC Handlers
 *
 * Manage output-styles for Claude CLI execution
 */

import fs from 'fs/promises';
import path from 'path';
import type { IPCRouter } from '../router';
import { appLogger } from '../../main/app-context';
import matter from 'gray-matter';

const OUTPUT_STYLES_DIR = '.claude/output-styles';

export interface OutputStyle {
  name: string;
  description: string;
  content: string;
  filePath: string;
}

export interface OutputStyleMetadata {
  name: string;
  description: string;
}

/**
 * Parse output-style file
 */
function parseOutputStyle(content: string, filePath: string): OutputStyle {
  const { data, content: markdownContent } = matter(content);

  return {
    name: (data.name as string) || path.basename(filePath, '.md'),
    description: (data.description as string) || '',
    content: markdownContent.trim(),
    filePath
  };
}

/**
 * Serialize output-style to file format
 */
function serializeOutputStyle(style: Omit<OutputStyle, 'filePath'>): string {
  const frontmatter: OutputStyleMetadata = {
    name: style.name,
    description: style.description
  };

  return matter.stringify(style.content, frontmatter);
}

/**
 * Register output-style handlers
 */
export function registerOutputStyleHandlers(router: IPCRouter): void {
  /**
   * List all output-styles
   */
  router.handle<[{ projectPath: string }], OutputStyle[]>(
    'output-style:list',
    async (_event, { projectPath }) => {
      appLogger.info('Listing output-styles', {
        module: 'OutputStyleHandlers',
        projectPath
      });

      const stylesDir = path.join(projectPath, OUTPUT_STYLES_DIR);

      try {
        const files = await fs.readdir(stylesDir);
        const mdFiles = files.filter((f) => f.endsWith('.md'));

        const styles = await Promise.all(
          mdFiles.map(async (file) => {
            const filePath = path.join(stylesDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            return parseOutputStyle(content, filePath);
          })
        );

        return styles;
      } catch (error) {
        appLogger.error('Failed to list output-styles', error as Error, {
          module: 'OutputStyleHandlers'
        });
        return [];
      }
    }
  );

  /**
   * Get single output-style
   */
  router.handle<[{ projectPath: string; name: string }], OutputStyle | null>(
    'output-style:get',
    async (_event, { projectPath, name }) => {
      appLogger.info('Getting output-style', {
        module: 'OutputStyleHandlers',
        name
      });

      const filePath = path.join(projectPath, OUTPUT_STYLES_DIR, `${name}.md`);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return parseOutputStyle(content, filePath);
      } catch (error) {
        appLogger.error('Failed to get output-style', error as Error, {
          module: 'OutputStyleHandlers',
          name
        });
        return null;
      }
    }
  );

  /**
   * Create output-style
   */
  router.handle<
    [{ projectPath: string; style: Omit<OutputStyle, 'filePath'> }],
    { success: boolean; error?: string; style?: OutputStyle }
  >('output-style:create', async (_event, { projectPath, style }) => {
    appLogger.info('Creating output-style', {
      module: 'OutputStyleHandlers',
      name: style.name
    });

    const fileName = `${style.name}.md`;
    const filePath = path.join(projectPath, OUTPUT_STYLES_DIR, fileName);

    try {
      // Check if already exists
      try {
        await fs.access(filePath);
        return {
          success: false,
          error: `Output-style '${style.name}' already exists`
        };
      } catch {
        // File doesn't exist, good to create
      }

      // Ensure directory exists
      const stylesDir = path.join(projectPath, OUTPUT_STYLES_DIR);
      await fs.mkdir(stylesDir, { recursive: true });

      // Write file
      const content = serializeOutputStyle(style);
      await fs.writeFile(filePath, content, 'utf-8');

      appLogger.info('Output-style created', {
        module: 'OutputStyleHandlers',
        name: style.name
      });

      return {
        success: true,
        style: { ...style, filePath }
      };
    } catch (error) {
      appLogger.error('Failed to create output-style', error as Error, {
        module: 'OutputStyleHandlers',
        name: style.name
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  /**
   * Update output-style
   */
  router.handle<
    [{ projectPath: string; name: string; style: Omit<OutputStyle, 'filePath'> }],
    { success: boolean; error?: string }
  >('output-style:update', async (_event, { projectPath, name, style }) => {
    appLogger.info('Updating output-style', {
      module: 'OutputStyleHandlers',
      name
    });

    const filePath = path.join(projectPath, OUTPUT_STYLES_DIR, `${name}.md`);

    try {
      // Check if exists
      await fs.access(filePath);

      // Write updated content
      const content = serializeOutputStyle(style);
      await fs.writeFile(filePath, content, 'utf-8');

      // If name changed, rename file
      if (style.name !== name) {
        const newFilePath = path.join(projectPath, OUTPUT_STYLES_DIR, `${style.name}.md`);
        await fs.rename(filePath, newFilePath);

        appLogger.info('Output-style renamed', {
          module: 'OutputStyleHandlers',
          from: name,
          to: style.name
        });
      }

      appLogger.info('Output-style updated', {
        module: 'OutputStyleHandlers',
        name: style.name
      });

      return { success: true };
    } catch (error) {
      appLogger.error('Failed to update output-style', error as Error, {
        module: 'OutputStyleHandlers',
        name
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  /**
   * Delete output-style
   */
  router.handle<[{ projectPath: string; name: string }], { success: boolean; error?: string }>(
    'output-style:delete',
    async (_event, { projectPath, name }) => {
      appLogger.info('Deleting output-style', {
        module: 'OutputStyleHandlers',
        name
      });

      const filePath = path.join(projectPath, OUTPUT_STYLES_DIR, `${name}.md`);

      try {
        await fs.unlink(filePath);

        appLogger.info('Output-style deleted', {
          module: 'OutputStyleHandlers',
          name
        });

        return { success: true };
      } catch (error) {
        appLogger.error('Failed to delete output-style', error as Error, {
          module: 'OutputStyleHandlers',
          name
        });

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  /**
   * Get available output-style names
   */
  router.handle<[{ projectPath: string }], string[]>(
    'output-style:list-names',
    async (_event, { projectPath }) => {
      const styles = await router.invoke<[{ projectPath: string }], OutputStyle[]>(
        'output-style:list',
        { projectPath }
      );

      return styles.map((s) => s.name);
    }
  );
}
