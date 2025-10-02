/**
 * Claude Sessions IPC Handlers
 * Handles all Claude CLI session data queries
 */

import { shell } from 'electron';
import {
  getAllClaudeProjects,
  getAllClaudeProjectsPaginated,
  getClaudeProjectsDir,
  getProjectSessionCount,
  getProjectSessions,
  getProjectSessionsBasic,
  getProjectSessionsPaginated,
  getSessionMetadata,
  getSessionPreview,
  getSessionSummary,
  getTotalProjectCount,
  readSessionLog,
} from '../../services/claudeSessions';
import type { IPCRouter } from '../IPCRouter';

export function registerClaudeSessionsHandlers(router: IPCRouter): void {
  // Get all projects
  router.handle('get-all-projects', async () => {
    return getAllClaudeProjects();
  });

  // Get total project count
  router.handle('get-total-count', async () => {
    return getTotalProjectCount();
  });

  // Get paginated projects
  router.handle('get-all-projects-paginated', async (_event, page: number, pageSize: number) => {
    return getAllClaudeProjectsPaginated(page, pageSize);
  });

  // Get project sessions
  router.handle('get-project-sessions', async (_event, projectPath: string) => {
    return getProjectSessions(projectPath);
  });

  // Get project sessions (basic info)
  router.handle('get-project-sessions-basic', async (_event, projectPath: string) => {
    return getProjectSessionsBasic(projectPath);
  });

  // Get session metadata
  router.handle('get-session-metadata', async (_event, projectPath: string, sessionId: string) => {
    return getSessionMetadata(projectPath, sessionId);
  });

  // Get paginated sessions
  router.handle(
    'get-paginated',
    async (_event, projectPath: string, page: number, pageSize: number) => {
      return getProjectSessionsPaginated(projectPath, page, pageSize);
    },
  );

  // Get session count
  router.handle('get-count', async (_event, projectPath: string) => {
    return getProjectSessionCount(projectPath);
  });

  // Read session log
  router.handle('read-log', async (_event, projectPath: string, sessionId: string) => {
    return readSessionLog(projectPath, sessionId);
  });

  // Get session summary
  router.handle('get-summary', async (_event, projectPath: string, sessionId: string) => {
    return getSessionSummary(projectPath, sessionId);
  });

  // Get session preview
  router.handle('get-preview', async (_event, projectPath: string, sessionId: string) => {
    return getSessionPreview(projectPath, sessionId);
  });

  // Open logs folder in system file explorer
  router.handle('open-logs-folder', async () => {
    const logsDir = getClaudeProjectsDir();
    await shell.openPath(logsDir);
  });

  // Open project folder in system file explorer
  router.handle('open-project-folder', async (_event, projectPath: string) => {
    await shell.openPath(projectPath);
  });
}
