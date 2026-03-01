/**
 * ClaudeQueryAPI - API-style query executor using ai-sdk-cli
 *
 * Migrated from CLI spawn to SDK-based implementation
 *
 * Features:
 * - Uses @anthropic-ai/claude-agent-sdk via ai-sdk-cli
 * - Structured output with JSON schema validation
 * - cwd validation for security
 * - MCP server configuration support
 */

import {
  createClaudeAgent,
  type ClaudeAgent,
  type ClaudeAgentConfig,
  type JSONSchema,
  Schema,
  processStream,
  ClaudeAgentError,
  StructuredOutputError,
} from '@packages/ai-sdk-cli';
import { appLogger } from '../main/app-context';

export interface QueryOptions {
  /**
   * Output style to force (e.g., 'structured-json', 'default', 'explanatory')
   * @deprecated Use structured output instead
   */
  outputStyle?: string;

  /**
   * Model to use
   */
  model?: 'sonnet' | 'opus' | 'haiku' | 'claude-sonnet-4-5' | 'claude-opus-4' | 'claude-haiku-3-5';

  /**
   * MCP config path (for CLI compatibility)
   * @deprecated Use mcpServers config object instead
   */
  mcpConfig?: string;

  /**
   * Filter thinking blocks from response
   */
  filterThinking?: boolean;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;

  /**
   * System prompt
   */
  systemPrompt?: string;

  /**
   * MCP servers configuration (SDK native)
   */
  mcpServers?: ClaudeAgentConfig['mcpServers'];

  /**
   * Only use specified MCP servers
   */
  strictMcpConfig?: boolean;

  /**
   * Tools to disallow
   */
  disallowedTools?: string[];
}

export interface QueryResult {
  /**
   * Final result text
   */
  result: string;

  /**
   * All assistant messages
   */
  messages: string[];

  /**
   * Raw events (for debugging) - simplified for SDK
   */
  events: StreamEvent[];

  /**
   * Execution metadata
   */
  metadata: {
    totalCost: number;
    durationMs: number;
    numTurns: number;
    outputStyle?: string;
    inputTokens?: number;
    outputTokens?: number;
  };

  /**
   * Session ID for resume/fork
   */
  sessionId?: string;

  /**
   * Structured output (if schema provided)
   */
  structuredOutput?: unknown;
}

interface StreamEvent {
  type: string;
  subtype?: string;
  [key: string]: unknown;
}

export interface JSONExtractionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  raw?: string;
  cleanedText?: string;
}

/**
 * Model name mapping
 */
function mapModelName(
  model?: string,
): 'claude-sonnet-4-5' | 'claude-opus-4-5' | 'claude-haiku-3-5' | undefined {
  if (!model) return undefined;

  const modelMap: Record<string, 'claude-sonnet-4-5' | 'claude-opus-4-5' | 'claude-haiku-3-5'> = {
    sonnet: 'claude-sonnet-4-5',
    opus: 'claude-opus-4-5',
    haiku: 'claude-haiku-3-5',
    'claude-sonnet-4-5': 'claude-sonnet-4-5',
    'claude-opus-4-5': 'claude-opus-4-5',
    'claude-haiku-3-5': 'claude-haiku-3-5',
  };

  return modelMap[model];
}

export class ClaudeQueryAPI {
  private currentAgent: ClaudeAgent | null = null;
  private abortController: AbortController | null = null;

  /**
   * Execute a query and get results
   */
  async query(projectPath: string, query: string, options: QueryOptions = {}): Promise<QueryResult> {
    const {
      model,
      filterThinking = true,
      timeout = 120000,
      systemPrompt,
      mcpServers,
      strictMcpConfig,
      disallowedTools,
      outputStyle,
    } = options;

    appLogger.info('Executing query with ClaudeQueryAPI (SDK)', {
      module: 'ClaudeQueryAPI',
      projectPath,
      model,
      filterThinking,
    });

    const startTime = Date.now();

    try {
      // Create agent
      const agent = createClaudeAgent({
        cwd: projectPath,
        model: mapModelName(model),
        permissionMode: 'bypassPermissions',
        systemPrompt,
        mcpServers,
        strictMcpConfig,
        disallowedTools,
      });

      this.currentAgent = agent;
      this.abortController = new AbortController();

      // Set timeout
      const timeoutId = setTimeout(() => {
        this.abortController?.abort();
      }, timeout);

      // Build query with output style hint if provided
      const enhancedQuery = outputStyle ? `/output-style ${outputStyle}\n\n${query}` : query;

      // Execute query
      const result = await agent.query(enhancedQuery, {
        abortController: this.abortController,
      });

      clearTimeout(timeoutId);

      const durationMs = Date.now() - startTime;

      // Build response
      const response: QueryResult = {
        result: result.text || '',
        messages: result.text ? [result.text] : [],
        events: [],
        metadata: {
          totalCost: 0, // SDK doesn't expose cost directly
          durationMs,
          numTurns: 1,
          outputStyle,
          inputTokens: result.usage?.inputTokens,
          outputTokens: result.usage?.outputTokens,
        },
        sessionId: result.sessionId,
        structuredOutput: result.structuredOutput,
      };

      appLogger.info('Query completed successfully', {
        module: 'ClaudeQueryAPI',
        durationMs,
        sessionId: result.sessionId,
      });

      return response;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      appLogger.error('Query failed', error instanceof Error ? error : undefined, {
        module: 'ClaudeQueryAPI',
        durationMs,
      });

      throw error;
    } finally {
      this.currentAgent = null;
      this.abortController = null;
    }
  }

