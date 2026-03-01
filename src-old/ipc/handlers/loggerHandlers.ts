/**
 * Logger IPC Handlers
 * Handles log file operations
 */

import {
  analyzeLogFile,
  exportLogsAsJSON,
  getLogFileForSession,
  getLogFiles,
  type LoggerConfig,
  readLogFile,
  rotateLogFiles,
} from '../../services/logger';
import type { IPCRouter } from '../IPCRouter';

export function registerLoggerHandlers(router: IPCRouter, loggerConfig: LoggerConfig): void {
  // Get all log files
  router.handle('get-files', async () => {
    return getLogFiles(loggerConfig);
  });

  // Read log file
  router.handle('read-file', async (_event, filePath: string) => {
    return readLogFile(filePath);
  });

  // Analyze log patterns
  router.handle('analyze-patterns', async (_event, filePath: string) => {
    return analyzeLogFile(filePath);
  });

  // Export logs as JSON
  router.handle('export-json', async (_event, filePath: string, outputPath: string) => {
    exportLogsAsJSON(filePath, outputPath);
    return { success: true };
  });

  // Rotate log files
  router.handle('rotate', async () => {
    rotateLogFiles(loggerConfig);
    return { success: true };
  });

  // Get log file for session
  router.handle('get-session-log', async (_event, sessionId: string) => {
    return getLogFileForSession(loggerConfig, sessionId);
  });

  // Read session log entries
  router.handle('read-session-log', async (_event, sessionId: string) => {
    const logFile = getLogFileForSession(loggerConfig, sessionId);
    if (!logFile) {
      return [];
    }
    return readLogFile(logFile);
  });
}
