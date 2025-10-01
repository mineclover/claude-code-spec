/**
 * Functional logger for stream events
 *
 * Pure functions for logging stream events to JSONL files.
 * No classes, minimal state, composable functions.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { StreamEvent } from '../lib/types';

// ============================================================================
// Types
// ============================================================================

export interface LogEntry {
  timestamp: number;
  sessionId: string | null;
  eventType: string;
  event: StreamEvent;
}

export interface LoggerConfig {
  logDir: string;
  maxLogFiles: number;
  rotateOnSize: number;
}

export interface LoggerState {
  config: LoggerConfig;
  currentLogFile: string | null;
  writeStream: fs.WriteStream | null;
}

// ============================================================================
// Config
// ============================================================================

export const createDefaultConfig = (): LoggerConfig => ({
  logDir: path.join(process.cwd(), 'logs'),
  maxLogFiles: 10,
  rotateOnSize: 10 * 1024 * 1024, // 10MB
});

export const createConfig = (overrides?: Partial<LoggerConfig>): LoggerConfig => ({
  ...createDefaultConfig(),
  ...overrides,
});

// ============================================================================
// State Management
// ============================================================================

export const createLoggerState = (config: LoggerConfig): LoggerState => ({
  config,
  currentLogFile: null,
  writeStream: null,
});

// ============================================================================
// File System Operations
// ============================================================================

export const ensureLogDirectory = (config: LoggerConfig): void => {
  if (!fs.existsSync(config.logDir)) {
    fs.mkdirSync(config.logDir, { recursive: true });
  }
};

export const getLogFileName = (config: LoggerConfig, sessionId: string): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(config.logDir, `session-${sessionId}-${timestamp}.jsonl`);
};

export const getLogFiles = (config: LoggerConfig): string[] => {
  try {
    return fs
      .readdirSync(config.logDir)
      .filter((file) => file.endsWith('.jsonl'))
      .map((file) => path.join(config.logDir, file))
      .sort((a, b) => {
        const statA = fs.statSync(a);
        const statB = fs.statSync(b);
        return statB.mtime.getTime() - statA.mtime.getTime();
      });
  } catch (error) {
    console.error('[Logger] Failed to get log files:', error);
    return [];
  }
};

/**
 * Get log file path for a specific session ID
 */
export const getLogFileForSession = (config: LoggerConfig, sessionId: string): string | null => {
  try {
    const files = fs.readdirSync(config.logDir).filter((file) => file.includes(sessionId));

    if (files.length === 0) {
      return null;
    }

    // Return the most recent file if multiple exist
    const sorted = files
      .map((file) => path.join(config.logDir, file))
      .sort((a, b) => {
        const statA = fs.statSync(a);
        const statB = fs.statSync(b);
        return statB.mtime.getTime() - statA.mtime.getTime();
      });

    return sorted[0];
  } catch (error) {
    console.error('[Logger] Failed to get log file for session:', error);
    return null;
  }
};

// ============================================================================
// Stream Operations
// ============================================================================

export const openLogStream = (filePath: string): fs.WriteStream => {
  return fs.createWriteStream(filePath, { flags: 'a' });
};

export const closeLogStream = (stream: fs.WriteStream | null): void => {
  if (stream) {
    stream.end();
  }
};

export const writeLogEntry = (stream: fs.WriteStream, entry: LogEntry): boolean => {
  try {
    stream.write(`${JSON.stringify(entry)}\n`);
    return true;
  } catch (error) {
    console.error('[Logger] Failed to write log:', error);
    return false;
  }
};

// ============================================================================
// Log Entry Creation
// ============================================================================

export const createLogEntry = (event: StreamEvent, sessionId: string | null = null): LogEntry => ({
  timestamp: Date.now(),
  sessionId,
  eventType: event.type,
  event,
});

// ============================================================================
// Reading & Analysis
// ============================================================================

export const readLogFile = (filePath: string): LogEntry[] => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as LogEntry);
  } catch (error) {
    console.error('[Logger] Failed to read log file:', error);
    return [];
  }
};

export const analyzeEventPatterns = (entries: LogEntry[]): Record<string, number> => {
  return entries.reduce(
    (patterns, entry) => {
      patterns[entry.eventType] = (patterns[entry.eventType] || 0) + 1;
      return patterns;
    },
    {} as Record<string, number>,
  );
};

export const analyzeLogFile = (filePath: string): Record<string, number> => {
  const entries = readLogFile(filePath);
  return analyzeEventPatterns(entries);
};

// ============================================================================
// Log Management
// ============================================================================

export const rotateLogFiles = (config: LoggerConfig): void => {
  const files = getLogFiles(config);

  if (files.length > config.maxLogFiles) {
    const filesToDelete = files.slice(config.maxLogFiles);

    for (const file of filesToDelete) {
      try {
        fs.unlinkSync(file);
        console.log(`[Logger] Deleted old log file: ${file}`);
      } catch (error) {
        console.error(`[Logger] Failed to delete log file: ${file}`, error);
      }
    }
  }
};

export const exportLogsAsJSON = (filePath: string, outputPath: string): void => {
  const entries = readLogFile(filePath);
  fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2));
  console.log(`[Logger] Exported logs to: ${outputPath}`);
};

// ============================================================================
// Session Management (Stateful Closure)
// ============================================================================

export const createSessionLogger = (config: LoggerConfig) => {
  const state = createLoggerState(config);

  ensureLogDirectory(config);

  return {
    startSession: (sessionId: string): void => {
      // Close existing stream
      closeLogStream(state.writeStream);

      // Open new stream
      state.currentLogFile = getLogFileName(config, sessionId);
      state.writeStream = openLogStream(state.currentLogFile);

      console.log(`[Logger] Started logging session: ${sessionId}`);
    },

    logEvent: (event: StreamEvent, sessionId: string | null = null): void => {
      if (!state.writeStream) {
        console.warn('[Logger] No active log session');
        return;
      }

      const entry = createLogEntry(event, sessionId);
      writeLogEntry(state.writeStream, entry);
    },

    closeSession: (): void => {
      closeLogStream(state.writeStream);
      state.writeStream = null;
      console.log('[Logger] Closed logging session');
    },

    getState: () => ({ ...state }),
  };
};

// ============================================================================
// Export Type
// ============================================================================

export type SessionLogger = ReturnType<typeof createSessionLogger>;
