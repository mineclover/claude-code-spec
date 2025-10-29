/**
 * ClaudeQueryAPI - API-style query executor with output-style injection
 *
 * Features:
 * - Forces output-style for consistent formatting
 * - Filters thinking blocks for clean results
 * - Provides simple query() interface
 * - Returns structured responses
 * - JSON extraction and validation
 */

import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { extractAndValidate, extractJSON, type JSONExtractionResult } from '../lib/jsonExtractor';
import { buildSchemaPrompt, type JSONSchema, validateAgainstSchema } from '../lib/schemaBuilder';
import { appLogger } from '../main/app-context';

export interface QueryOptions {
  /**
   * Output style to force (e.g., 'structured-json', 'default', 'explanatory')
   */
  outputStyle?: string;

  /**
   * Model to use
   */
  model?: 'sonnet' | 'opus' | 'haiku';

  /**
   * MCP config path
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
}

export interface QueryResult {
  /**
   * Final result text (thinking filtered if requested)
   */
  result: string;

  /**
   * All assistant messages (thinking filtered if requested)
   */
  messages: string[];

  /**
   * Raw events (for debugging)
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
  };
}

interface StreamEvent {
  type: string;
  subtype?: string;
  [key: string]: any;
}

export class ClaudeQueryAPI {
  private runningProcess: ChildProcess | null = null;

  /**
   * Execute a query with output-style and get clean results
   */
  async query(
    projectPath: string,
    query: string,
    options: QueryOptions = {},
  ): Promise<QueryResult> {
    const { outputStyle, model, mcpConfig, filterThinking = true, timeout = 120000 } = options;

    appLogger.info('Executing query with ClaudeQueryAPI', {
      module: 'ClaudeQueryAPI',
      projectPath,
      outputStyle,
      model,
      filterThinking,
    });

    // Build enhanced query with output-style
    const enhancedQuery = this.buildQuery(query, outputStyle);

    // Execute
    const events = await this.executeClaudeProcess(projectPath, enhancedQuery, {
      model,
      mcpConfig,
      timeout,
    });

    // Filter thinking if requested
    const processedEvents = filterThinking ? this.filterThinkingBlocks(events) : events;

    // Extract results
    const result = this.extractResult(processedEvents);
    const messages = this.extractMessages(processedEvents);
    const metadata = this.extractMetadata(events);

    if (outputStyle) {
      metadata.outputStyle = outputStyle;
    }

    return {
      result,
      messages,
      events: processedEvents,
      metadata,
    };
  }

  /**
   * Build query with output-style injection
   */
  private buildQuery(query: string, outputStyle?: string): string {
    if (!outputStyle) {
      return query;
    }

    // Inject output-style command at the beginning
    return `/output-style ${outputStyle}\n\n${query}`;
  }

