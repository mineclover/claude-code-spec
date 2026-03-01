/**
 * StreamParser - Handles line-by-line JSON parsing from CLI stream output
 * Absorbed from packages/code-api with Zod validation
 */

import { z } from 'zod';
import type { StreamEvent } from '../types/stream-events';

// ============================================================================
// Zod Schemas
// ============================================================================

const BaseStreamEventSchema = z.object({
  type: z.string(),
  isSidechain: z.boolean().optional(),
});

const SystemInitEventSchema = z.object({
  type: z.literal('system'),
  subtype: z.literal('init'),
  cwd: z.string(),
  session_id: z.string(),
  tools: z.array(z.string()),
  mcp_servers: z.array(z.object({ name: z.string(), status: z.string() })),
  model: z.string(),
  permissionMode: z.string(),
  slash_commands: z.array(z.string()),
  apiKeySource: z.string(),
  output_style: z.string(),
  agents: z.array(z.string()),
  uuid: z.string(),
  isSidechain: z.boolean().optional(),
});

const UserEventSchema = z.object({
  type: z.literal('user'),
  message: z.object({
    role: z.literal('user'),
    content: z.union([
      z.string(),
      z.array(
        z.object({
          type: z.literal('tool_result'),
          tool_use_id: z.string(),
          content: z.string(),
        }),
      ),
    ]),
  }),
  session_id: z.string(),
  parent_tool_use_id: z.string().nullable(),
  uuid: z.string(),
  isSidechain: z.boolean().optional(),
});

const AssistantEventSchema = z.object({
  type: z.literal('assistant'),
  message: z.object({
    id: z.string(),
    type: z.literal('message'),
    role: z.literal('assistant'),
    model: z.string(),
    content: z.array(
      z.union([
        z.object({ type: z.literal('text'), text: z.string() }),
        z.object({
          type: z.literal('tool_use'),
          id: z.string(),
          name: z.string(),
          input: z.record(z.unknown()),
        }),
      ]),
    ),
    stop_reason: z.string().nullable(),
    stop_sequence: z.string().nullable(),
    usage: z.object({
      input_tokens: z.number(),
      cache_creation_input_tokens: z.number().optional(),
      cache_read_input_tokens: z.number().optional(),
      cache_creation: z
        .object({
          ephemeral_5m_input_tokens: z.number(),
          ephemeral_1h_input_tokens: z.number(),
        })
        .optional(),
      output_tokens: z.number(),
      service_tier: z.string(),
    }),
  }),
  parent_tool_use_id: z.string().nullable(),
  session_id: z.string(),
  uuid: z.string(),
  isSidechain: z.boolean().optional(),
});

const ResultEventSchema = z.object({
  type: z.literal('result'),
  subtype: z.union([z.literal('success'), z.literal('error')]),
  is_error: z.boolean(),
  duration_ms: z.number(),
  duration_api_ms: z.number(),
  num_turns: z.number(),
  result: z.string(),
  session_id: z.string(),
  total_cost_usd: z.number(),
  usage: z.object({
    input_tokens: z.number(),
    cache_creation_input_tokens: z.number().optional(),
    cache_read_input_tokens: z.number().optional(),
    output_tokens: z.number(),
    server_tool_use: z.object({ web_search_requests: z.number() }).optional(),
    service_tier: z.string(),
    cache_creation: z
      .object({
        ephemeral_1h_input_tokens: z.number(),
        ephemeral_5m_input_tokens: z.number(),
      })
      .optional(),
  }),
  modelUsage: z.record(
    z.object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      cacheReadInputTokens: z.number(),
      cacheCreationInputTokens: z.number(),
      webSearchRequests: z.number(),
      costUSD: z.number(),
      contextWindow: z.number(),
    }),
  ),
  permission_denials: z.array(
    z.object({
      tool_name: z.string(),
      tool_input: z.record(z.unknown()),
    }),
  ),
  uuid: z.string(),
  isSidechain: z.boolean().optional(),
});

const ErrorEventSchema = z.object({
  type: z.literal('error'),
  error: z.object({ type: z.string(), message: z.string() }),
  isSidechain: z.boolean().optional(),
});

const StreamEventSchema = z.union([
  SystemInitEventSchema,
  UserEventSchema,
  AssistantEventSchema,
  ResultEventSchema,
  ErrorEventSchema,
  BaseStreamEventSchema,
]);

function safeValidateStreamEvent(data: unknown) {
  const result = StreamEventSchema.safeParse(data);
  return result.success ? result.data : null;
}

// ============================================================================
// StreamParser
// ============================================================================

export type StreamCallback = (event: StreamEvent) => void;
export type ErrorCallback = (error: string) => void;

export interface StreamParserOptions {
  maxBufferSize?: number;
  onBufferOverflow?: (bufferSize: number) => void;
}

function createAnsiEscapeRegex(): RegExp {
  const esc = String.fromCharCode(27);
  return new RegExp(`${esc}\\[[0-9;?]*[a-zA-Z]|${esc}\\)[a-zA-Z]`, 'g');
}

export class StreamParser {
  private buffer = '';
  private onEvent: StreamCallback;
  private onError?: ErrorCallback;
  private maxBufferSize: number;
  private onBufferOverflow?: (bufferSize: number) => void;

  constructor(onEvent: StreamCallback, onError?: ErrorCallback, options: StreamParserOptions = {}) {
    this.onEvent = onEvent;
    this.onError = onError;
    this.maxBufferSize = options.maxBufferSize ?? 10 * 1024 * 1024;
    this.onBufferOverflow = options.onBufferOverflow;
  }

  processChunk(chunk: Buffer | string): void {
    const data = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    this.buffer += data;

    const bufferSize = Buffer.byteLength(this.buffer, 'utf8');
    if (bufferSize > this.maxBufferSize) {
      const errorMsg = `Buffer overflow: ${bufferSize} bytes exceeds limit of ${this.maxBufferSize} bytes`;
      console.error('[StreamParser]', errorMsg);
      this.onBufferOverflow?.(bufferSize);
      this.onError?.(errorMsg);
      this.buffer = '';
      return;
    }

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const cleanedLine = trimmedLine.replace(createAnsiEscapeRegex(), '');
      if (cleanedLine.startsWith('{') || cleanedLine.startsWith('[')) {
        this.parseLine(cleanedLine);
      }
    }
  }

  private parseLine(line: string): void {
    try {
      const parsed = JSON.parse(line);
      const validated = safeValidateStreamEvent(parsed);

      if (!validated) {
        this.onError?.(`Schema validation failed: ${line.substring(0, 100)}`);
        return;
      }

      this.onEvent(validated as StreamEvent);
    } catch {
      this.onError?.(`JSON parse error: ${line.substring(0, 100)}`);
    }
  }

  flush(): void {
    if (this.buffer.trim()) {
      this.parseLine(this.buffer);
      this.buffer = '';
    }
  }

  reset(): void {
    this.buffer = '';
  }
}
