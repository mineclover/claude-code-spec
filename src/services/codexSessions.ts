/**
 * Codex Sessions Service
 * Reads session data from ~/.codex/sessions/ and ~/.codex/archived_sessions/
 *
 * Optimization: persistent CWD cache avoids reading 67K+ files on every load.
 * - First load: partial read (first 16KB) + regex CWD extraction
 * - Subsequent loads: cache hit for known files, partial read only for new files
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  ClaudeProjectInfo,
  ClaudeSessionEntry,
  ClaudeSessionInfo,
  LatestSessionMeta,
  ProjectFolder,
} from '../types/api/sessions';
import type { ProgressCallback } from './sessionProvider';

function getCodexSessionsDir(): string {
  return path.join(os.homedir(), '.codex', 'sessions');
}

function getCodexArchivedDir(): string {
  return path.join(os.homedir(), '.codex', 'archived_sessions');
}

// ---------------------------------------------------------------------------
// CWD Cache – persisted to ~/.codex/.cwd-cache.json
// ---------------------------------------------------------------------------

interface CwdCache {
  [filePath: string]: string; // filePath → cwd
}

const CACHE_PATH = path.join(os.homedir(), '.codex', '.cwd-cache.json');
let cwdCache: CwdCache | null = null;
let cacheDirty = false;

function loadCache(): CwdCache {
  if (cwdCache) return cwdCache;
  let nextCache: CwdCache;
  try {
    nextCache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as CwdCache;
  } catch {
    nextCache = {};
  }
  cwdCache = nextCache;
  return nextCache;
}

function saveCache(): void {
  if (!cacheDirty || !cwdCache) return;
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cwdCache), 'utf-8');
    cacheDirty = false;
  } catch {
    // non-critical
  }
}

// ---------------------------------------------------------------------------
// Fast CWD extraction – reads only first 16KB, uses regex
// ---------------------------------------------------------------------------

const CWD_REGEX = /"cwd"\s*:\s*"((?:[^"\\]|\\.)*)"/;
const PARTIAL_READ_SIZE = 16384; // 16KB – covers max observed first-line size (~13KB)

function extractCwdFast(filePath: string): string | null {
  try {
    const fd = fs.openSync(filePath, 'r');
    try {
      const buf = Buffer.alloc(PARTIAL_READ_SIZE);
      const bytesRead = fs.readSync(fd, buf, 0, PARTIAL_READ_SIZE, 0);
      const chunk = buf.toString('utf-8', 0, bytesRead);
      const match = chunk.match(CWD_REGEX);
      if (match) {
        // Unescape JSON string escapes
        return match[1].replace(/\\(.)/g, '$1');
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    // file read error
  }
  return null;
}

function getCwd(filePath: string): string {
  const cache = loadCache();
  const cached = cache[filePath];
  if (cached !== undefined) return cached;

  const cwd = extractCwdFast(filePath) ?? '/';
  cache[filePath] = cwd;
  cacheDirty = true;
  return cwd;
}

// ---------------------------------------------------------------------------
// File collection – walk + stat (lightweight, ~230ms for 67K files)
// ---------------------------------------------------------------------------

interface SessionFile {
  filePath: string;
  size: number;
  mtimeMs: number;
}

function collectSessionFiles(dir: string): SessionFile[] {
  const results: SessionFile[] = [];
  try {
    fs.accessSync(dir);
  } catch {
    return results;
  }

  const walk = (currentDir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.jsonl')) {
        try {
          const s = fs.statSync(fullPath);
          results.push({ filePath: fullPath, size: s.size, mtimeMs: s.mtimeMs });
        } catch {
          // skip
        }
      }
    }
  };
  walk(dir);
  return results;
}

// ---------------------------------------------------------------------------
// In-memory project cache – invalidated when file count changes
// ---------------------------------------------------------------------------

let projectCache: { fileCount: number; projects: ClaudeProjectInfo[] } | null = null;

/**
 * List project folders using CWD cache (no file content reading if cache is warm)
 */
export function listCodexProjectFolders(onProgress?: ProgressCallback): ProjectFolder[] {
  const sessionsDir = getCodexSessionsDir();
  const archivedDir = getCodexArchivedDir();

  onProgress?.({ phase: 'scanning', message: 'Collecting session files...' });

  const allFiles = [...collectSessionFiles(sessionsDir), ...collectSessionFiles(archivedDir)];

  // Group by CWD using cache
  const projectMap = new Map<string, { latestMtime: number; count: number }>();
  const total = allFiles.length;

  for (let i = 0; i < allFiles.length; i++) {
    const { filePath, mtimeMs } = allFiles[i];

    if (i % 1000 === 0) {
      onProgress?.({
        phase: 'processing',
        current: i,
        total,
        message: `Processing files... ${i}/${total}`,
      });
    }

    const cwd = getCwd(filePath);
    const existing = projectMap.get(cwd);
    if (existing) {
      existing.count++;
      if (mtimeMs > existing.latestMtime) {
        existing.latestMtime = mtimeMs;
      }
    } else {
      projectMap.set(cwd, { latestMtime: mtimeMs, count: 1 });
    }
  }

  saveCache();

  onProgress?.({ phase: 'done', message: 'Done' });

  return Array.from(projectMap.entries())
    .map(
      ([projectPath, { latestMtime, count }]) =>
        ({
          projectPath,
          projectDirName: projectPath === '/' ? 'codex-root' : path.basename(projectPath),
          lastModified: latestMtime,
          sessionCount: count,
        }) satisfies ProjectFolder,
    )
    .sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));
}