  /**
   * Execute Claude process and collect events
   */
  private async executeClaudeProcess(
    projectPath: string,
    query: string,
    options: {
      model?: string;
      mcpConfig?: string;
      timeout?: number;
    },
  ): Promise<StreamEvent[]> {
    return new Promise((resolve, reject) => {
      const events: StreamEvent[] = [];
      const { model, mcpConfig, timeout = 120000 } = options;

      // Build arguments
      const args = ['-p', query, '--output-format', 'stream-json', '--verbose'];

      if (model) {
        args.push('--model', model);
      }

      if (mcpConfig) {
        args.push('--mcp-config', mcpConfig);
        args.push('--strict-mcp-config');
      }

      appLogger.debug('Spawning Claude process', {
        module: 'ClaudeQueryAPI',
        args,
        cwd: projectPath,
      });

      const child = spawn('claude', args, {
        cwd: projectPath,
        shell: true,
        env: {
          ...process.env,
          FORCE_COLOR: '0',
        },
      });

      this.runningProcess = child;

      let buffer = '';
      let timeoutHandle: NodeJS.Timeout | null = null;

      // Set timeout
      if (timeout > 0) {
        timeoutHandle = setTimeout(() => {
          appLogger.warn('Query timeout, killing process', {
            module: 'ClaudeQueryAPI',
            timeout,
          });

          child.kill('SIGTERM');
          reject(new Error(`Query timeout after ${timeout}ms`));
        }, timeout);
      }

      child.stdout.on('data', (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event = JSON.parse(line);
            events.push(event);
          } catch (_error) {
            appLogger.debug('Failed to parse stream line', {
              module: 'ClaudeQueryAPI',
              line: line.substring(0, 100),
            });
          }
        }
      });

      child.stderr.on('data', (data: Buffer) => {
        appLogger.debug('Claude stderr', {
          module: 'ClaudeQueryAPI',
          data: data.toString(),
        });
      });

      child.on('close', (code) => {
        this.runningProcess = null;

        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        if (code === 0) {
          appLogger.info('Query completed successfully', {
            module: 'ClaudeQueryAPI',
            eventsCount: events.length,
          });
          resolve(events);
        } else {
          appLogger.error('Query failed', undefined, {
            module: 'ClaudeQueryAPI',
            code,
          });
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      child.on('error', (error) => {
        this.runningProcess = null;

        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        appLogger.error('Process error', error, {
          module: 'ClaudeQueryAPI',
        });
        reject(error);
      });
    });
  }

  /**
   * Filter thinking blocks from events
   */
  private filterThinkingBlocks(events: StreamEvent[]): StreamEvent[] {
    return events.map((event) => {
      if (event.type === 'message' && event.message?.content) {
        return {
          ...event,
          message: {
            ...event.message,
            content: event.message.content.filter((block: any) => block.type !== 'thinking'),
          },
        };
      }
      return event;
    });
  }

  /**
   * Extract final result from events
   */
  private extractResult(events: StreamEvent[]): string {
    const resultEvent = events.find((e) => e.type === 'result');
    return resultEvent?.result || '';
  }

  /**
   * Extract all assistant messages
   */
  private extractMessages(events: StreamEvent[]): string[] {
    const messages: string[] = [];

    for (const event of events) {
      if (event.type === 'message' && event.subtype === 'assistant') {
        const content = event.message?.content || [];
        for (const block of content) {
          if (block.type === 'text') {
            messages.push(block.text);
          }
        }
      }
    }

    return messages;
  }

  /**
   * Extract execution metadata
   */
  private extractMetadata(events: StreamEvent[]): QueryResult['metadata'] {
    const resultEvent = events.find((e) => e.type === 'result');

    return {
      totalCost: resultEvent?.total_cost_usd || 0,
      durationMs: resultEvent?.duration_ms || 0,
      numTurns: resultEvent?.num_turns || 0,
    };
  }

  /**
   * Execute query and extract JSON result
   *
   * Automatically:
   * - Uses 'structured-json' output-style
   * - Filters thinking blocks
   * - Extracts and validates JSON
   */
  async queryJSON<T = any>(
    projectPath: string,
    query: string,
    options: Omit<QueryOptions, 'outputStyle' | 'filterThinking'> & {
      requiredFields?: (keyof T)[];
    } = {},
  ): Promise<JSONExtractionResult<T>> {
    const { requiredFields, ...queryOptions } = options;

    appLogger.info('Executing JSON query', {
      module: 'ClaudeQueryAPI',
      projectPath,
      requiredFields: requiredFields?.length || 0,
    });

    try {
      // Execute with structured-json output-style
      const result = await this.query(projectPath, query, {
        ...queryOptions,
        outputStyle: 'structured-json',
        filterThinking: true,
      });

      // Extract and validate JSON
      if (requiredFields && requiredFields.length > 0) {
        return extractAndValidate<T extends Record<string, any> ? T : any>(
          result.result,
          requiredFields as string[],
        );
      } else {
        return extractJSON<T>(result.result);
      }
    } catch (error) {
      appLogger.error('JSON query failed', error instanceof Error ? error : undefined, {
        module: 'ClaudeQueryAPI',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute query and get typed JSON result with validation
   */
  async queryTypedJSON<T extends Record<string, any>>(
    projectPath: string,
    query: string,
    requiredFields: (keyof T)[],
    options: Omit<QueryOptions, 'outputStyle' | 'filterThinking'> = {},
  ): Promise<JSONExtractionResult<T>> {
    return this.queryJSON<T>(projectPath, query, {
      ...options,
      requiredFields,
    });
  }

  /**
   * Execute query with explicit JSON schema
   *
   * Automatically injects schema into prompt and validates response
   */
  async queryWithSchema<T = any>(
    projectPath: string,
    instruction: string,
    schema: JSONSchema,
    options: Omit<QueryOptions, 'outputStyle' | 'filterThinking'> = {},
  ): Promise<JSONExtractionResult<T>> {
    appLogger.info('Executing query with schema', {
      module: 'ClaudeQueryAPI',
      projectPath,
      schemaFields: Object.keys(schema).length,
    });

    try {
      // Build schema prompt
      const schemaPrompt = buildSchemaPrompt(schema, instruction);

      appLogger.debug('Built schema prompt', {
        module: 'ClaudeQueryAPI',
        promptLength: schemaPrompt.length,
      });

      // Execute with 'json' output-style (generic)
      const result = await this.query(projectPath, schemaPrompt, {
        ...options,
        outputStyle: 'json',
        filterThinking: true,
      });

      // Extract JSON
      const extracted = extractJSON<T>(result.result);

      if (!extracted.success) {
        return extracted;
      }

      // Validate against schema
      const validation = validateAgainstSchema(extracted.data, schema);

      if (!validation.valid) {
        appLogger.warn('Schema validation failed', {
          module: 'ClaudeQueryAPI',
          errors: validation.errors,
        });

        return {
          success: false,
          error: `Schema validation failed: ${validation.errors.join('; ')}`,
          raw: extracted.raw,
          cleanedText: extracted.cleanedText,
        };
      }

      appLogger.info('Schema query successful', {
        module: 'ClaudeQueryAPI',
        dataKeys: extracted.data ? Object.keys(extracted.data).length : 0,
      });

      return extracted;
    } catch (error) {
      appLogger.error('Schema query failed', error instanceof Error ? error : undefined, {
        module: 'ClaudeQueryAPI',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Kill running process
   */
  kill(): void {
    if (this.runningProcess) {
      appLogger.info('Killing running query process', {
        module: 'ClaudeQueryAPI',
      });

      this.runningProcess.kill('SIGTERM');
      this.runningProcess = null;
    }
  }

  /**
   * Execute query with Zod schema validation (Standard Schema compliant)
   *
   * Output-style은 힌트 역할, 실제 검증은 Zod가 수행
   *
   * @example
   * ```typescript
   * import { z } from 'zod';
   *
   * const schema = z.object({
   *   file: z.string(),
   *   complexity: z.number().min(1).max(20)
   * });
   *
   * const result = await api.queryWithZod(
   *   projectPath,
   *   'Analyze src/main.ts',
   *   schema
   * );
   *
   * if (result.success) {
   *   console.log(result.data.file);
   * }
   * ```
   */
  async queryWithZod<T>(
    projectPath: string,
    instruction: string,
    schema: import('zod').ZodType<T>,
    options: Omit<QueryOptions, 'outputStyle' | 'filterThinking'> = {},
  ): Promise<JSONExtractionResult<T>> {
    const { zodSchemaToPrompt, validateWithZod } = await import('../lib/zodSchemaBuilder');

    appLogger.info('Executing query with Zod schema', {
      module: 'ClaudeQueryAPI',
      projectPath,
      schemaType: schema.constructor.name,
    });

    try {
      // Build schema prompt (힌트용)
      const schemaPrompt = zodSchemaToPrompt(schema, instruction);

      appLogger.debug('Built Zod schema prompt', {
        module: 'ClaudeQueryAPI',
        promptLength: schemaPrompt.length,
      });

      // Execute with 'json' output-style (힌트만 제공)
      const result = await this.query(projectPath, schemaPrompt, {
        ...options,
        outputStyle: 'json',
        filterThinking: true,
      });

      // Extract JSON
      const extracted = extractJSON<T>(result.result);

      if (!extracted.success) {
        return extracted;
      }

      // Validate with Zod (실제 검증)
      const validation = validateWithZod(extracted.data, schema);

      if (!validation.success) {
        appLogger.warn('Zod validation failed', {
          module: 'ClaudeQueryAPI',
          error: validation.error,
          issuesCount: validation.issues.length,
        });

        return {
          success: false,
          error: `Schema validation failed: ${validation.error}`,
          raw: extracted.raw,
          cleanedText: extracted.cleanedText,
        };
      }

      appLogger.info('Zod validation successful', {
        module: 'ClaudeQueryAPI',
        dataKeys: extracted.data ? Object.keys(extracted.data).length : 0,
      });

      return {
        success: true,
        data: validation.data,
        raw: extracted.raw,
        cleanedText: extracted.cleanedText,
      };
    } catch (error) {
      appLogger.error('Zod query failed', error instanceof Error ? error : undefined, {
        module: 'ClaudeQueryAPI',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute query with Standard Schema validation
   *
   * Zod v3.24.0+ 스키마는 자동으로 Standard Schema를 구현합니다.
   *
   * @example
   * ```typescript
   * import { z } from 'zod';
   *
   * const schema = z.object({
   *   name: z.string(),
   *   age: z.number()
   * });
   *
   * const result = await api.queryWithStandardSchema(
   *   projectPath,
   *   'Get user info',
   *   schema
   * );
   * ```
   */
  async queryWithStandardSchema<T extends import('../lib/zodSchemaBuilder').StandardSchemaV1>(
    projectPath: string,
    instruction: string,
    schema: T,
    options: Omit<QueryOptions, 'outputStyle' | 'filterThinking'> = {},
  ): Promise<
    JSONExtractionResult<import('../lib/zodSchemaBuilder').StandardSchemaV1.InferOutput<T>>
  > {
    const { zodSchemaToPrompt, validateWithStandardSchema, isStandardSchema } = await import(
      '../lib/zodSchemaBuilder'
    );

    appLogger.info('Executing query with Standard Schema', {
      module: 'ClaudeQueryAPI',
      projectPath,
    });

    // Standard Schema 체크
    if (!isStandardSchema(schema)) {
      return {
        success: false,
        error: 'Provided schema does not implement Standard Schema V1',
      };
    }

    try {
      // Zod 스키마인 경우 프롬프트 생성
      let schemaPrompt = instruction;
      if ('_def' in schema) {
        // Zod schema
        schemaPrompt = zodSchemaToPrompt(schema as any, instruction);
      } else {
        // 다른 Standard Schema 구현체
        schemaPrompt = `${instruction}\n\nRespond with valid JSON.`;
      }

      // Execute
      const result = await this.query(projectPath, schemaPrompt, {
        ...options,
        outputStyle: 'json',
        filterThinking: true,
      });

      // Extract JSON
      const extracted = extractJSON(result.result);

      if (!extracted.success) {
        return extracted;
      }

      // Validate with Standard Schema
      const validation = await validateWithStandardSchema(extracted.data, schema);

      if (!validation.success) {
        appLogger.warn('Standard Schema validation failed', {
          module: 'ClaudeQueryAPI',
          error: validation.error,
        });

        return {
          success: false,
          error: `Schema validation failed: ${validation.error}`,
          raw: extracted.raw,
          cleanedText: extracted.cleanedText,
        };
      }

      appLogger.info('Standard Schema validation successful', {
        module: 'ClaudeQueryAPI',
      });

      return {
        success: true,
        data: validation.data,
        raw: extracted.raw,
        cleanedText: extracted.cleanedText,
      };
    } catch (error) {
      appLogger.error('Standard Schema query failed', error instanceof Error ? error : undefined, {
        module: 'ClaudeQueryAPI',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
