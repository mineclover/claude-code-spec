/**
 * Application Logger
 *
 * Structured, level-based logging system with multiple transports.
 * Replaces scattered console.log/error/warn calls with consistent logging.
 */

import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// Types
// ============================================================================

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  module: string;
  sessionId?: string;
  executionId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  levelName: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// ============================================================================
// Transport Interface
// ============================================================================

export interface LogTransport {
  /**
   * Write a log entry
   */
  write(entry: LogEntry): void;

  /**
   * Flush any buffered logs
   */
  flush?(): void;

  /**
   * Close the transport (cleanup)
   */
  close?(): void;
}

// ============================================================================
// Console Transport
// ============================================================================

export class ConsoleTransport implements LogTransport {
  private colors = {
    [LogLevel.DEBUG]: '\x1b[36m', // Cyan
    [LogLevel.INFO]: '\x1b[32m',  // Green
    [LogLevel.WARN]: '\x1b[33m',  // Yellow
    [LogLevel.ERROR]: '\x1b[31m', // Red
  };
  private reset = '\x1b[0m';

  constructor(private useColors = true) {}

  write(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const color = this.useColors ? this.colors[entry.level] : '';
    const reset = this.useColors ? this.reset : '';

    let contextStr = '';
    if (entry.context) {
      const { module, ...rest } = entry.context;
      contextStr = module ? `[${module}]` : '';
      if (Object.keys(rest).length > 0) {
        contextStr += ` ${JSON.stringify(rest)}`;
      }
    }

    const logLine = `${timestamp} ${color}${entry.levelName}${reset} ${contextStr} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(logLine);
        if (entry.error?.stack) {
          console.error(entry.error.stack);
        }
        break;
      case LogLevel.WARN:
        console.warn(logLine);
        break;
      default:
        console.log(logLine);
    }
  }
}

// ============================================================================
// File Transport
// ============================================================================

export interface FileTransportOptions {
  logDir: string;
  filename?: string;
  maxFileSize?: number; // in bytes
  maxFiles?: number;
}

export class FileTransport implements LogTransport {
  private logDir: string;
  private filename: string;
  private maxFileSize: number;
  private maxFiles: number;
  private currentStream: fs.WriteStream | null = null;
  private currentFilePath: string | null = null;
  private currentFileSize = 0;

  constructor(options: FileTransportOptions) {
    this.logDir = options.logDir;
    this.filename = options.filename || 'app.log';
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;

    this.ensureLogDirectory();
    this.openLogFile();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private openLogFile(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentFilePath = path.join(this.logDir, `${timestamp}-${this.filename}`);
    this.currentStream = fs.createWriteStream(this.currentFilePath, { flags: 'a' });
    this.currentFileSize = 0;
  }

  private rotateIfNeeded(): void {
    if (this.currentFileSize >= this.maxFileSize) {
      this.close();
      this.openLogFile();
      this.cleanupOldFiles();
    }
  }

  private cleanupOldFiles(): void {
    try {
      const files = fs
        .readdirSync(this.logDir)
        .filter((file) => file.endsWith(this.filename))
        .map((file) => ({
          name: file,
          path: path.join(this.logDir, file),
          time: fs.statSync(path.join(this.logDir, file)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > this.maxFiles) {
        const filesToDelete = files.slice(this.maxFiles);
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
        }
      }
    } catch (error) {
      console.error('[FileTransport] Failed to cleanup old files:', error);
    }
  }

  write(entry: LogEntry): void {
    if (!this.currentStream) {
      return;
    }

    const logLine = JSON.stringify(entry) + '\n';
    const written = this.currentStream.write(logLine);

    if (written) {
      this.currentFileSize += Buffer.byteLength(logLine);
      this.rotateIfNeeded();
    }
  }

  flush(): void {
    if (this.currentStream) {
      this.currentStream.end();
    }
  }

  close(): void {
    if (this.currentStream) {
      this.currentStream.end();
      this.currentStream = null;
    }
  }
}

// ============================================================================
// AppLogger
// ============================================================================

export interface AppLoggerOptions {
  level?: LogLevel;
  transports?: LogTransport[];
}

export class AppLogger {
  private level: LogLevel;
  private transports: LogTransport[];

  constructor(options: AppLoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.transports = options.transports ?? [new ConsoleTransport()];
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Add a transport
   */
  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  /**
   * Remove all transports
   */
  clearTransports(): void {
    for (const transport of this.transports) {
      transport.close?.();
    }
    this.transports = [];
  }

  /**
   * Create a log entry
   */
  private createEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      levelName: LogLevel[level],
      message,
    };

    if (context) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  /**
   * Log at a specific level
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (level < this.level) {
      return;
    }

    const entry = this.createEntry(level, message, context, error);

    for (const transport of this.transports) {
      try {
        transport.write(entry);
      } catch (err) {
        console.error('[AppLogger] Transport write failed:', err);
      }
    }
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Flush all transports
   */
  flush(): void {
    for (const transport of this.transports) {
      transport.flush?.();
    }
  }

  /**
   * Close all transports
   */
  close(): void {
    for (const transport of this.transports) {
      transport.close?.();
    }
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Parse log level from string
 */
export function parseLogLevel(level: string): LogLevel {
  const normalized = level.toUpperCase();
  switch (normalized) {
    case 'DEBUG':
      return LogLevel.DEBUG;
    case 'INFO':
      return LogLevel.INFO;
    case 'WARN':
    case 'WARNING':
      return LogLevel.WARN;
    case 'ERROR':
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
}
