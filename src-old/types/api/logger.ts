import type { LogEntry } from '../../services/logger';

export interface LoggerAPI {
  // Get list of log files
  getLogFiles: () => Promise<string[]>;

  // Read log entries from a file
  readLogFile: (filePath: string) => Promise<LogEntry[]>;

  // Analyze event patterns
  analyzePatterns: (filePath: string) => Promise<Record<string, number>>;

  // Export logs as JSON
  exportJSON: (filePath: string, outputPath: string) => Promise<{ success: boolean }>;

  // Rotate (clean up) old log files
  rotateLogs: () => Promise<{ success: boolean }>;

  // Get log file path for session
  getSessionLog: (sessionId: string) => Promise<string | null>;

  // Read session log entries
  readSessionLog: (sessionId: string) => Promise<LogEntry[]>;
}
