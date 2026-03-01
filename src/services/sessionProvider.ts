/**
 * Session Provider - dispatches to the correct session service by toolId
 */

import type { ClaudeProjectInfo, ClaudeSessionEntry, ClaudeSessionInfo, LatestSessionMeta, ProjectFolder, SessionLoadProgress } from '../types/api/sessions';

export type ProgressCallback = (progress: SessionLoadProgress) => void;
import {
  getAllClaudeProjectsPaginated,
  getLatestClaudeSessionMeta,
  getProjectSessionsPaginated as getClaudeSessionsPaginated,
  listClaudeProjectFolders,
  readSessionLog as readClaudeSessionLog,
} from './claudeSessions';
import {
  getAllCodexProjectsPaginated,
  getCodexProjectSessionsPaginated,
  getLatestCodexSessionMeta,
  listCodexProjectFolders,
  readCodexSessionLog,
} from './codexSessions';
import {
  getAllGeminiProjectsPaginated,
  getGeminiProjectSessionsPaginated,
  getLatestGeminiSessionMeta,
  listGeminiProjectFolders,
  readGeminiSessionLog,
} from './geminiSessions';

export interface SessionProvider {
  listProjectFolders(onProgress?: ProgressCallback): ProjectFolder[];
  getLatestSessionMeta(projectPath: string): LatestSessionMeta | null;
  getAllProjectsPaginated(page: number, pageSize: number, onProgress?: ProgressCallback): {
    projects: ClaudeProjectInfo[];
    total: number;
    hasMore: boolean;
  };
  getProjectSessionsPaginated(projectPath: string, page: number, pageSize: number): {
    sessions: Omit<ClaudeSessionInfo, 'cwd' | 'firstUserMessage' | 'hasData'>[];
    total: number;
    hasMore: boolean;
  };
  readSessionLog(projectPath: string, sessionId: string): ClaudeSessionEntry[];
}

const claudeProvider: SessionProvider = {
  listProjectFolders: (onProgress?) => listClaudeProjectFolders(onProgress),
  getLatestSessionMeta: getLatestClaudeSessionMeta,
  getAllProjectsPaginated: (page, pageSize, onProgress?) => getAllClaudeProjectsPaginated(page, pageSize, onProgress),
  getProjectSessionsPaginated: getClaudeSessionsPaginated,
  readSessionLog: readClaudeSessionLog,
};

const codexProvider: SessionProvider = {
  listProjectFolders: (onProgress?) => listCodexProjectFolders(onProgress),
  getLatestSessionMeta: getLatestCodexSessionMeta,
  getAllProjectsPaginated: (page, pageSize, onProgress?) => getAllCodexProjectsPaginated(page, pageSize, onProgress),
  getProjectSessionsPaginated: getCodexProjectSessionsPaginated,
  readSessionLog: readCodexSessionLog,
};

const geminiProvider: SessionProvider = {
  listProjectFolders: (onProgress?) => listGeminiProjectFolders(onProgress),
  getLatestSessionMeta: getLatestGeminiSessionMeta,
  getAllProjectsPaginated: (page, pageSize, onProgress?) => getAllGeminiProjectsPaginated(page, pageSize, onProgress),
  getProjectSessionsPaginated: getGeminiProjectSessionsPaginated,
  readSessionLog: readGeminiSessionLog,
};

export function getSessionProvider(toolId: string): SessionProvider {
  switch (toolId) {
    case 'codex':
      return codexProvider;
    case 'gemini':
      return geminiProvider;
    default:
      return claudeProvider;
  }
}
