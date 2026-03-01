/**
 * Gemini Sessions Service
 * Reads session data from ~/.gemini/tmp/[HASH]/chats/session-*.json
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

function getGeminiBaseDir(): string {
  return path.join(os.homedir(), '.gemini', 'tmp');
}

interface GeminiSession {
  sessionId?: string;
  projectHash?: string;
  startTime?: string;
  lastUpdated?: string;
  messages?: Array<{
    id?: string;
    timestamp?: string;
    type?: string;
    content?: string;
  }>;
}

function resolveProjectRoot(projectDir: string): string {
  const rootFile = path.join(projectDir, '.project_root');
  try {
    if (fs.existsSync(rootFile)) {
      return fs.readFileSync(rootFile, 'utf-8').trim();
    }
  } catch {
    // ignore
  }
  return path.basename(projectDir);
}

function parseGeminiSession(filePath: string): GeminiSession | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as GeminiSession;
  } catch {
    return null;
  }
}

/**
 * List project folders with readdir + stat + small .project_root read
 */
export function listGeminiProjectFolders(onProgress?: ProgressCallback): ProjectFolder[] {
  const baseDir = getGeminiBaseDir();
  if (!fs.existsSync(baseDir)) return [];

  const projectMap = new Map<string, { latestMtime: number; count: number }>();

  try {
    const projectDirs = fs
      .readdirSync(baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    const total = projectDirs.length;

    for (let idx = 0; idx < projectDirs.length; idx++) {
      const projDir = projectDirs[idx];
      onProgress?.({
        phase: 'scanning',
        current: idx + 1,
        total,
        message: `Scanning directories... ${idx + 1}/${total}`,
      });
      const projPath = path.join(baseDir, projDir.name);
      const chatsDir = path.join(projPath, 'chats');
      if (!fs.existsSync(chatsDir)) continue;

      const projectRoot = resolveProjectRoot(projPath);

      try {
        const sessionFiles = fs.readdirSync(chatsDir).filter((f) => f.endsWith('.json'));

        if (sessionFiles.length === 0) continue;

        let latestMtime = 0;
        for (const sessionFile of sessionFiles) {
          try {
            const stats = fs.statSync(path.join(chatsDir, sessionFile));
            if (stats.mtimeMs > latestMtime) {
              latestMtime = stats.mtimeMs;
            }
          } catch {
            // skip
          }
        }

        const existing = projectMap.get(projectRoot);
        if (existing) {
          existing.count += sessionFiles.length;
          if (latestMtime > existing.latestMtime) {
            existing.latestMtime = latestMtime;
          }
        } else {
          projectMap.set(projectRoot, { latestMtime, count: sessionFiles.length });
        }
      } catch {
        // skip
      }
    }
  } catch {
    return [];
  }

  return Array.from(projectMap.entries())
    .map(
      ([projectPath, { latestMtime, count }]) =>
        ({
          projectPath,
          projectDirName: path.basename(projectPath),
          lastModified: latestMtime,
          sessionCount: count,
        }) satisfies ProjectFolder,
    )
    .sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));
}

/**
 * Get metadata from the latest session of a project
 */
export function getLatestGeminiSessionMeta(projectPath: string): LatestSessionMeta | null {
  const baseDir = getGeminiBaseDir();
  if (!fs.existsSync(baseDir)) return null;

  let latestFile: { filePath: string; mtimeMs: number; size: number } | null = null;

  try {
    const projectDirs = fs
      .readdirSync(baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const projDir of projectDirs) {
      const projPath = path.join(baseDir, projDir.name);
      const chatsDir = path.join(projPath, 'chats');
      if (!fs.existsSync(chatsDir)) continue;

      const projectRoot = resolveProjectRoot(projPath);
      if (projectRoot !== projectPath) continue;

      try {
        const sessionFiles = fs.readdirSync(chatsDir).filter((f) => f.endsWith('.json'));
        for (const sessionFile of sessionFiles) {
          const filePath = path.join(chatsDir, sessionFile);
          try {
            const stats = fs.statSync(filePath);
            if (!latestFile || stats.mtimeMs > latestFile.mtimeMs) {
              latestFile = { filePath, mtimeMs: stats.mtimeMs, size: stats.size };
            }
          } catch {
            // skip
          }
        }
      } catch {
        // skip
      }
    }
  } catch {
    return null;
  }

  if (!latestFile) return null;

  const session = parseGeminiSession(latestFile.filePath);
  const sessionId = session?.sessionId ?? path.basename(latestFile.filePath, '.json');

  return {
    sessionId,
    lastModified: latestFile.mtimeMs,
    fileSize: latestFile.size,
    cwd: projectPath,
    firstUserMessage:
      session?.messages?.[0]?.type === 'user' ? session.messages[0].content : undefined,
    hasData: (session?.messages?.length ?? 0) > 0,
  };
}

