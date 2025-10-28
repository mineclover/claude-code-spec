/**
 * Output Style-related IPC handlers
 */
import * as os from 'node:os';
import * as path from 'node:path';
import {
  deleteMarkdownFile,
  ensureDirectory,
  fileExists,
  listMarkdownFiles,
  readMarkdownFile,
  writeMarkdownFile,
} from '../../lib/fileLoader';
import type { OutputStyleListItem } from '../../types/outputStyle';
import type { IPCRouter } from '../IPCRouter';

const PROJECT_OUTPUT_STYLES_DIR = '.claude/output-styles';

/**
 * Built-in output styles
 */
const BUILTIN_STYLES: OutputStyleListItem[] = [
  {
    name: 'default',
    description: 'Standard balanced output with concise responses',
    type: 'builtin',
  },
  {
    name: 'explanatory',
    description: 'Detailed explanations with educational focus',
    type: 'builtin',
  },
  {
    name: 'learning',
    description: 'Step-by-step guidance for learning and understanding',
    type: 'builtin',
  },
  {
    name: 'json-output',
    description: '⭐ Structured JSON output for programmatic use (Priority)',
    type: 'builtin',
  },
];

/**
 * Get user-level output styles directory path
 */
function getUserOutputStylesDir(): string {
  return path.join(os.homedir(), '.claude', 'output-styles');
}

/**
 * Get project-level output styles directory path
 */
function getProjectOutputStylesDir(projectPath: string): string {
  return path.join(projectPath, PROJECT_OUTPUT_STYLES_DIR);
}

/**
 * Parse output style markdown content
 */
function parseOutputStyleMarkdown(
  content: string,
  _filePath: string,
  _type: 'user' | 'project',
): { name: string; description: string; instructions: string } {
  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new Error('Invalid output style file: missing frontmatter');
  }

  const frontmatter = frontmatterMatch[1];
  const instructions = content.slice(frontmatterMatch[0].length).trim();

  // Parse simple key-value pairs from frontmatter
  const metadata: { name?: string; description?: string } = {};
  frontmatter.split('\n').forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine.includes(':')) {
      const [key, ...valueParts] = trimmedLine.split(':');
      const value = valueParts.join(':').trim().replace(/['"]/g, '');
      metadata[key.trim() as 'name' | 'description'] = value;
    }
  });

  if (!metadata.name) {
    throw new Error('Invalid output style file: missing required field "name"');
  }
  if (!metadata.description) {
    throw new Error('Invalid output style file: missing required field "description"');
  }

  return {
    name: metadata.name,
    description: metadata.description,
    instructions,
  };
}

/**
 * Generate output style markdown content
 */
function generateOutputStyleMarkdown(
  name: string,
  description: string,
  instructions: string,
): string {
  const frontmatter = `---
name: ${name}
description: ${description}
---`;

  return `${frontmatter}\n\n${instructions}`.trim();
}

/**
 * Register output style-related IPC handlers
 */
