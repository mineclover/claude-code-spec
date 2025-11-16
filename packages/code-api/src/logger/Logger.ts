/**
 * Structured logging system for code-api
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  module?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
}

/**
 * Default console logger with structured output
 */
export class ConsoleLogger implements Logger {
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = 'info') {
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const minIndex = levels.indexOf(this.minLevel);
    const currentIndex = levels.indexOf(level);
    return currentIndex >= minIndex;
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext, error?: Error): string {
    const timestamp = new Date().toISOString();
    const base = {
      timestamp,
      level,
      message,
      ...context,
    };

    if (error) {
      return JSON.stringify({
        ...base,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      });
    }

    return JSON.stringify(base);
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatLog('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.log(this.formatLog('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatLog('warn', message, context));
    }
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (this.shouldLog('error')) {
      console.error(this.formatLog('error', message, context, error));
    }
  }
}

/**
 * Silent logger for testing
 */
export class SilentLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

/**
 * Default logger instance
 */
export const defaultLogger: Logger = new ConsoleLogger(
  (process.env.LOG_LEVEL as LogLevel) || 'info'
);
