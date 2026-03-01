/**
 * Stream event types for Claude CLI output
 * Migrated from @context-action/code-api
 */

// Base stream event
export interface StreamEvent {
  type: string;
  subtype?: string;
  isSidechain?: boolean;
  [key: string]: unknown;
}

// System init event
export interface SystemInitEvent extends StreamEvent {
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
}

// User event
export interface UserEvent extends StreamEvent {
  type: 'user';
  message: {
    role: 'user';
    content: string | Array<{
      type: 'tool_result';
      tool_use_id: string;
      content: string;
    }>;
  };
  session_id: string;
  parent_tool_use_id: string | null;
  uuid: string;
}

// Assistant event
export interface AssistantEvent extends StreamEvent {
  type: 'assistant';
  message: {
    id: string;
    type: 'message';
    role: 'assistant';
    model: string;
    content: Array<
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
      | { type: 'thinking'; thinking: string }
    >;
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: {
      input_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      output_tokens: number;
      service_tier: string;
    };
  };
  parent_tool_use_id: string | null;
  session_id: string;
  uuid: string;
}

// Result event
export interface ResultEvent extends StreamEvent {
  type: 'result';
  subtype: 'success' | 'error' | 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd';
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
  };
  modelUsage: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    webSearchRequests: number;
    costUSD: number;
    contextWindow: number;
  }>;
  permission_denials: Array<{
    tool_name: string;
    tool_input: Record<string, unknown>;
  }>;
  uuid: string;
}

// Error event
export interface ErrorEvent extends StreamEvent {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

// Type guards
export function isSystemInitEvent(event: StreamEvent): event is SystemInitEvent {
  return event.type === 'system' && event.subtype === 'init';
}

export function isUserEvent(event: StreamEvent): event is UserEvent {
  return event.type === 'user';
}

export function isAssistantEvent(event: StreamEvent): event is AssistantEvent {
  return event.type === 'assistant';
}

export function isResultEvent(event: StreamEvent): event is ResultEvent {
  return event.type === 'result';
}

export function isErrorEvent(event: StreamEvent): event is ErrorEvent {
  return event.type === 'error';
}
