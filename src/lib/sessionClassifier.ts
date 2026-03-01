/**
 * Session Log Entry Classifier
 * Classifies ClaudeSessionEntry by speaker and output type for enhanced rendering.
 */

import type { ClaudeSessionEntry } from '../types/api/sessions';

export type Speaker = 'human' | 'agent' | 'sub-agent' | 'system';
export type OutputType = 'tool-call' | 'tool-output' | 'thinking' | 'answer' | 'system';

export interface ToolCallInfo {
  name: string;
  id: string;
  input: Record<string, unknown>;
}

export interface ToolResultInfo {
  toolUseId: string;
  content: string;
}

export interface ClassifiedEntry {
  speaker: Speaker;
  outputType: OutputType;
  textContent?: string;
  toolCalls?: ToolCallInfo[];
  toolResults?: ToolResultInfo[];
  thinkingContent?: string;
  rawEntry: ClaudeSessionEntry;
}

/**
 * Classify a session log entry by speaker and output type.
 * Supports Claude, Codex, and Gemini log formats.
 */
export function classifyEntry(entry: ClaudeSessionEntry, toolId?: string): ClassifiedEntry {
  // Codex-specific entries
  if (toolId === 'codex') {
    return classifyCodexEntry(entry);
  }

  // Gemini entries (already normalized to {type: 'human'|'assistant', content})
  if (toolId === 'gemini') {
    return classifyGeminiEntry(entry);
  }

  // Claude entries
  return classifyClaudeEntry(entry);
}

function classifyClaudeEntry(entry: ClaudeSessionEntry): ClassifiedEntry {
  const base: ClassifiedEntry = {
    speaker: 'system',
    outputType: 'system',
    rawEntry: entry,
  };

  // System init
  if (entry.type === 'system' && entry.subtype === 'init') {
    const parts: string[] = [];
    if (entry.model) parts.push(`Model: ${entry.model}`);
    if (entry.session_id) parts.push(`Session: ${String(entry.session_id).substring(0, 8)}`);
    if (entry.permissionMode) parts.push(`Permissions: ${entry.permissionMode}`);
    base.textContent = parts.join(' | ') || 'System init';
    return base;
  }

  // Result event
  if (entry.type === 'result') {
    const parts: string[] = [];
    if (entry.subtype) parts.push(`Status: ${entry.subtype}`);
    if (entry.duration_ms != null) parts.push(`Duration: ${Number(entry.duration_ms) / 1000}s`);
    if (entry.num_turns != null) parts.push(`Turns: ${entry.num_turns}`);
    if (entry.total_cost_usd != null) parts.push(`Cost: $${Number(entry.total_cost_usd).toFixed(4)}`);
    if (entry.result && typeof entry.result === 'string') {
      parts.push(entry.result.substring(0, 200));
    }
    base.textContent = parts.join(' | ') || 'Result';
    return base;
  }

  // Error event
  if (entry.type === 'error') {
    const error = entry.error as { type?: string; message?: string } | undefined;
    base.textContent = error?.message || 'Unknown error';
    return base;
  }

  // User event
  if (entry.type === 'user') {
    const message = entry.message as { role?: string; content?: unknown } | undefined;
    if (message?.content) {
      // Check if it's a tool_result (array content)
      if (Array.isArray(message.content)) {
        base.speaker = 'human';
        base.outputType = 'tool-output';
        base.toolResults = (message.content as Array<{ type?: string; tool_use_id?: string; content?: string }>)
          .filter((c) => c.type === 'tool_result')
          .map((c) => ({
            toolUseId: c.tool_use_id || '',
            content: typeof c.content === 'string' ? c.content : JSON.stringify(c.content),
          }));
        return base;
      }
      // Plain string content = human message
      if (typeof message.content === 'string') {
        base.speaker = 'human';
        base.outputType = 'answer';
        base.textContent = message.content;
        return base;
      }
    }
    base.speaker = 'human';
    base.outputType = 'answer';
    base.textContent = '';
    return base;
  }

  // Assistant event
  if (entry.type === 'assistant') {
    base.speaker = entry.isSidechain ? 'sub-agent' : 'agent';

    const message = entry.message as { content?: Array<{ type: string; [key: string]: unknown }> } | undefined;
    const content = message?.content;
    if (!content || !Array.isArray(content)) {
      base.outputType = 'answer';
      base.textContent = '';
      return base;
    }

    // Parse all content blocks
    const textParts: string[] = [];
    const toolCalls: ToolCallInfo[] = [];
    let thinkingContent = '';

    for (const block of content) {
      if (block.type === 'text') {
        textParts.push(block.text as string);
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name as string,
          id: block.id as string,
          input: (block.input as Record<string, unknown>) || {},
        });
      } else if (block.type === 'thinking') {
        thinkingContent += (thinkingContent ? '\n' : '') + (block.thinking as string);
      }
    }

    // Determine primary outputType (priority: thinking > tool-call > answer)
    if (thinkingContent) {
      base.outputType = 'thinking';
      base.thinkingContent = thinkingContent;
    } else if (toolCalls.length > 0) {
      base.outputType = 'tool-call';
    } else {
      base.outputType = 'answer';
    }

    // Always populate all parsed content
    if (textParts.length > 0) base.textContent = textParts.join('\n');
    if (toolCalls.length > 0) base.toolCalls = toolCalls;
    if (thinkingContent) base.thinkingContent = thinkingContent;

    return base;
  }

  // Fallback: unknown event types
  base.textContent = JSON.stringify(entry, null, 2).substring(0, 300);
  return base;
}

