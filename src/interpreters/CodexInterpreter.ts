/**
 * Codex CLI JSON event interpreter
 * Parses codex --json output and builds non-interactive command args.
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
        }
        return '';
      })
      .filter((item) => item.length > 0)
      .join('\n');
  }
  if (isRecord(value)) {
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
  model = 'codex',
  sessionId = 'live-codex',
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
  sessionId = 'live-codex',
): StreamEvent {
  return {
    type: 'assistant',
    message: {
      id: makeId('msg'),
      type: 'message',
      role: 'assistant',
      model: 'codex',
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
  sessionId = 'live-codex',
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

function makeSystemInitEvent(sessionId: string, model = 'codex'): StreamEvent {
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

function makeErrorEvent(message: string, errorType = 'codex_error'): StreamEvent {
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

export class CodexInterpreter implements CLIToolInterpreter {
  toolId = 'codex';

  parseStreamLine(line: string): StreamEvent | null {
    const trimmed = line.trim();
    if (!trimmed) return null;
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const parsedType = typeof parsed.type === 'string' ? parsed.type : '';
      const sessionId = stringFrom(parsed.thread_id) ?? 'live-codex';

      if (parsedType === 'thread.started') {
        return makeSystemInitEvent(sessionId);
      }

      if (parsedType === 'turn.completed') {
        const usage = isRecord(parsed.usage) ? parsed.usage : {};
        return makeResultEvent({
          sessionId,
          result: 'Turn completed',
          durationMs: numberFrom(parsed.duration_ms) ?? 0,
          numTurns: 1,
          inputTokens: numberFrom(usage.input_tokens) ?? numberFrom(usage.total_input_tokens) ?? 0,
          outputTokens:
            numberFrom(usage.output_tokens) ?? numberFrom(usage.total_output_tokens) ?? 0,
          cacheReadTokens: numberFrom(usage.cached_input_tokens) ?? 0,
          totalCostUsd: numberFrom(usage.total_cost_usd) ?? 0,
        });
      }

      if (parsedType === 'item.completed' || parsedType === 'item.started') {
        const item = isRecord(parsed.item) ? parsed.item : null;
        if (!item) return null;

        if (item.type === 'agent_message') {
          const text =
            typeof item.text === 'string'
              ? item.text
              : typeof item.message === 'string'
                ? item.message
                : null;
          return text ? makeAssistantTextEvent(text, 'codex', sessionId) : null;
        }

        if (item.type === 'reasoning' && typeof item.text === 'string') {
          return makeAssistantTextEvent(item.text, 'codex', sessionId);
        }

        if (item.type === 'command_execution') {
          const commandId = stringFrom(item.id) ?? makeId('cmd');

          if (parsedType === 'item.started' && typeof item.command === 'string') {
            return makeAssistantToolUseEvent('shell', { command: item.command }, sessionId);
          }

          if (parsedType === 'item.completed') {
            const output = toText(
              item.aggregated_output ?? item.output ?? item.stdout ?? item.stderr ?? '',
            );
            if (output.trim().length > 0) {
              return makeToolResultEvent(commandId, output, sessionId);
            }

            const exitCode = numberFrom(item.exit_code);
            if (exitCode !== null && exitCode !== 0) {
              return makeErrorEvent(
                `Command failed with exit code ${exitCode}`,
                'command_execution_error',
              );
            }
          }
        }

        if (
          item.type === 'file_edit' ||
          item.type === 'file_write' ||
          item.type === 'file_read' ||
          item.type === 'todo_list'
        ) {
          if (parsedType === 'item.started') {
            const filePath =
              stringFrom(item.file_path) ??
              stringFrom(item.path) ??
              stringFrom(item.file) ??
              'unknown';
            return makeAssistantToolUseEvent(String(item.type), { path: filePath }, sessionId);
          }

          if (parsedType === 'item.completed') {
            const toolId = stringFrom(item.id) ?? makeId('tool');
            const detail =
              toText(item.aggregated_output ?? item.output ?? '') ||
              `${String(item.type)} completed`;
            return makeToolResultEvent(toolId, detail, sessionId);
          }
        }
      }

      if (parsedType === 'error' || parsed.error !== undefined) {
        const message =
          extractErrorMessage(parsed.error) ||
          extractErrorMessage(parsed.message) ||
          'Unknown Codex error';
        return makeErrorEvent(message);
      }

      return null;
    } catch {
      return null;
    }
  }
}
