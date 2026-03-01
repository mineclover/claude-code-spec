/**
 * Common file loading utilities for .claude directory files
 * Used by agents, tasks, and other markdown-based features
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Ensure a directory exists, creating it recursively if needed
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Options for listing markdown files
 */
export interface ListMarkdownOptions {
  /** Skip hidden files (starting with .) */
  skipHidden?: boolean;
  /** Include subdirectories */
  recursive?: boolean;
  /** Custom filter function */
  filter?: (filename: string) => boolean;
}

/**
 * List all markdown files in a directory
 */
export async function listMarkdownFiles(
  dirPath: string,
  options: ListMarkdownOptions = {},
): Promise<string[]> {
  const { skipHidden = true, recursive = false, filter } = options;

  try {
    await ensureDirectory(dirPath);
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      // Skip hidden files if requested
      if (skipHidden && entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && recursive) {
        // Recursively process subdirectories
        const subFiles = await listMarkdownFiles(fullPath, options);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Apply custom filter if provided
        if (!filter || filter(entry.name)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  } catch (error) {
    console.error(`[FileLoader] Failed to list markdown files in ${dirPath}:`, error);
    return [];
  }
}

/**
 * Read a markdown file's content
 */
export async function readMarkdownFile(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error(`[FileLoader] Failed to read file ${filePath}:`, error);
    return null;
  }
}

/**
 * Write a markdown file
 */
export async function writeMarkdownFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Delete a markdown file
 */
export async function deleteMarkdownFile(filePath: string): Promise<void> {
  await fs.unlink(filePath);
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load and parse markdown files with frontmatter
 */
export interface MarkdownFileInfo<T = Record<string, string>> {
  filePath: string;
  fileName: string;
  metadata: T;
  content: string;
}

/**
 * Load all markdown files in a directory and parse them with a custom parser
 */
export async function loadMarkdownFilesWithParser<T>(
  dirPath: string,
  parser: (content: string, filePath: string) => { metadata: T; content: string },
  options: ListMarkdownOptions = {},
): Promise<MarkdownFileInfo<T>[]> {
  const files = await listMarkdownFiles(dirPath, options);
  const results: MarkdownFileInfo<T>[] = [];

  for (const filePath of files) {
    const content = await readMarkdownFile(filePath);
    if (!content) continue;

    try {
      const parsed = parser(content, filePath);
      results.push({
        filePath,
        fileName: path.basename(filePath),
        metadata: parsed.metadata,
        content: parsed.content,
      });
    } catch (error) {
      console.warn(`[FileLoader] Failed to parse ${filePath}:`, error);
    }
  }

  return results;
}
