/**
 * Utility functions for extracting content from Claude API messages
 * These functions are copied from @context-action/code-api to avoid
 * bundling Node.js dependencies in the renderer process.
 */

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
