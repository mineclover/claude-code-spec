/**
 * Gemini CLI JSON event interpreter
 * Parses gemini stream-json output and builds non-interactive command args.
 */

import type { CLIToolInterpreter } from '../types/cli-tool';
import type { StreamEvent } from '../types/stream-events';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function numberFrom(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringFrom(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function toText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (isRecord(item)) {
          if (typeof item.text === 'string') {
            return item.text;
          }
          if (typeof item.content === 'string') {
            return item.content;
          }
          if (typeof item.message === 'string') {
            return item.message;
          }
        }

        return '';
      })
      .filter((item) => item.length > 0)
      .join('\n');
  }

  if (isRecord(value)) {
    if (typeof value.message === 'string') {
      return value.message;
    }
    if (typeof value.content === 'string') {
      return value.content;
    }
    return JSON.stringify(value, null, 2);
  }

  return String(value ?? '');
}

function limitText(raw: string, max = 12000): string {
  if (raw.length <= max) {
    return raw;
  }
  return `${raw.slice(0, max)}\n... (truncated)`;
}

function makeAssistantTextEvent(
  text: string,
  model = 'gemini',
  sessionId = 'live-gemini',
): StreamEvent {
  return {
    type: 'assistant',
    message: {
      id: makeId('msg'),
      type: 'message',
      role: 'assistant',
      model,
      content: [{ type: 'text', text }],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        service_tier: 'unknown',
      },
    },
    parent_tool_use_id: null,
    session_id: sessionId,
    uuid: makeId('evt'),
  };
}

function makeAssistantToolUseEvent(
  name: string,
  input: Record<string, unknown>,
  sessionId = 'live-gemini',
): StreamEvent {
  return {
    type: 'assistant',
    message: {
      id: makeId('msg'),
      type: 'message',
      role: 'assistant',
      model: 'gemini',
      content: [
        {
          type: 'tool_use',
          id: makeId('tool'),
          name,
          input,
        },
      ],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        service_tier: 'unknown',
      },
    },
    parent_tool_use_id: null,
    session_id: sessionId,
    uuid: makeId('evt'),
  };
}

function makeToolResultEvent(
  toolUseId: string,
  content: string,
  sessionId = 'live-gemini',
): StreamEvent {
  return {
    type: 'user',
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: limitText(content),
        },
      ],
    },
    session_id: sessionId,
    parent_tool_use_id: toolUseId,
    uuid: makeId('evt'),
  };
}

function makeSystemInitEvent(sessionId: string, model = 'gemini'): StreamEvent {
  return {
    type: 'system',
    subtype: 'init',
    cwd: process.cwd(),
    session_id: sessionId,
    tools: [],
    mcp_servers: [],
    model,
    permissionMode: 'unknown',
    slash_commands: [],
    apiKeySource: 'unknown',
    output_style: 'unknown',
    agents: [],
    uuid: makeId('evt'),
  };
}

interface ResultEventInput {
  sessionId: string;
  result: string;
  durationMs?: number;
  numTurns?: number;
  isError?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  totalCostUsd?: number;
}

function makeResultEvent({
  sessionId,
  result,
  durationMs = 0,
  numTurns = 1,
  isError = false,
  inputTokens = 0,
  outputTokens = 0,
  cacheReadTokens = 0,
  totalCostUsd = 0,
}: ResultEventInput): StreamEvent {
  return {
    type: 'result',
    subtype: isError ? 'error' : 'success',
    is_error: isError,
    duration_ms: durationMs,
    duration_api_ms: durationMs,
    num_turns: numTurns,
    result,
    session_id: sessionId,
    total_cost_usd: totalCostUsd,
    usage: {
      input_tokens: inputTokens,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: cacheReadTokens,
      output_tokens: outputTokens,
      service_tier: 'unknown',
    },
    modelUsage: {},
    permission_denials: [],
    uuid: makeId('evt'),
  };
}

function makeErrorEvent(message: string, errorType = 'gemini_error'): StreamEvent {
  return {
    type: 'error',
    error: {
      type: errorType,
      message,
    },
  };
}

function extractErrorMessage(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (isRecord(value)) {
    if (typeof value.message === 'string') return value.message;
    if (typeof value.error === 'string') return value.error;
    return JSON.stringify(value);
  }
  return String(value);
}

export class GeminiInterpreter implements CLIToolInterpreter {
  toolId = 'gemini';

  parseStreamLine(line: string): StreamEvent | null {
    const trimmed = line.trim();
    if (!trimmed) return null;
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const parsedType = typeof parsed.type === 'string' ? parsed.type : '';
      const sessionId = stringFrom(parsed.session_id) ?? 'live-gemini';

      if (parsedType === 'init') {
        const model = stringFrom(parsed.model) ?? 'gemini';
        return makeSystemInitEvent(sessionId, model);
      }

      if (parsedType === 'message') {
        if (parsed.role === 'user') {
          return null;
        }

        if (parsed.role === 'assistant') {
          const text = toText(parsed.content);
          return text ? makeAssistantTextEvent(text, 'gemini', sessionId) : null;
        }
      }

      if (parsedType === 'tool_call' || parsedType === 'function_call') {
        const functionLike = isRecord(parsed.function) ? parsed.function : null;
        const toolName =
          (typeof parsed.name === 'string' ? parsed.name : null) ||
          (functionLike && typeof functionLike.name === 'string' ? functionLike.name : null) ||
          'unknown';

        const rawInput = parsed.arguments ?? parsed.args ?? parsed.input;
        const input = isRecord(rawInput) ? rawInput : { value: rawInput };

        return makeAssistantToolUseEvent(toolName, input, sessionId);
      }

      if (parsedType === 'tool_result' || parsedType === 'function_result') {
        const isError = parsed.is_error === true || parsed.error !== undefined;
        if (isError) {
          const message =
            extractErrorMessage(parsed.error) ||
            extractErrorMessage(parsed.message) ||
            'Gemini tool execution failed';
          return makeErrorEvent(message, 'gemini_tool_error');
        }

        const output = toText(
          parsed.result ?? parsed.content ?? parsed.output ?? parsed.response ?? '',
        ).trim();
        if (!output) {
          return null;
        }

        const toolUseId = stringFrom(parsed.tool_use_id) ?? stringFrom(parsed.id) ?? makeId('tool');
        return makeToolResultEvent(toolUseId, output, sessionId);
      }

      if (parsedType === 'result') {
        const stats = isRecord(parsed.stats) ? parsed.stats : {};
        const isError = stringFrom(parsed.status) === 'error';

        return makeResultEvent({
          sessionId,
          result: stringFrom(parsed.status) ?? 'completed',
          durationMs: numberFrom(stats.duration_ms) ?? 0,
          numTurns: 1,
          isError,
          inputTokens: numberFrom(stats.input_tokens) ?? numberFrom(stats.input) ?? 0,
          outputTokens: numberFrom(stats.output_tokens) ?? 0,
          cacheReadTokens: numberFrom(stats.cached) ?? 0,
          totalCostUsd: numberFrom(stats.total_cost_usd) ?? 0,
        });
      }

      if (parsedType === 'error' || parsed.error !== undefined) {
        const message =
          extractErrorMessage(parsed.error) ||
          extractErrorMessage(parsed.message) ||
          'Unknown Gemini error';
        return makeErrorEvent(message);
      }

      return null;
    } catch {
      return null;
    }
  }
}
