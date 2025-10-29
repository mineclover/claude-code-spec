/**
 * Zod schemas for runtime validation of StreamEvent types
 *
 * Provides runtime type safety on top of TypeScript static types.
 * Use these schemas to validate unknown data from external sources (CLI output, network, etc.).
 */

import { z } from 'zod';

// ============================================================================
// Base Schema
// ============================================================================

export const BaseStreamEventSchema = z.object({
  type: z.string(),
  isSidechain: z.boolean().optional(),
});

// ============================================================================
// System Events
// ============================================================================

export const SystemInitEventSchema = z.object({
  type: z.literal('system'),
  subtype: z.literal('init'),
  cwd: z.string(),
  session_id: z.string(),
  tools: z.array(z.string()),
  mcp_servers: z.array(
    z.object({
      name: z.string(),
      status: z.string(),
    }),
  ),
  model: z.string(),
  permissionMode: z.string(),
  slash_commands: z.array(z.string()),
  apiKeySource: z.string(),
  output_style: z.string(),
  agents: z.array(z.string()),
  uuid: z.string(),
  isSidechain: z.boolean().optional(),
});

// ============================================================================
// User Events
// ============================================================================

export const ToolResultContentSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.string(),
});

export const UserMessageSchema = z.object({
  role: z.literal('user'),
  content: z.union([z.string(), z.array(ToolResultContentSchema)]),
});

export const UserEventSchema = z.object({
  type: z.literal('user'),
  message: UserMessageSchema,
  session_id: z.string(),
  parent_tool_use_id: z.string().nullable(),
  uuid: z.string(),
  isSidechain: z.boolean().optional(),
});

// ============================================================================
// Assistant Events
// ============================================================================

export const TextContentSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

export const ToolUseContentSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.record(z.unknown()),
});

export const MessageContentSchema = z.union([TextContentSchema, ToolUseContentSchema]);

export const AssistantMessageSchema = z.object({
  id: z.string(),
  type: z.literal('message'),
  role: z.literal('assistant'),
  model: z.string(),
  content: z.array(MessageContentSchema),
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
});

export const AssistantEventSchema = z.object({
  type: z.literal('assistant'),
  message: AssistantMessageSchema,
  parent_tool_use_id: z.string().nullable(),
  session_id: z.string(),
  uuid: z.string(),
  isSidechain: z.boolean().optional(),
});

// ============================================================================
// Result Events
// ============================================================================

export const ModelUsageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheReadInputTokens: z.number(),
  cacheCreationInputTokens: z.number(),
  webSearchRequests: z.number(),
  costUSD: z.number(),
  contextWindow: z.number(),
});

export const ResultEventSchema = z.object({
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
    server_tool_use: z
      .object({
        web_search_requests: z.number(),
      })
      .optional(),
    service_tier: z.string(),
    cache_creation: z
      .object({
        ephemeral_1h_input_tokens: z.number(),
        ephemeral_5m_input_tokens: z.number(),
      })
      .optional(),
  }),
  modelUsage: z.record(ModelUsageSchema),
  permission_denials: z.array(
    z.object({
      tool_name: z.string(),
      tool_input: z.record(z.unknown()),
    }),
  ),
  uuid: z.string(),
  isSidechain: z.boolean().optional(),
});

// ============================================================================
// Error Events
// ============================================================================

export const ErrorEventSchema = z.object({
  type: z.literal('error'),
  error: z.object({
    type: z.string(),
    message: z.string(),
  }),
  isSidechain: z.boolean().optional(),
});

// ============================================================================
// Union Schema
// ============================================================================

export const StreamEventSchema = z.union([
  SystemInitEventSchema,
  UserEventSchema,
  AssistantEventSchema,
  ResultEventSchema,
  ErrorEventSchema,
  BaseStreamEventSchema, // Fallback for unknown event types
]);

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a stream event with runtime type checking
 * Returns parsed event or throws ZodError
 */
export function validateStreamEvent(data: unknown) {
  return StreamEventSchema.parse(data);
}

/**
 * Safely validate a stream event, returning null on failure
 * Useful when you want to handle validation errors gracefully
 */
export function safeValidateStreamEvent(data: unknown) {
  const result = StreamEventSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate a specific event type
 */
export function validateSystemInitEvent(data: unknown) {
  return SystemInitEventSchema.parse(data);
}

export function validateUserEvent(data: unknown) {
  return UserEventSchema.parse(data);
}

export function validateAssistantEvent(data: unknown) {
  return AssistantEventSchema.parse(data);
}

export function validateResultEvent(data: unknown) {
  return ResultEventSchema.parse(data);
}

export function validateErrorEvent(data: unknown) {
  return ErrorEventSchema.parse(data);
}

// ============================================================================
// Type inference from schemas
// ============================================================================

// Re-export inferred types if needed
export type ValidatedStreamEvent = z.infer<typeof StreamEventSchema>;
export type ValidatedSystemInitEvent = z.infer<typeof SystemInitEventSchema>;
export type ValidatedUserEvent = z.infer<typeof UserEventSchema>;
export type ValidatedAssistantEvent = z.infer<typeof AssistantEventSchema>;
export type ValidatedResultEvent = z.infer<typeof ResultEventSchema>;
export type ValidatedErrorEvent = z.infer<typeof ErrorEventSchema>;
