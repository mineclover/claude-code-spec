/**
 * Claude CLI session management service
 *
 * Reads session logs from ~/.claude/projects directory
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { settingsService } from './appSettings';

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
  projectPath: string; // Actual cwd from session data
  projectDirName: string; // Directory name format (-Users-junwoobang-...)
  claudeProjectDir: string;
  sessions: ClaudeSessionInfo[];
}

export interface ClaudeSessionInfo {
  sessionId: string;
  filePath: string;
  fileSize: number;
  lastModified: number;
  cwd?: string; // Actual project path from session data
  firstUserMessage?: string; // First user message content
  hasData: boolean; // Whether session has any data
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
  const configuredPath = settingsService.getClaudeProjectsPath();
  if (configuredPath) {
    return configuredPath;
  }
  // Fallback to default path if not configured
  return path.join(os.homedir(), '.claude', 'projects');
};

export const getClaudeProjectDir = (projectPath: string): string => {
  const dashName = pathToDashFormat(projectPath);
  return path.join(getClaudeProjectsDir(), dashName);
};

/**
 * Extract session metadata from the session log file
 */
const extractSessionMetadata = (
  filePath: string,
): Pick<ClaudeSessionInfo, 'cwd' | 'firstUserMessage' | 'hasData'> => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    if (lines.length === 0) {
      return { hasData: false };
    }

    let cwd: string | undefined;
    let firstUserMessage: string | undefined;
    let hasAnyData = false;

    // Read each log entry (block)
    for (const line of lines) {
      try {
        const block = JSON.parse(line);
        hasAnyData = true;

        // Extract cwd from any block that has it
        if (!cwd && block.cwd) {
          cwd = block.cwd;
          console.log('[extractSessionMetadata] Found cwd:', cwd);
        }

        // Look for first "user" block (blocks can have different types)
        if (!firstUserMessage) {
          // Check if this is a user block with message content
          if (block.message && typeof block.message === 'object') {
            const message = block.message as { role?: string; content?: string };
            if (message.role === 'user' && message.content) {
              firstUserMessage = message.content.trim();
              console.log(
                '[extractSessionMetadata] Found user message:',
                firstUserMessage.substring(0, 50),
              );
            }
          }
          // Some formats might have content directly on the block
          else if (block.role === 'user' && block.content) {
            firstUserMessage = block.content.trim();
            console.log(
              '[extractSessionMetadata] Found user message (direct):',
              firstUserMessage?.substring(0, 50),
            );
          }
        }

        // Early exit if we found both
        if (cwd && firstUserMessage) {
          break;
        }
      } catch (_parseError) {}
    }

    return {
      cwd,
      firstUserMessage,
      hasData: hasAnyData,
    };
  } catch (error) {
    console.error('[ClaudeSessions] Failed to extract session metadata:', error);
    return { hasData: false };
  }
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
        const metadata = extractSessionMetadata(filePath);

        return {
          sessionId,
          filePath,
          fileSize: stats.size,
          lastModified: stats.mtimeMs,
          ...metadata,
        };
      })
      .sort((a, b) => b.lastModified - a.lastModified); // Most recent first
  } catch (error) {
    console.error('[ClaudeSessions] Failed to read project sessions:', error);
    return [];
  }
};

/**
 * Get total session count for a project
 */
export const getProjectSessionCount = (projectPath: string): number => {
  const projectDir = getClaudeProjectDir(projectPath);

  if (!fs.existsSync(projectDir)) {
    return 0;
  }

  try {
    const files = fs.readdirSync(projectDir);
    return files.filter((file) => file.endsWith('.jsonl')).length;
  } catch (error) {
    console.error('[ClaudeSessions] Failed to count sessions:', error);
    return 0;
  }
};

/**
 * Get basic session info without metadata (fast)
 */
export const getProjectSessionsBasic = (
  projectPath: string,
): Omit<ClaudeSessionInfo, 'cwd' | 'firstUserMessage' | 'hasData'>[] => {
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
      .sort((a, b) => b.lastModified - a.lastModified);
  } catch (error) {
    console.error('[ClaudeSessions] Failed to read project sessions:', error);
    return [];
  }
};

