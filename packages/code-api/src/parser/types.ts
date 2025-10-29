/**
 * Type definitions for Claude CLI stream-json output
 * Based on: https://docs.claude.com/en/docs/claude-code/headless.md
 */

// ============================================================================
// Base Event Types
// ============================================================================

export interface BaseStreamEvent {
  type: string;
  isSidechain?: boolean; // Indicates if this event is from a sub-agent
  [key: string]: unknown;
}

// ============================================================================
// System Events
// ============================================================================

export interface SystemInitEvent {
  type: 'system';
  subtype: 'init';
  cwd: string;
  session_id: string;
  tools: string[];
  mcp_servers: Array<{
    name: string;
    status: string;
  }>;
  model: string;
  permissionMode: string;
  slash_commands: string[];
  apiKeySource: string;
  output_style: string;
  agents: string[];
  uuid: string;
  isSidechain?: boolean;
}

// ============================================================================
// User Events
// ============================================================================

export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export interface UserMessage {
  role: 'user';
  content: string | ToolResultContent[];
}

export interface UserEvent {
  type: 'user';
  message: UserMessage;
  session_id: string;
  parent_tool_use_id: string | null;
  uuid: string;
  isSidechain?: boolean;
}

// ============================================================================
// Assistant Events
// ============================================================================

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type MessageContent = TextContent | ToolUseContent;

export interface AssistantMessage {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: MessageContent[];
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation?: {
      ephemeral_5m_input_tokens: number;
      ephemeral_1h_input_tokens: number;
    };
    output_tokens: number;
    service_tier: string;
  };
}

export interface AssistantEvent {
  type: 'assistant';
  message: AssistantMessage;
  parent_tool_use_id: string | null;
  session_id: string;
  uuid: string;
  isSidechain?: boolean;
}

// ============================================================================
// Result Events
// ============================================================================

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
  contextWindow: number;
}

export interface ResultEvent {
  type: 'result';
  subtype: 'success' | 'error';
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result: string;
  session_id: string;
  total_cost_usd: number;
  usage: {
    input_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens: number;
    server_tool_use?: {
      web_search_requests: number;
    };
    service_tier: string;
    cache_creation?: {
      ephemeral_1h_input_tokens: number;
      ephemeral_5m_input_tokens: number;
    };
  };
  modelUsage: Record<string, ModelUsage>;
  permission_denials: Array<{
    tool_name: string;
    tool_input: Record<string, unknown>;
  }>;
  uuid: string;
  isSidechain?: boolean;
}

// ============================================================================
// Error Events
// ============================================================================

export interface ErrorEvent {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
  isSidechain?: boolean;
}

// ============================================================================
// Union Type
// ============================================================================

export type StreamEvent =
  | SystemInitEvent
  | UserEvent
  | AssistantEvent
  | ResultEvent
  | ErrorEvent
  | BaseStreamEvent;

// ============================================================================
// Type Guards
// ============================================================================

export function isSystemInitEvent(event: StreamEvent): event is SystemInitEvent {
  return event.type === 'system' && 'subtype' in event && event.subtype === 'init';
}

export function isUserEvent(event: StreamEvent): event is UserEvent {
  return event.type === 'user' && 'message' in event;
}

export function isAssistantEvent(event: StreamEvent): event is AssistantEvent {
  return event.type === 'assistant' && 'message' in event;
}

export function isResultEvent(event: StreamEvent): event is ResultEvent {
  return event.type === 'result' && 'result' in event;
}

export function isErrorEvent(event: StreamEvent): event is ErrorEvent {
  return event.type === 'error' && 'error' in event;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract text content from assistant message
 */
export function extractTextFromMessage(message: AssistantMessage): string {
  return message.content
    .filter((block): block is TextContent => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

/**
 * Extract tool uses from assistant message
 */
export function extractToolUsesFromMessage(message: AssistantMessage): ToolUseContent[] {
  return message.content.filter((block): block is ToolUseContent => block.type === 'tool_use');
}

/**
 * Get session ID from any event that contains it
 */
export function extractSessionId(event: StreamEvent): string | null {
  if ('session_id' in event && typeof event.session_id === 'string') {
    return event.session_id;
  }
  return null;
}
