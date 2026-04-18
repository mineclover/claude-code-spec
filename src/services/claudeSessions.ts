/**
 * Claude CLI session management service
 *
 * Reads session logs from ~/.claude/projects directory
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  extractSessionPathFromEvent,
  inferProjectPathFromDashDirName,
  resolveSessionPath,
} from '../lib/sessionPathResolver';
import { settingsService } from './appSettings';
import { errorReporter } from './errorReporter';

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
  const resolved = resolveClaudeProjectDir(projectPath);
  if (resolved) {
    return resolved;
  }
  const fallbackDashName = pathToDashFormat(projectPath);
  return path.join(getClaudeProjectsDir(), fallbackDashName);
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

        // Extract cwd/project path from session event payloads (metadata-first).
        if (!cwd) {
          const resolvedPath = extractSessionPathFromEvent(block);
          if (resolvedPath) {
            cwd = resolvedPath;
          }
        }

        // Look for first "user" block (blocks can have different types)
        if (!firstUserMessage) {
          // Check if this is a user block with message content
          if (block.message && typeof block.message === 'object') {
            const message = block.message as { role?: string; content?: string };
            if (message.role === 'user' && message.content) {
              firstUserMessage = message.content.trim();
            }
          }
          // Some formats might have content directly on the block
          else if (block.role === 'user' && block.content) {
            firstUserMessage = block.content.trim();
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
    errorReporter.report('claudeSessions.extractSessionMetadata', error);
    return { hasData: false };
  }
};

// ============================================================================
// Lightweight Project Folder Listing
// ============================================================================

import type { LatestSessionMeta, ProjectFolder } from '../types/api/sessions';
import type { ProgressCallback } from './sessionProvider';

interface SessionFileStat {
  fileName: string;
  filePath: string;
  fileSize: number;
  lastModified: number;
}

interface ClaudeProjectDirectoryInfo {
  dirName: string;
  claudeProjectDir: string;
  projectPath: string | null;
  latestSessionMtime: number;
  sessionCount: number;
}

interface ClaudeProjectDirectoryCache {
  projectsDir: string;
  builtAt: number;
  byDirName: Map<string, ClaudeProjectDirectoryInfo>;
  byProjectPath: Map<string, ClaudeProjectDirectoryInfo>;
}

const PROJECT_DIRECTORY_CACHE_TTL_MS = 30_000;
let projectDirectoryCache: ClaudeProjectDirectoryCache | null = null;

function listSessionFilesFromProjectDir(claudeProjectDir: string): SessionFileStat[] {
  try {
    const files = fs.readdirSync(claudeProjectDir);
    return files
      .filter((file) => file.endsWith('.jsonl'))
      .map((file) => {
        const filePath = path.join(claudeProjectDir, file);
        const stats = fs.statSync(filePath);
        return {
          fileName: file,
          filePath,
          fileSize: stats.size,
          lastModified: stats.mtimeMs,
        };
      })
      .sort((a, b) => b.lastModified - a.lastModified);
  } catch {
    return [];
  }
}

/**
 * Scan the first ~32KB of a session file, line by line, until a cwd-bearing
 * event is found. Early events (permission-mode, file-history-snapshot) carry
 * no cwd; user/assistant events do. Stopping at the first match keeps this
 * fast on large files while tolerating the fact that cwd usually appears
 * around line 3+.
 */