export function registerOutputStyleHandlers(router: IPCRouter): void {
  // List all output styles (builtin + project + user)
  router.handle(
    'listOutputStyles',
    async (_event, args: { projectPath: string }): Promise<OutputStyleListItem[]> => {
      const { projectPath } = args;
      try {
        const styles: OutputStyleListItem[] = [...BUILTIN_STYLES];

        // Get project-level output styles
        const projectOutputStylesDir = getProjectOutputStylesDir(projectPath);
        const projectFiles = await listMarkdownFiles(projectOutputStylesDir);

        for (const filePath of projectFiles) {
          try {
            const content = await readMarkdownFile(filePath);
            if (!content) continue;

            const style = parseOutputStyleMarkdown(content, filePath, 'project');
            styles.push({
              name: style.name,
              description: style.description,
              type: 'project',
            });
          } catch (error) {
            console.warn(`[OutputStyleHandlers] Failed to parse style ${filePath}:`, error);
          }
        }

        // Get user-level output styles
        const userOutputStylesDir = getUserOutputStylesDir();
        const userFiles = await listMarkdownFiles(userOutputStylesDir);

        for (const filePath of userFiles) {
          try {
            const content = await readMarkdownFile(filePath);
            if (!content) continue;

            const style = parseOutputStyleMarkdown(content, filePath, 'user');
            styles.push({
              name: style.name,
              description: style.description,
              type: 'user',
            });
          } catch (error) {
            console.warn(`[OutputStyleHandlers] Failed to parse style ${filePath}:`, error);
          }
        }

        return styles;
      } catch (error) {
        console.error('[OutputStyleHandlers] Failed to list output styles:', error);
        return BUILTIN_STYLES;
      }
    },
  );

  // Get a single output style
  router.handle(
    'getOutputStyle',
    async (
      _event,
      args: { name: string; type: 'builtin' | 'user' | 'project'; projectPath?: string },
    ): Promise<string | null> => {
      const { name, type, projectPath } = args;
      try {
        // Built-in styles don't have markdown files
        if (type === 'builtin') {
          return null;
        }

        let outputStylesDir: string;
        if (type === 'project') {
          if (!projectPath) {
            throw new Error('projectPath is required for project-level output styles');
          }
          outputStylesDir = getProjectOutputStylesDir(projectPath);
        } else {
          outputStylesDir = getUserOutputStylesDir();
        }

        const filePath = path.join(outputStylesDir, `${name}.md`);
        return await readMarkdownFile(filePath);
      } catch (error) {
        console.error(`[OutputStyleHandlers] Failed to get output style ${name}:`, error);
        return null;
      }
    },
  );

  // Create a new output style
  router.handle(
    'createOutputStyle',
    async (
      _event,
      args: {
        name: string;
        description: string;
        instructions: string;
        type: 'user' | 'project';
        projectPath?: string;
      },
    ): Promise<{ success: boolean; error?: string }> => {
      const { name, description, instructions, type, projectPath } = args;
      try {
        let outputStylesDir: string;
        if (type === 'project') {
          if (!projectPath) {
            return {
              success: false,
              error: 'projectPath is required for project-level output styles',
            };
          }
          outputStylesDir = getProjectOutputStylesDir(projectPath);
        } else {
          outputStylesDir = getUserOutputStylesDir();
        }

        await ensureDirectory(outputStylesDir);
        const filePath = path.join(outputStylesDir, `${name}.md`);

        // Check if file already exists
        if (await fileExists(filePath)) {
          return { success: false, error: 'Output style already exists' };
        }

        const content = generateOutputStyleMarkdown(name, description, instructions);
        await writeMarkdownFile(filePath, content);
        return { success: true };
      } catch (error) {
        console.error(`[OutputStyleHandlers] Failed to create output style ${name}:`, error);
        return { success: false, error: String(error) };
      }
    },
  );

  // Update an existing output style
  router.handle(
    'updateOutputStyle',
    async (
      _event,
      args: {
        name: string;
        description: string;
        instructions: string;
        type: 'user' | 'project';
        projectPath?: string;
      },
    ): Promise<{ success: boolean; error?: string }> => {
      const { name, description, instructions, type, projectPath } = args;
      try {
        let outputStylesDir: string;
        if (type === 'project') {
          if (!projectPath) {
            return {
              success: false,
              error: 'projectPath is required for project-level output styles',
            };
          }
          outputStylesDir = getProjectOutputStylesDir(projectPath);
        } else {
          outputStylesDir = getUserOutputStylesDir();
        }

        const filePath = path.join(outputStylesDir, `${name}.md`);
        const content = generateOutputStyleMarkdown(name, description, instructions);
        await writeMarkdownFile(filePath, content);
        return { success: true };
      } catch (error) {
        console.error(`[OutputStyleHandlers] Failed to update output style ${name}:`, error);
        return { success: false, error: String(error) };
      }
    },
  );

  // Delete an output style
  router.handle(
    'deleteOutputStyle',
    async (
      _event,
      args: { name: string; type: 'user' | 'project'; projectPath?: string },
    ): Promise<{ success: boolean; error?: string }> => {
      const { name, type, projectPath } = args;
      try {
        let outputStylesDir: string;
        if (type === 'project') {
          if (!projectPath) {
            return {
              success: false,
              error: 'projectPath is required for project-level output styles',
            };
          }
          outputStylesDir = getProjectOutputStylesDir(projectPath);
        } else {
          outputStylesDir = getUserOutputStylesDir();
        }

        const filePath = path.join(outputStylesDir, `${name}.md`);
        await deleteMarkdownFile(filePath);
        return { success: true };
      } catch (error) {
        console.error(`[OutputStyleHandlers] Failed to delete output style ${name}:`, error);
        return { success: false, error: String(error) };
      }
    },
  );
}