/**
 * Get metadata from the latest session of a project
 */
export function getLatestCodexSessionMeta(projectPath: string): LatestSessionMeta | null {
  const sessionsDir = getCodexSessionsDir();
  const archivedDir = getCodexArchivedDir();

  const allFiles = [...collectSessionFiles(sessionsDir), ...collectSessionFiles(archivedDir)];

  // Find files belonging to this project
  let latestFile: SessionFile | null = null;

  for (const file of allFiles) {
    const cwd = getCwd(file.filePath);
    if (cwd === projectPath) {
      if (!latestFile || file.mtimeMs > latestFile.mtimeMs) {
        latestFile = file;
      }
    }
  }

  if (!latestFile) return null;

  return {
    sessionId: path.basename(latestFile.filePath, '.jsonl'),
    lastModified: latestFile.mtimeMs,
    fileSize: latestFile.size,
    cwd: projectPath,
    hasData: latestFile.size > 0,
  };
}

export function getAllCodexProjects(): ClaudeProjectInfo[] {
  const sessionsDir = getCodexSessionsDir();
  const archivedDir = getCodexArchivedDir();

  const allFiles = [...collectSessionFiles(sessionsDir), ...collectSessionFiles(archivedDir)];

  // Return cached result if file count unchanged
  if (projectCache && projectCache.fileCount === allFiles.length) {
    return projectCache.projects;
  }

  // Group by CWD
  const projectMap = new Map<string, ClaudeSessionInfo[]>();

  for (const { filePath, size, mtimeMs } of allFiles) {
    const cwd = getCwd(filePath);
    const sessionId = path.basename(filePath, '.jsonl');

    const sessionInfo: ClaudeSessionInfo = {
      sessionId,
      filePath,
      fileSize: size,
      lastModified: mtimeMs,
      cwd,
      hasData: size > 0,
    };

    const existing = projectMap.get(cwd) ?? [];
    existing.push(sessionInfo);
    projectMap.set(cwd, existing);
  }

  // Persist CWD cache to disk
  saveCache();

  const projects = Array.from(projectMap.entries())
    .map(([projectPath, sessions]) => ({
      projectPath,
      projectDirName: projectPath === '/' ? 'codex-root' : path.basename(projectPath),
      claudeProjectDir: sessionsDir,
      sessions: sessions.sort((a, b) => b.lastModified - a.lastModified),
    }))
    .sort((a, b) => {
      const aLatest = a.sessions[0]?.lastModified ?? 0;
      const bLatest = b.sessions[0]?.lastModified ?? 0;
      return bLatest - aLatest;
    });

  projectCache = { fileCount: allFiles.length, projects };
  return projects;
}

export function getAllCodexProjectsPaginated(
  page = 0,
  pageSize = 10,
  onProgress?: ProgressCallback,
): { projects: ClaudeProjectInfo[]; total: number; hasMore: boolean } {
  onProgress?.({ phase: 'scanning', message: 'Loading Codex projects...' });
  const all = getAllCodexProjects();
  onProgress?.({ phase: 'done', message: 'Done' });
  const start = page * pageSize;
  const end = start + pageSize;
  return {
    projects: all.slice(start, end),
    total: all.length,
    hasMore: end < all.length,
  };
}

export function getCodexProjectSessions(projectPath: string): ClaudeSessionInfo[] {
  const all = getAllCodexProjects();
  const project = all.find((p) => p.projectPath === projectPath);
  return project?.sessions ?? [];
}

export function getCodexProjectSessionsPaginated(
  projectPath: string,
  page = 0,
  pageSize = 20,
): {
  sessions: Omit<ClaudeSessionInfo, 'cwd' | 'firstUserMessage' | 'hasData'>[];
  total: number;
  hasMore: boolean;
} {
  const sessions = getCodexProjectSessions(projectPath);
  const start = page * pageSize;
  const end = start + pageSize;
  return {
    sessions: sessions.slice(start, end).map(({ sessionId, filePath, fileSize, lastModified }) => ({
      sessionId,
      filePath,
      fileSize,
      lastModified,
    })),
    total: sessions.length,
    hasMore: end < sessions.length,
  };
}

export function readCodexSessionLog(projectPath: string, sessionId: string): ClaudeSessionEntry[] {
  const sessions = getCodexProjectSessions(projectPath);
  const target = sessions.find((session) => session.sessionId === sessionId);
  if (target?.filePath) {
    try {
      const content = fs.readFileSync(target.filePath, 'utf-8');
      return content
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as ClaudeSessionEntry);
    } catch {
      return [];
    }
  }

  // Fallback: scan all files but only accept entries whose extracted cwd matches projectPath.
  const dirs = [getCodexSessionsDir(), getCodexArchivedDir()];
  for (const dir of dirs) {
    const files = collectSessionFiles(dir);
    for (const file of files) {
      if (path.basename(file.filePath, '.jsonl') !== sessionId) {
        continue;
      }
      if (getCwd(file.filePath) !== projectPath) {
        continue;
      }
      try {
        const content = fs.readFileSync(file.filePath, 'utf-8');
        return content
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line) as ClaudeSessionEntry);
      } catch {
        return [];
      }
    }
  }

  return [];
}