/**
 * Get paginated basic session info without metadata (fast)
 */
export const getProjectSessionsPaginated = (
  projectPath: string,
  page: number = 0,
  pageSize: number = 20,
): {
  sessions: Omit<ClaudeSessionInfo, 'cwd' | 'firstUserMessage' | 'hasData'>[];
  total: number;
  hasMore: boolean;
} => {
  const projectDir = getClaudeProjectDir(projectPath);

  if (!fs.existsSync(projectDir)) {
    return { sessions: [], total: 0, hasMore: false };
  }

  try {
    const files = fs.readdirSync(projectDir);

    const allSessions = files
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
      .sort((a, b) => b.lastModified - a.lastModified);

    const total = allSessions.length;
    const start = page * pageSize;
    const end = start + pageSize;
    const sessions = allSessions.slice(start, end);
    const hasMore = end < total;

    return { sessions, total, hasMore };
  } catch (error) {
    console.error('[ClaudeSessions] Failed to read project sessions:', error);
    return { sessions: [], total: 0, hasMore: false };
  }
};

/**
 * Get metadata for a single session
 */
export const getSessionMetadata = (
  projectPath: string,
  sessionId: string,
): Pick<ClaudeSessionInfo, 'cwd' | 'firstUserMessage' | 'hasData'> => {
  const projectDir = getClaudeProjectDir(projectPath);
  const sessionFile = path.join(projectDir, `${sessionId}.jsonl`);

  if (!fs.existsSync(sessionFile)) {
    return { hasData: false };
  }

  return extractSessionMetadata(sessionFile);
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
        const inferredPath = dashFormatToPath(dir);
        const sessions = getProjectSessions(inferredPath);

        // Use actual cwd from first session with data, fallback to inferred path
        let actualProjectPath = inferredPath;
        const sessionWithCwd = sessions.find((s) => s.cwd && s.hasData);
        if (sessionWithCwd?.cwd) {
          actualProjectPath = sessionWithCwd.cwd;
        }

        return {
          projectPath: actualProjectPath,
          projectDirName: dir,
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
 * Get total count of projects with sessions (no caching)
 */
export const getTotalProjectCount = (): number => {
  const projectsDir = getClaudeProjectsDir();

  if (!fs.existsSync(projectsDir)) {
    return 0;
  }

  try {
    const dirs = fs.readdirSync(projectsDir);

    // Count only directories that have sessions
    let count = 0;
    for (const dir of dirs) {
      const fullPath = path.join(projectsDir, dir);
      if (fs.statSync(fullPath).isDirectory()) {
        const inferredPath = dashFormatToPath(dir);
        const sessionCount = getProjectSessionCount(inferredPath);
        if (sessionCount > 0) {
          count++;
        }
      }
    }

    console.log('[ClaudeSessions] Total project count:', count);
    return count;
  } catch (error) {
    console.error('[ClaudeSessions] Failed to get total project count:', error);
    return 0;
  }
};

/**
 * Get paginated Claude projects with sessions
 */
export const getAllClaudeProjectsPaginated = (
  page: number = 0,
  pageSize: number = 10,
): {
  projects: ClaudeProjectInfo[];
  total: number;
  hasMore: boolean;
} => {
  const projectsDir = getClaudeProjectsDir();

  if (!fs.existsSync(projectsDir)) {
    return { projects: [], total: 0, hasMore: false };
  }

  try {
    const dirs = fs.readdirSync(projectsDir);

    // Get all project directories
    const allProjectDirs = dirs.filter((dir) => {
      const fullPath = path.join(projectsDir, dir);
      return fs.statSync(fullPath).isDirectory();
    });

    // Get basic project info (without full sessions) and sort by last modified
    const allProjects = allProjectDirs
      .map((dir) => {
        const claudeProjectDir = path.join(projectsDir, dir);
        const inferredPath = dashFormatToPath(dir);

        // Get only basic session info to determine if project has sessions
        const sessions = getProjectSessionsBasic(inferredPath);

        if (sessions.length === 0) {
          return null;
        }

        // Get latest session timestamp for sorting
        const latestTimestamp = Math.max(...sessions.map((s) => s.lastModified));

        return {
          dir,
          claudeProjectDir,
          inferredPath,
          latestTimestamp,
          sessionCount: sessions.length,
        };
      })
      .filter((p) => p !== null)
      .sort((a, b) => b?.latestTimestamp - a?.latestTimestamp);

    const total = allProjects.length;
    const start = page * pageSize;
    const end = start + pageSize;
    const hasMore = end < total;

    // Get paginated slice and load full sessions only for these
    const paginatedProjectDirs = allProjects.slice(start, end);

    const projects = paginatedProjectDirs.map((projectInfo) => {
      if (!projectInfo) {
        throw new Error('Project info is null after filtering');
      }
      const { dir, claudeProjectDir, inferredPath } = projectInfo;
      const sessions = getProjectSessions(inferredPath);

      // Use actual cwd from first session with data, fallback to inferred path
      let actualProjectPath = inferredPath;
      const sessionWithCwd = sessions.find((s) => s.cwd && s.hasData);
      if (sessionWithCwd?.cwd) {
        actualProjectPath = sessionWithCwd.cwd;
      }

      return {
        projectPath: actualProjectPath,
        projectDirName: dir,
        claudeProjectDir,
        sessions,
      };
    });

    return { projects, total, hasMore };
  } catch (error) {
    console.error('[ClaudeSessions] Failed to get paginated Claude projects:', error);
    return { projects: [], total: 0, hasMore: false };
  }
};

/**
 * Get session summary (first summary entry in the log)
 */
/**
 * Get user questions from session log
 * Filters events where message.role === 'user'
 */
export const export const export const getUserQuestions = (projectPath: string, sessionId: string): ClaudeSessionEntry[] => {
  const entries = readSessionLog(projectPath, sessionId);

  return entries.filter((entry) => {
    // Check if entry has a message with role 'user'
    if (entry.message && typeof entry.message === 'object') {
      const message = entry.message as { role?: string; content?: unknown };

      if (message.role !== 'user') {
        return false;
      }

      // Only process string content
      if (typeof message.content !== 'string') {
        return false;
      }

      const content = message.content.trim();

      // Skip anything that starts with [{ - these are tool results or structured data
      if (content.startsWith('[{')) {
        return false;
      }

      // Skip system messages
      if (content.startsWith('Caveat:')) {
        return false;
      }

      // Skip command messages
      if (content.includes('<command-name>') || content.includes('<command-message>')) {
        return false;
      }

      // Skip empty stdout
      if (content === '<local-command-stdout></local-command-stdout>') {
        return false;
      }

      return true;
    }
    return false;
  });
};;;

/**
 * Get auto-generated (sidechain) requests from session log
 * Filters events where isSidechain === true
 */
export const getAutoGeneratedRequests = (
  projectPath: string,
  sessionId: string,
): ClaudeSessionEntry[] => {
  const entries = readSessionLog(projectPath, sessionId);
  
  return entries.filter((entry) => {
    return entry.isSidechain === true;
  });
};

export const getSessionSummary = (projectPath: string, sessionId: string): string | null => {
  const entries = readSessionLog(projectPath, sessionId);
  const summaryEntry = entries.find((entry) => entry.type === 'summary' && entry.summary);

  return summaryEntry?.summary || null;
};

/**
 * Get session preview (first user message content)
 */
export const getSessionPreview = (projectPath: string, sessionId: string): string | null => {
  const entries = readSessionLog(projectPath, sessionId);

  // Find first entry with message.role === "user"
  for (const entry of entries) {
    if (entry.message && typeof entry.message === 'object') {
      const message = entry.message as { role?: string; content?: string };
      if (message.role === 'user' && message.content) {
        // Truncate to first 100 characters for preview
        const preview = message.content.trim();
        return preview.length > 100 ? `${preview.substring(0, 100)}...` : preview;
      }
    }
  }

  return null;
};
