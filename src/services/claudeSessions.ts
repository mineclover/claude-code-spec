/**
 * Claude CLI session management service
 *
 * Reads session logs from ~/.claude/projects directory
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ============================================================================
// Types
// ============================================================================

export interface ClaudeSessionEntry {
  type: string;
  summary?: string;
  leafUuid?: string;
  [key: string]: unknown;
}

export interface ClaudeProjectInfo {
  projectPath: string;
  claudeProjectDir: string;
  sessions: ClaudeSessionInfo[];
}

export interface ClaudeSessionInfo {
  sessionId: string;
  filePath: string;
  fileSize: number;
  lastModified: number;
}

// ============================================================================
// Path Conversion
// ============================================================================

/**
 * Convert file system path to Claude project directory name
 * /Users/junwoobang/project/claude-code-spec -> -Users-junwoobang-project-claude-code-spec
 */
export const pathToDashFormat = (fsPath: string): string => {
  // Remove leading slash and replace remaining slashes with dashes
  return `-${fsPath.replace(/^\//, '').replace(/\//g, '-')}`;
};

/**
 * Convert Claude project directory name to file system path
 * -Users-junwoobang-project-claude-code-spec -> /Users/junwoobang/project/claude-code-spec
 */
export const dashFormatToPath = (dashFormat: string): string => {
  // Remove leading dash and replace remaining dashes with slashes
  return `/${dashFormat.replace(/^-/, '').replace(/-/g, '/')}`;
};

// ============================================================================
// Directory Operations
// ============================================================================

export const getClaudeProjectsDir = (): string => {
  return path.join(os.homedir(), '.claude', 'projects');
};

export const getClaudeProjectDir = (projectPath: string): string => {
  const dashName = pathToDashFormat(projectPath);
  return path.join(getClaudeProjectsDir(), dashName);
};

export const getProjectSessions = (projectPath: string): ClaudeSessionInfo[] => {
  const projectDir = getClaudeProjectDir(projectPath);

  if (!fs.existsSync(projectDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(projectDir);

    return files
      .filter((file) => file.endsWith('.jsonl'))
      .map((file) => {
        const filePath = path.join(projectDir, file);
        const stats = fs.statSync(filePath);
        const sessionId = file.replace('.jsonl', '');

        return {
          sessionId,
          filePath,
          fileSize: stats.size,
          lastModified: stats.mtimeMs,
        };
      })
      .sort((a, b) => b.lastModified - a.lastModified); // Most recent first
  } catch (error) {
    console.error('[ClaudeSessions] Failed to read project sessions:', error);
    return [];
  }
};

// ============================================================================
// Session Log Reading
// ============================================================================

export const readSessionLog = (projectPath: string, sessionId: string): ClaudeSessionEntry[] => {
  const projectDir = getClaudeProjectDir(projectPath);
  const sessionFile = path.join(projectDir, `${sessionId}.jsonl`);

  if (!fs.existsSync(sessionFile)) {
    console.warn(`[ClaudeSessions] Session file not found: ${sessionFile}`);
    return [];
  }

  try {
    const content = fs.readFileSync(sessionFile, 'utf-8');
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as ClaudeSessionEntry);
  } catch (error) {
    console.error('[ClaudeSessions] Failed to read session log:', error);
    return [];
  }
};

/**
 * Get all projects that have Claude sessions
 */
export const getAllClaudeProjects = (): ClaudeProjectInfo[] => {
  const projectsDir = getClaudeProjectsDir();

  if (!fs.existsSync(projectsDir)) {
    return [];
  }

  try {
    const dirs = fs.readdirSync(projectsDir);

    return dirs
      .filter((dir) => {
        const fullPath = path.join(projectsDir, dir);
        return fs.statSync(fullPath).isDirectory();
      })
      .map((dir) => {
        const claudeProjectDir = path.join(projectsDir, dir);
        const projectPath = dashFormatToPath(dir);
        const sessions = getProjectSessions(projectPath);

        return {
          projectPath,
          claudeProjectDir,
          sessions,
        };
      })
      .filter((project) => project.sessions.length > 0); // Only projects with sessions
  } catch (error) {
    console.error('[ClaudeSessions] Failed to get all Claude projects:', error);
    return [];
  }
};

/**
 * Get session summary (first summary entry in the log)
 */
export const getSessionSummary = (projectPath: string, sessionId: string): string | null => {
  const entries = readSessionLog(projectPath, sessionId);
  const summaryEntry = entries.find((entry) => entry.type === 'summary' && entry.summary);

  return summaryEntry?.summary || null;
};