  /**
   * Execute query and extract JSON result
   */
  async queryJSON<T = unknown>(
    projectPath: string,
    query: string,
    options: Omit<QueryOptions, 'outputStyle' | 'filterThinking'> & {
      requiredFields?: (keyof T)[];
    } = {},
  ): Promise<JSONExtractionResult<T>> {
    appLogger.info('Executing JSON query', {
      module: 'ClaudeQueryAPI',
      projectPath,
    });

    try {
      const result = await this.query(projectPath, query, {
        ...options,
        outputStyle: 'structured-json',
        filterThinking: true,
      });

      // Try to extract JSON from result
      const jsonMatch = result.result.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : result.result;

      try {
        const data = JSON.parse(jsonStr) as T;
        return {
          success: true,
          data,
          raw: result.result,
        };
      } catch {
        return {
          success: false,
          error: 'Failed to parse JSON from response',
          raw: result.result,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute query with JSON schema for structured output
   */
  async queryWithSchema<T = unknown>(
    projectPath: string,
    instruction: string,
    schema: JSONSchema,
    options: Omit<QueryOptions, 'outputStyle' | 'filterThinking'> = {},
  ): Promise<JSONExtractionResult<T>> {
    const { model, timeout = 120000, systemPrompt, mcpServers, strictMcpConfig, disallowedTools } =
      options;

    appLogger.info('Executing query with schema (SDK native)', {
      module: 'ClaudeQueryAPI',
      projectPath,
    });

    const startTime = Date.now();

    try {
      const agent = createClaudeAgent({
        cwd: projectPath,
        model: mapModelName(model),
        permissionMode: 'bypassPermissions',
        systemPrompt,
        mcpServers,
        strictMcpConfig,
        disallowedTools,
      });

      this.currentAgent = agent;
      this.abortController = new AbortController();

      const timeoutId = setTimeout(() => {
        this.abortController?.abort();
      }, timeout);

      // Use SDK's native structured output
      const data = await agent.queryStructured<T>(instruction, schema, 'response');

      clearTimeout(timeoutId);

      const durationMs = Date.now() - startTime;

      appLogger.info('Schema query successful', {
        module: 'ClaudeQueryAPI',
        durationMs,
      });

      return {
        success: true,
        data,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      appLogger.error('Schema query failed', error instanceof Error ? error : undefined, {
        module: 'ClaudeQueryAPI',
        durationMs,
      });

      if (error instanceof StructuredOutputError) {
        return {
          success: false,
          error: `Structured output error: ${error.message}`,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.currentAgent = null;
      this.abortController = null;
    }
  }

  /**
   * Execute query with Zod schema validation
   */
  async queryWithZod<T>(
    projectPath: string,
    instruction: string,
    zodSchema: import('zod').ZodType<T>,
    options: Omit<QueryOptions, 'outputStyle' | 'filterThinking'> = {},
  ): Promise<JSONExtractionResult<T>> {
    appLogger.info('Executing query with Zod schema', {
      module: 'ClaudeQueryAPI',
      projectPath,
    });

    try {
      // Convert Zod schema to JSON Schema
      const jsonSchema = this.zodToJsonSchema(zodSchema);

      // Use queryWithSchema
      const result = await this.queryWithSchema<T>(projectPath, instruction, jsonSchema, options);

      if (!result.success) {
        return result;
      }

      // Validate with Zod
      const parsed = zodSchema.safeParse(result.data);

      if (!parsed.success) {
        return {
          success: false,
          error: `Zod validation failed: ${parsed.error.message}`,
          raw: JSON.stringify(result.data),
        };
      }

      return {
        success: true,
        data: parsed.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Convert Zod schema to JSON Schema (basic implementation)
   */
  private zodToJsonSchema(zodSchema: import('zod').ZodType): JSONSchema {
    // Basic conversion - for complex schemas, use a dedicated library
    const schema: JSONSchema = { type: 'object' };

    if ('shape' in zodSchema._def) {
      const shape = zodSchema._def.shape as Record<string, import('zod').ZodType>;
      schema.properties = {};

      for (const [key, value] of Object.entries(shape)) {
        schema.properties[key] = this.zodTypeToJsonSchema(value);
      }
    }

    return schema;
  }

  private zodTypeToJsonSchema(zodType: import('zod').ZodType): JSONSchema {
    const typeName = zodType._def.typeName;

    switch (typeName) {
      case 'ZodString':
        return { type: 'string' };
      case 'ZodNumber':
        return { type: 'number' };
      case 'ZodBoolean':
        return { type: 'boolean' };
      case 'ZodArray':
        return {
          type: 'array',
          items: this.zodTypeToJsonSchema(zodType._def.type),
        };
      case 'ZodObject':
        return this.zodToJsonSchema(zodType);
      default:
        return {};
    }
  }

  /**
   * Kill running query
   */
  kill(): void {
    if (this.abortController) {
      appLogger.info('Aborting running query', {
        module: 'ClaudeQueryAPI',
      });
      this.abortController.abort();
    }
  }

  /**
   * Stream query results
   */
  async *stream(
    projectPath: string,
    query: string,
    options: QueryOptions = {},
  ): AsyncGenerator<StreamEvent> {
    const { model, systemPrompt, mcpServers, strictMcpConfig, disallowedTools, outputStyle } =
      options;

    const agent = createClaudeAgent({
      cwd: projectPath,
      model: mapModelName(model),
      permissionMode: 'bypassPermissions',
      systemPrompt,
      mcpServers,
      strictMcpConfig,
      disallowedTools,
    });

    const enhancedQuery = outputStyle ? `/output-style ${outputStyle}\n\n${query}` : query;

    for await (const message of agent.stream(enhancedQuery)) {
      yield message as StreamEvent;
    }
  }
}

// Re-export Schema builder from ai-sdk-cli
export { Schema };
export type { JSONSchema };
