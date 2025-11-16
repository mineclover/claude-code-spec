/**
 * @context-action/code-api
 * Claude Code CLI Client Library
 */

export type { ClaudeClientOptions } from './client/ClaudeClient';
// Client
export { ClaudeClient } from './client/ClaudeClient';
export type {
  EntryPointConfig,
  EntryPointDetail,
  EntryPointResult,
  EntryPointsConfig,
  ExecuteEntryPointParams,
  OutputFormat,
  SchemaDefinition,
  SystemPromptConfig,
  ValidationResult,
} from './entrypoint';
// Entry Point System
export {
  EntryPointExecutor,
  EntryPointManager,
  SchemaManager,
} from './entrypoint';
// Errors
export {
  ExecutionNotFoundError,
  MaxConcurrentError,
  ProcessKillError,
  ProcessStartError,
  ValidationError,
} from './errors/errors';
// Parser
export { StreamParser } from './parser/StreamParser';
export type {
  AssistantEvent,
  ErrorEvent,
  ResultEvent,
  StreamEvent,
  SystemInitEvent,
  UserEvent,
} from './parser/types';
export {
  extractSessionId,
  extractTextFromMessage,
  extractToolUsesFromMessage,
  isAssistantEvent,
  isErrorEvent,
  isResultEvent,
  isSystemInitEvent,
  isUserEvent,
} from './parser/types';
export type {
  ExecutionInfo,
  ExecutionStatus,
  ProcessManagerOptions,
  StartExecutionParams,
} from './process/ProcessManager';
// Process
export { ProcessManager, processManager } from './process/ProcessManager';
export type {
  QueryOptions,
  QueryResult,
} from './query/ClaudeQueryAPI';
// Query
export { ClaudeQueryAPI } from './query/ClaudeQueryAPI';
export type { JSONExtractionResult } from './schema/jsonExtractor';
export {
  extractAndValidate,
  extractJSON,
} from './schema/jsonExtractor';
export type { JSONSchema } from './schema/schemaBuilder';
export {
  buildSchemaPrompt,
  validateAgainstSchema,
} from './schema/schemaBuilder';
export type { StandardSchemaV1 } from './schema/zodSchemaBuilder';
// Schema
export {
  CommonSchemas,
  validateWithStandardSchema,
  validateWithZod,
  zodSchemaToPrompt,
} from './schema/zodSchemaBuilder';
export type { SessionInfo } from './session/SessionManager';
// Session
export { SessionManager } from './session/SessionManager';