function extractCwdFromSessionFileHead(filePath: string): string | null {
  try {
    const CHUNK_SIZE = 32 * 1024;
    const buffer = Buffer.alloc(CHUNK_SIZE);
    const fd = fs.openSync(filePath, 'r');
    let bytesRead = 0;
    try {
      bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, 0);
    } finally {
      fs.closeSync(fd);
    }
    const chunk = buffer.subarray(0, bytesRead).toString('utf-8');
    // Drop a trailing partial line so we never attempt to parse an incomplete
    // JSON object at the chunk boundary.
    const lastNewline = chunk.lastIndexOf('\n');
    const parseable = lastNewline === -1 ? chunk : chunk.slice(0, lastNewline);
    for (const rawLine of parseable.split('\n')) {
      const line = rawLine.trim();
      if (!line || (line[0] !== '{' && line[0] !== '[')) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      const cwd = extractSessionPathFromEvent(parsed);
      if (cwd) {
        return cwd;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function resolveProjectPathFromSessionFiles(
  sessionFiles: SessionFileStat[],
  projectDirName: string,
): string | null {
  // Always prefer the explicit cwd recorded inside a session file. Claude's
  // dash-directory naming is lossy (a dirname like `-a-b-c` can mean either
  // /a/b/c or /a-b/c or /a/b-c, etc.), so any inference from the dirname is
  // unreliable for filesystem paths that contain dashes.
  const explicitPath = sessionFiles.length > 0
    ? extractCwdFromSessionFileHead(sessionFiles[0].filePath)
    : null;
  const inferredPath = inferProjectPathFromDashDirName(projectDirName);

  return resolveSessionPath({
    explicitPath,
    inferredPath,
    safeDefaultPath: null,
  });
}

function buildClaudeProjectDirectoryCache(projectsDir: string): ClaudeProjectDirectoryCache {
  const byDirName = new Map<string, ClaudeProjectDirectoryInfo>();
  const byProjectPath = new Map<string, ClaudeProjectDirectoryInfo>();

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(projectsDir, { withFileTypes: true });
  } catch {
    return {
      projectsDir,
      builtAt: Date.now(),
      byDirName,
      byProjectPath,
    };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const dirName = entry.name;
    const claudeProjectDir = path.join(projectsDir, dirName);
    const sessionFiles = listSessionFilesFromProjectDir(claudeProjectDir);
    if (sessionFiles.length === 0) {
      continue;
    }

    const projectPath = resolveProjectPathFromSessionFiles(sessionFiles, dirName);
    const info: ClaudeProjectDirectoryInfo = {
      dirName,
      claudeProjectDir,
      projectPath,
      latestSessionMtime: sessionFiles[0]?.lastModified ?? 0,
      sessionCount: sessionFiles.length,
    };

    byDirName.set(dirName, info);

    if (projectPath) {
      const existing = byProjectPath.get(projectPath);
      if (!existing || info.latestSessionMtime >= existing.latestSessionMtime) {
        byProjectPath.set(projectPath, info);
      }
    }
  }

  return {
    projectsDir,
    builtAt: Date.now(),
    byDirName,
    byProjectPath,
  };
}

function getClaudeProjectDirectoryCache(forceRefresh = false): ClaudeProjectDirectoryCache {
  const projectsDir = getClaudeProjectsDir();
  const now = Date.now();

  if (
    !forceRefresh &&
    projectDirectoryCache &&
    projectDirectoryCache.projectsDir === projectsDir &&
    now - projectDirectoryCache.builtAt < PROJECT_DIRECTORY_CACHE_TTL_MS
  ) {
    return projectDirectoryCache;
  }

  projectDirectoryCache = buildClaudeProjectDirectoryCache(projectsDir);
  return projectDirectoryCache;
}

function resolveClaudeProjectDir(projectPath: string): string | null {
  const cached = getClaudeProjectDirectoryCache().byProjectPath.get(projectPath);
  if (cached) {
    return cached.claudeProjectDir;
  }

  const refreshed = getClaudeProjectDirectoryCache(true).byProjectPath.get(projectPath);
  if (refreshed) {
    return refreshed.claudeProjectDir;
  }

  // Backward-compat fallback for previously stored inferred paths.
  const fallbackPath = path.join(getClaudeProjectsDir(), pathToDashFormat(projectPath));
  return fs.existsSync(fallbackPath) ? fallbackPath : null;
}

function getProjectSessionsFromDir(claudeProjectDir: string): ClaudeSessionInfo[] {
  const sessionFiles = listSessionFilesFromProjectDir(claudeProjectDir);
  return sessionFiles.map((file) => ({
    sessionId: file.fileName.replace('.jsonl', ''),
    filePath: file.filePath,
    fileSize: file.fileSize,
    lastModified: file.lastModified,
    ...extractSessionMetadata(file.filePath),
  }));
}

function getProjectSessionsBasicFromDir(
  claudeProjectDir: string,
): Omit<ClaudeSessionInfo, 'cwd' | 'firstUserMessage' | 'hasData'>[] {
  const sessionFiles = listSessionFilesFromProjectDir(claudeProjectDir);
  return sessionFiles.map((file) => ({
    sessionId: file.fileName.replace('.jsonl', ''),
    filePath: file.filePath,
    fileSize: file.fileSize,
    lastModified: file.lastModified,
  }));
}

/**
 * List project folders based on actual session metadata (cwd)
 */
export const listClaudeProjectFolders = (onProgress?: ProgressCallback): ProjectFolder[] => {
  const cache = getClaudeProjectDirectoryCache();
  const projectInfos = Array.from(cache.byDirName.values())
    .filter((info) => info.projectPath && info.sessionCount > 0)
    .sort((a, b) => b.latestSessionMtime - a.latestSessionMtime);

  const total = projectInfos.length;

  return projectInfos.map((info, i) => {
    onProgress?.({
      phase: 'scanning',
      current: i + 1,
      total,
      message: `Scanning directories... ${i + 1}/${total}`,
    });

    return {
      projectPath: info.projectPath as string,
      projectDirName: info.dirName,
      lastModified: info.latestSessionMtime || undefined,
      sessionCount: info.sessionCount,
    };
  });
};

/**
 * Get metadata from the latest session file of a project (reads only 1 file)
 */
export const getLatestClaudeSessionMeta = (projectPath: string): LatestSessionMeta | null => {
  const projectDir = getClaudeProjectDir(projectPath);

  if (!fs.existsSync(projectDir)) {
    return null;
  }

  try {
    const sessionFiles = listSessionFilesFromProjectDir(projectDir);
    const latest = sessionFiles[0];
    if (!latest) {
      return null;
    }
    const sessionId = latest.fileName.replace('.jsonl', '');
    const metadata = extractSessionMetadata(latest.filePath);

    return {
      sessionId,
      lastModified: latest.lastModified,
      fileSize: latest.fileSize,
      cwd: metadata.cwd,
      firstUserMessage: metadata.firstUserMessage,
      hasData: metadata.hasData,
    };
  } catch (error) {
    console.error('[ClaudeSessions] Failed to get latest session meta:', error);
    errorReporter.report('claudeSessions.getLatestSessionMeta', error);
    return null;
  }
};

export const getProjectSessions = (projectPath: string): ClaudeSessionInfo[] => {
  const projectDir = getClaudeProjectDir(projectPath);

  if (!fs.existsSync(projectDir)) {
    return [];
  }

  try {
    return getProjectSessionsFromDir(projectDir);
  } catch (error) {
    console.error('[ClaudeSessions] Failed to read project sessions:', error);
    errorReporter.report('claudeSessions.getProjectSessions', error);
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
    return listSessionFilesFromProjectDir(projectDir).length;
  } catch (error) {
    console.error('[ClaudeSessions] Failed to count sessions:', error);
    errorReporter.report('claudeSessions.countSessions', error);
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
    return getProjectSessionsBasicFromDir(projectDir);
  } catch (error) {
    console.error('[ClaudeSessions] Failed to read project sessions:', error);
    errorReporter.report('claudeSessions.getProjectSessionsBasic', error);
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
    const allSessions = getProjectSessionsBasicFromDir(projectDir);

    const total = allSessions.length;
    const start = page * pageSize;
    const end = start + pageSize;
    const sessions = allSessions.slice(start, end);
    const hasMore = end < total;

    return { sessions, total, hasMore };
  } catch (error) {
    console.error('[ClaudeSessions] Failed to read project sessions:', error);
    errorReporter.report('claudeSessions.getProjectSessionsPaginated', error);
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
  const sessions = getProjectSessions(projectPath);
  const target = sessions.find((session) => session.sessionId === sessionId);
  if (!target?.filePath || !fs.existsSync(target.filePath)) {
    return { hasData: false };
  }

  return extractSessionMetadata(target.filePath);
};

// ============================================================================
// Session Log Reading
// ============================================================================

export const readSessionLog = (projectPath: string, sessionId: string): ClaudeSessionEntry[] => {
  const sessions = getProjectSessions(projectPath);
  const target = sessions.find((session) => session.sessionId === sessionId);

  if (!target?.filePath || !fs.existsSync(target.filePath)) {
    console.warn(`[ClaudeSessions] Session file not found for ${projectPath}/${sessionId}`);
    return [];
  }

  try {
    const content = fs.readFileSync(target.filePath, 'utf-8');
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as ClaudeSessionEntry);
  } catch (error) {
    console.error('[ClaudeSessions] Failed to read session log:', error);
    errorReporter.report('claudeSessions.readSessionLog', error);
    return [];
  }
};

/**
 * Get all projects that have Claude sessions
 */
export const getAllClaudeProjects = (): ClaudeProjectInfo[] => {
  try {
    const cache = getClaudeProjectDirectoryCache();
    const projectInfos = Array.from(cache.byDirName.values())
      .filter((info) => info.projectPath && info.sessionCount > 0)
      .sort((a, b) => b.latestSessionMtime - a.latestSessionMtime);

    return projectInfos.map((info) => ({
      projectPath: info.projectPath as string,
      projectDirName: info.dirName,
      claudeProjectDir: info.claudeProjectDir,
      sessions: getProjectSessionsFromDir(info.claudeProjectDir),
    }));
  } catch (error) {
    console.error('[ClaudeSessions] Failed to get all Claude projects:', error);
    errorReporter.report('claudeSessions.getAllProjects', error);
    return [];
  }
};

/**
 * Get total count of projects with sessions (no caching)
 */
export const getTotalProjectCount = (): number => {
  try {
    const cache = getClaudeProjectDirectoryCache();
    const count = Array.from(cache.byDirName.values()).filter(
      (info) => info.projectPath && info.sessionCount > 0,
    ).length;
    console.log('[ClaudeSessions] Total project count:', count);
    return count;
  } catch (error) {
    console.error('[ClaudeSessions] Failed to get total project count:', error);
    errorReporter.report('claudeSessions.getTotalProjectCount', error);
    return 0;
  }
};

/**
 * Get paginated Claude projects with sessions
 */
export const getAllClaudeProjectsPaginated = (
  page: number = 0,
  pageSize: number = 10,
  onProgress?: ProgressCallback,
): {
  projects: ClaudeProjectInfo[];
  total: number;
  hasMore: boolean;
} => {
  try {
    const cache = getClaudeProjectDirectoryCache();
    const allProjects = Array.from(cache.byDirName.values())
      .filter((info) => info.projectPath && info.sessionCount > 0)
      .sort((a, b) => b.latestSessionMtime - a.latestSessionMtime);

    const total = allProjects.length;
    const start = page * pageSize;
    const end = start + pageSize;
    const hasMore = end < total;

    // Get paginated slice and load full sessions only for these
    const paginatedProjectDirs = allProjects.slice(start, end);

    onProgress?.({
      phase: 'reading',
      current: 0,
      total: paginatedProjectDirs.length,
      message: 'Reading session data...',
    });

    const projects = paginatedProjectDirs.map((projectInfo, i) => {
      onProgress?.({
        phase: 'reading',
        current: i + 1,
        total: paginatedProjectDirs.length,
        message: `Reading sessions... ${i + 1}/${paginatedProjectDirs.length}`,
      });

      const sessions = getProjectSessionsFromDir(projectInfo.claudeProjectDir);

      return {
        projectPath: projectInfo.projectPath as string,
        projectDirName: projectInfo.dirName,
        claudeProjectDir: projectInfo.claudeProjectDir,
        sessions,
      };
    });

    onProgress?.({ phase: 'done', message: 'Done' });
    return { projects, total, hasMore };
  } catch (error) {
    console.error('[ClaudeSessions] Failed to get paginated Claude projects:', error);
    errorReporter.report('claudeSessions.getPaginatedProjects', error);
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
export const getUserQuestions = (projectPath: string, sessionId: string): ClaudeSessionEntry[] => {
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
};

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