export function getAllGeminiProjects(): ClaudeProjectInfo[] {
  const baseDir = getGeminiBaseDir();
  if (!fs.existsSync(baseDir)) return [];

  const projectMap = new Map<string, ClaudeSessionInfo[]>();

  try {
    const projectDirs = fs
      .readdirSync(baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const projDir of projectDirs) {
      const projPath = path.join(baseDir, projDir.name);
      const chatsDir = path.join(projPath, 'chats');
      if (!fs.existsSync(chatsDir)) continue;

      const projectRoot = resolveProjectRoot(projPath);

      try {
        const sessionFiles = fs.readdirSync(chatsDir).filter((f) => f.endsWith('.json'));

        for (const sessionFile of sessionFiles) {
          const filePath = path.join(chatsDir, sessionFile);
          const stats = fs.statSync(filePath);
          const session = parseGeminiSession(filePath);
          if (!session) continue;

          const sessionId = session.sessionId ?? path.basename(sessionFile, '.json');
          const sessionInfo: ClaudeSessionInfo = {
            sessionId,
            filePath,
            fileSize: stats.size,
            lastModified: session.lastUpdated
              ? new Date(session.lastUpdated).getTime()
              : stats.mtimeMs,
            cwd: projectRoot,
            hasData: (session.messages?.length ?? 0) > 0,
          };

          const existing = projectMap.get(projectRoot) ?? [];
          existing.push(sessionInfo);
          projectMap.set(projectRoot, existing);
        }
      } catch {
        // skip unreadable chats dir
      }
    }
  } catch {
    // base dir read error
  }

  return Array.from(projectMap.entries())
    .map(([projectPath, sessions]) => ({
      projectPath,
      projectDirName: path.basename(projectPath),
      claudeProjectDir: baseDir,
      sessions: sessions.sort((a, b) => b.lastModified - a.lastModified),
    }))
    .sort((a, b) => {
      const aLatest = Math.max(...a.sessions.map((s) => s.lastModified));
      const bLatest = Math.max(...b.sessions.map((s) => s.lastModified));
      return bLatest - aLatest;
    });
}

export function getAllGeminiProjectsPaginated(
  page = 0,
  pageSize = 10,
  onProgress?: ProgressCallback,
): { projects: ClaudeProjectInfo[]; total: number; hasMore: boolean } {
  onProgress?.({ phase: 'scanning', message: 'Loading Gemini projects...' });
  const all = getAllGeminiProjects();
  onProgress?.({ phase: 'done', message: 'Done' });
  const start = page * pageSize;
  const end = start + pageSize;
  return {
    projects: all.slice(start, end),
    total: all.length,
    hasMore: end < all.length,
  };
}

export function getGeminiProjectSessions(projectPath: string): ClaudeSessionInfo[] {
  const all = getAllGeminiProjects();
  const project = all.find((p) => p.projectPath === projectPath);
  return project?.sessions ?? [];
}

export function getGeminiProjectSessionsPaginated(
  projectPath: string,
  page = 0,
  pageSize = 20,
): {
  sessions: Omit<ClaudeSessionInfo, 'cwd' | 'firstUserMessage' | 'hasData'>[];
  total: number;
  hasMore: boolean;
} {
  const sessions = getGeminiProjectSessions(projectPath);
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

export function readGeminiSessionLog(projectPath: string, sessionId: string): ClaudeSessionEntry[] {
  const sessions = getGeminiProjectSessions(projectPath);
  const target = sessions.find((session) => session.sessionId === sessionId);
  if (target?.filePath) {
    const session = parseGeminiSession(target.filePath);
    return (session?.messages ?? []).map((msg) => ({
      type: msg.type === 'user' ? 'human' : 'assistant',
      content: msg.content,
      timestamp: msg.timestamp,
    }));
  }

  // Fallback for stale cache: rescan and match by project root + sessionId.
  const baseDir = getGeminiBaseDir();
  if (!fs.existsSync(baseDir)) return [];
  try {
    const projectDirs = fs
      .readdirSync(baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const projDir of projectDirs) {
      const projPath = path.join(baseDir, projDir.name);
      const chatsDir = path.join(projPath, 'chats');
      if (!fs.existsSync(chatsDir)) continue;
      if (resolveProjectRoot(projPath) !== projectPath) continue;

      const sessionFiles = fs.readdirSync(chatsDir).filter((f) => f.endsWith('.json'));
      for (const file of sessionFiles) {
        const filePath = path.join(chatsDir, file);
        const session = parseGeminiSession(filePath);
        const sid = session?.sessionId ?? path.basename(file, '.json');
        if (sid !== sessionId) continue;

        // Convert Gemini messages to ClaudeSessionEntry format
        return (session?.messages ?? []).map((msg) => ({
          type: msg.type === 'user' ? 'human' : 'assistant',
          content: msg.content,
          timestamp: msg.timestamp,
        }));
      }
    }
  } catch {
    // ignore
  }
  return [];
}
