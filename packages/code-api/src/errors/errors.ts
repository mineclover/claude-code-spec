/**
 * Error class hierarchy for the application
 *
 * Provides structured error types for better error handling and debugging.
 * All custom errors extend AppError with specific codes and contexts.
 */

// ============================================================================
// Base Error
// ============================================================================

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

// ============================================================================
// Execution Errors
// ============================================================================

export class ExecutionError extends AppError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, context);
    this.name = 'ExecutionError';
  }
}

export class ProcessStartError extends ExecutionError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'PROCESS_START_FAILED', context);
    this.name = 'ProcessStartError';
  }
}

export class ProcessKillError extends ExecutionError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'PROCESS_KILL_FAILED', context);
    this.name = 'ProcessKillError';
  }
}

export class SessionIdTimeoutError extends ExecutionError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SESSION_ID_TIMEOUT', context);
    this.name = 'SessionIdTimeoutError';
  }
}

export class MaxConcurrentError extends ExecutionError {
  constructor(maxConcurrent: number, context?: Record<string, unknown>) {
    super(
      `Maximum concurrent executions (${maxConcurrent}) reached`,
      'MAX_CONCURRENT_REACHED',
      { maxConcurrent, ...context },
    );
    this.name = 'MaxConcurrentError';
  }
}

export class ExecutionNotFoundError extends ExecutionError {
  constructor(sessionId: string, context?: Record<string, unknown>) {
    super(`Execution not found: ${sessionId}`, 'EXECUTION_NOT_FOUND', {
      sessionId,
      ...context,
    });
    this.name = 'ExecutionNotFoundError';
  }
}

// ============================================================================
// Parsing Errors
// ============================================================================

export class ParsingError extends AppError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, context);
    this.name = 'ParsingError';
  }
}

export class JSONParseError extends ParsingError {
  constructor(line: string, cause?: Error, context?: Record<string, unknown>) {
    super(`Failed to parse JSON: ${line.substring(0, 100)}`, 'JSON_PARSE_ERROR', {
      line: line.substring(0, 200),
      cause: cause?.message,
      ...context,
    });
    this.name = 'JSONParseError';
  }
}

export class SchemaValidationError extends ParsingError {
  constructor(line: string, parsed: unknown, context?: Record<string, unknown>) {
    super(`Schema validation failed: ${line.substring(0, 100)}`, 'SCHEMA_VALIDATION_ERROR', {
      line: line.substring(0, 200),
      parsed,
      ...context,
    });
    this.name = 'SchemaValidationError';
  }
}

// ============================================================================
// Configuration Errors
// ============================================================================

export class ConfigError extends AppError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, context);
    this.name = 'ConfigError';
  }
}

export class InvalidConfigError extends ConfigError {
  constructor(configPath: string, reason: string, context?: Record<string, unknown>) {
    super(`Invalid configuration at ${configPath}: ${reason}`, 'INVALID_CONFIG', {
      configPath,
      reason,
      ...context,
    });
    this.name = 'InvalidConfigError';
  }
}

export class ConfigNotFoundError extends ConfigError {
  constructor(configPath: string, context?: Record<string, unknown>) {
    super(`Configuration not found: ${configPath}`, 'CONFIG_NOT_FOUND', {
      configPath,
      ...context,
    });
    this.name = 'ConfigNotFoundError';
  }
}

// ============================================================================
// File System Errors
// ============================================================================

export class FileSystemError extends AppError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, context);
    this.name = 'FileSystemError';
  }
}

export class FileNotFoundError extends FileSystemError {
  constructor(filePath: string, context?: Record<string, unknown>) {
    super(`File not found: ${filePath}`, 'FILE_NOT_FOUND', {
      filePath,
      ...context,
    });
    this.name = 'FileNotFoundError';
  }
}

export class FileReadError extends FileSystemError {
  constructor(filePath: string, cause?: Error, context?: Record<string, unknown>) {
    super(`Failed to read file: ${filePath}`, 'FILE_READ_ERROR', {
      filePath,
      cause: cause?.message,
      ...context,
    });
    this.name = 'FileReadError';
  }
}

export class FileWriteError extends FileSystemError {
  constructor(filePath: string, cause?: Error, context?: Record<string, unknown>) {
    super(`Failed to write file: ${filePath}`, 'FILE_WRITE_ERROR', {
      filePath,
      cause: cause?.message,
      ...context,
    });
    this.name = 'FileWriteError';
  }
}

// ============================================================================
// Network Errors
// ============================================================================

export class NetworkError extends AppError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, context);
    this.name = 'NetworkError';
  }
}

export class APIError extends NetworkError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    context?: Record<string, unknown>,
  ) {
    super(message, 'API_ERROR', { statusCode, ...context });
    this.name = 'APIError';
  }
}

export class TimeoutError extends NetworkError {
  constructor(message: string, timeoutMs: number, context?: Record<string, unknown>) {
    super(message, 'TIMEOUT', { timeoutMs, ...context });
    this.name = 'TimeoutError';
  }
}

// ============================================================================
// Validation Errors
// ============================================================================

export class ValidationError extends AppError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, context);
    this.name = 'ValidationError';
  }
}

export class InvalidInputError extends ValidationError {
  constructor(field: string, reason: string, context?: Record<string, unknown>) {
    super(`Invalid input for ${field}: ${reason}`, 'INVALID_INPUT', {
      field,
      reason,
      ...context,
    });
    this.name = 'InvalidInputError';
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Check if an error is a specific error type
 */
export function isErrorType<T extends AppError>(
  error: unknown,
  ErrorClass: new (...args: never[]) => T,
): error is T {
  return error instanceof ErrorClass;
}

/**
 * Convert any error to AppError
 */
export function toAppError(error: unknown, code = 'UNKNOWN_ERROR'): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, code, {
      originalName: error.name,
      stack: error.stack,
    });
  }

  return new AppError(String(error), code);
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Extract error code from AppError or return default
 */
export function getErrorCode(error: unknown, defaultCode = 'UNKNOWN_ERROR'): string {
  if (isAppError(error)) {
    return error.code;
  }
  return defaultCode;
}
