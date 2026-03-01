import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const CWD_REGEX = /"cwd"\s*:\s*"((?:[^"\\]|\\.)*)"/;

function readCwdFromSessionFile(filePath: string): string | null {
  try {
    const fd = fs.openSync(filePath, 'r');
    try {
      const chunkSize = 16 * 1024;
      const buffer = Buffer.alloc(chunkSize);
      const read = fs.readSync(fd, buffer, 0, chunkSize, 0);
      const chunk = buffer.toString('utf-8', 0, read);
      const match = chunk.match(CWD_REGEX);
      if (!match) {
        return null;
      }
      return match[1].replace(/\\(.)/g, '$1');
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
}

/**
 * Resolve Claude project directory name to project cwd using session metadata.
 * Does not infer cwd from dash-formatted directory names.
 */
export function parseProjectPath(projectDirName: string): string {
  const projectDirPath = path.join(CLAUDE_PROJECTS_DIR, projectDirName);
  if (!fs.existsSync(projectDirPath)) {
    return projectDirPath;
  }

  try {
    const sessionFiles = fs
      .readdirSync(projectDirPath)
      .filter((file) => file.endsWith('.jsonl'))
      .map((file) => {
        const filePath = path.join(projectDirPath, file);
        const stats = fs.statSync(filePath);
        return { filePath, mtimeMs: stats.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    for (const sessionFile of sessionFiles) {
      const cwd = readCwdFromSessionFile(sessionFile.filePath);
      if (cwd) {
        return cwd;
      }
    }
  } catch {
    // ignore and fallback to directory path
  }

  return projectDirPath;
}

/**
 * Get all Claude project paths from ~/.claude/projects
 */
export function getClaudeProjects(): Array<{ dirName: string; actualPath: string }> {
  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) {
    return [];
  }

  try {
    const dirs = fs
      .readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    return dirs.map((dirName) => ({
      dirName,
      actualPath: parseProjectPath(dirName),
    }));
  } catch (error) {
    console.error('Error reading Claude projects:', error);
    return [];
  }
}

/**
 * Find project path by matching against known Claude projects
 */
export function findProjectPath(sessionId: string): string | null {
  const projects = getClaudeProjects();

  // Try to match session ID or project name
  const match = projects.find(
    (p) => sessionId.includes(p.dirName) || p.dirName.includes(sessionId),
  );

  return match ? match.actualPath : null;
}
