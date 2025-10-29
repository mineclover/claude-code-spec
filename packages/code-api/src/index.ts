/**
 * @context-action/code-api
 * Claude Code CLI Client Library
 */

// Client
export { ClaudeClient } from './client/ClaudeClient';
export type { ClaudeClientOptions } from './client/ClaudeClient';

// Parser
export { StreamParser } from './parser/StreamParser';
export type {
  StreamEvent,
  SystemInitEvent,
  UserEvent,
  AssistantEvent,
  ResultEvent,
  ErrorEvent
} from './parser/types';
export {
  isSystemInitEvent,
  isUserEvent,
  isAssistantEvent,
  isResultEvent,
  isErrorEvent,
  extractTextFromMessage,
  extractToolUsesFromMessage,
  extractSessionId
} from './parser/types';

// Session
export { SessionManager } from './session/SessionManager';
export type { SessionInfo } from './session/SessionManager';

// Process
export { ProcessManager, processManager } from './process/ProcessManager';
export type {
  ExecutionInfo,
  ExecutionStatus,
  StartExecutionParams
} from './process/ProcessManager';

// Query
export { ClaudeQueryAPI } from './query/ClaudeQueryAPI';
export type {
  QueryOptions,
  QueryResult
} from './query/ClaudeQueryAPI';

// Schema
export {
  zodSchemaToPrompt,
  validateWithZod,
  validateWithStandardSchema,
  CommonSchemas
} from './schema/zodSchemaBuilder';
export type { StandardSchemaV1 } from './schema/zodSchemaBuilder';

export {
  buildSchemaPrompt,
  validateAgainstSchema
} from './schema/schemaBuilder';
export type { JSONSchema } from './schema/schemaBuilder';

export {
  extractJSON,
  extractAndValidate
} from './schema/jsonExtractor';
export type { JSONExtractionResult } from './schema/jsonExtractor';

// Errors
export {
  ProcessStartError,
  ProcessKillError,
  ExecutionNotFoundError,
  MaxConcurrentError,
  ValidationError
} from './errors/errors';

// Entry Point System
export {
  EntryPointManager,
  SchemaManager,
  EntryPointExecutor
} from './entrypoint';
export type {
  EntryPointConfig,
  EntryPointsConfig,
  ExecuteEntryPointParams,
  EntryPointResult,
  SchemaDefinition,
  OutputFormat,
  ValidationResult,
  EntryPointDetail
} from './entrypoint';