function classifyCodexEntry(entry: ClaudeSessionEntry): ClassifiedEntry {
  const base: ClassifiedEntry = {
    speaker: 'system',
    outputType: 'system',
    rawEntry: entry,
  };

  // session_meta → system/system
  if (entry.type === 'session_meta') {
    const parts: string[] = [];
    if (entry.model) parts.push(`Model: ${entry.model}`);
    if (entry.session_id) parts.push(`Session: ${String(entry.session_id).substring(0, 8)}`);
    base.textContent = parts.join(' | ') || 'Session metadata';
    return base;
  }

  // response_item → agent/answer
  if (entry.type === 'response_item') {
    base.speaker = 'agent';
    base.outputType = 'answer';
    base.textContent = typeof entry.content === 'string'
      ? entry.content
      : JSON.stringify(entry.content ?? entry, null, 2).substring(0, 500);
    return base;
  }

  // event_msg → agent/answer
  if (entry.type === 'event_msg') {
    base.speaker = 'agent';
    base.outputType = 'answer';
    base.textContent = typeof entry.content === 'string'
      ? entry.content
      : (typeof entry.message === 'string' ? entry.message : JSON.stringify(entry, null, 2).substring(0, 500));
    return base;
  }

  // turn_context → system/system
  if (entry.type === 'turn_context') {
    base.textContent = 'Turn context';
    return base;
  }

  // Fallback
  base.textContent = JSON.stringify(entry, null, 2).substring(0, 300);
  return base;
}

function classifyGeminiEntry(entry: ClaudeSessionEntry): ClassifiedEntry {
  // Gemini entries are already normalized: {type: 'human'|'assistant', content, timestamp}
  if (entry.type === 'human') {
    return {
      speaker: 'human',
      outputType: 'answer',
      textContent: typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content),
      rawEntry: entry,
    };
  }

  if (entry.type === 'assistant') {
    return {
      speaker: 'agent',
      outputType: 'answer',
      textContent: typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content),
      rawEntry: entry,
    };
  }

  return {
    speaker: 'system',
    outputType: 'system',
    textContent: JSON.stringify(entry, null, 2).substring(0, 300),
    rawEntry: entry,
  };
}
