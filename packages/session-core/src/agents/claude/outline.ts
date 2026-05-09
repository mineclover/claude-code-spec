/**
 * Session outline extractor.
 *
 * Reads a session's JSONL stream (Claude internal log format) and
 * produces a flat `SessionStep[]` plus a `SessionSegment[]` view
 * grouped by user-instruction boundaries.
 *
 * Per-CLI quirks
 *   - Claude internal JSONL stores one record per line. Each line is
 *     either a meta record (permission-mode, file-history-snapshot,
 *     system-init) or a `type: 'user' | 'assistant'` message with a
 *     `message.content` array (TextContent | ToolUseContent |
 *     ToolResultContent | ThinkingContent).
 *   - Codex rollout JSONL has a different envelope but the same
 *     conceptual content (response_item / item.completed). For now
 *     extraction targets Claude only; codex/gemini flow through their
 *     interpreters before this stage. Future work: interpret-then-
 *     outline once the interpreter exposes the underlying step kinds.
 */

import {
  MAX_EXCERPT_CHARS,
  type SessionOutline,
  type SessionStep,
  type SessionStepKind,
} from '../../outline/types';
import { groupIntoSegments } from '../../outline/grouping';

interface RawClaudeEvent {
  type?: string;
  subtype?: string;
  message?: {
    role?: string;
    content?: unknown;
  };
  timestamp?: string;
  isMeta?: boolean;
  isSidechain?: boolean;
  parentUuid?: string | null;
}

interface ClassifiedBlock {
  kind: SessionStepKind;
  excerpt: string;
  toolName?: string;
}

function shorten(text: string): string {
  if (typeof text !== 'string') return '';
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (trimmed.length <= MAX_EXCERPT_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_EXCERPT_CHARS)}…(+${trimmed.length - MAX_EXCERPT_CHARS} more)`;
}

function blocksFromContent(content: unknown): ClassifiedBlock[] {
  if (typeof content === 'string') {
    return [{ kind: 'assistant-text', excerpt: shorten(content) }];
  }
  if (!Array.isArray(content)) return [];
  const out: ClassifiedBlock[] = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const b = block as Record<string, unknown>;
    const t = typeof b.type === 'string' ? b.type : '';
    if (t === 'text' && typeof b.text === 'string') {
      out.push({ kind: 'assistant-text', excerpt: shorten(b.text) });
    } else if (t === 'thinking' && typeof b.thinking === 'string') {
      out.push({ kind: 'thinking', excerpt: shorten(b.thinking) });
    } else if (t === 'tool_use') {
      const name = typeof b.name === 'string' ? b.name : 'unknown';
      const input =
        b.input && typeof b.input === 'object'
          ? JSON.stringify(b.input)
          : String(b.input ?? '');
      out.push({
        kind: 'tool-call',
        toolName: name,
        excerpt: shorten(input),
      });
    } else if (t === 'tool_result') {
      const inner =
        typeof b.content === 'string'
          ? b.content
          : Array.isArray(b.content)
            ? (b.content
                .map((c) =>
                  c && typeof c === 'object' && 'text' in c
                    ? String((c as { text?: unknown }).text ?? '')
                    : '',
                )
                .filter(Boolean)
                .join('\n'))
            : '';
      out.push({
        kind: 'tool-result',
        excerpt: shorten(inner),
      });
    }
  }
  return out;
}

function userExcerpt(content: unknown): string {
  if (typeof content === 'string') return shorten(content);
  if (!Array.isArray(content)) return '';
  // Anthropic-style user messages can carry tool_result blocks too.
  // For excerpt purposes we prefer the prose and fall through to the
  // first tool result if there's no plain text.
  let text = '';
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const b = block as Record<string, unknown>;
    if (b.type === 'text' && typeof b.text === 'string') {
      text += (text ? '\n' : '') + b.text;
    }
  }
  if (text) return shorten(text);
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const b = block as Record<string, unknown>;
    if (b.type === 'tool_result' && typeof b.content === 'string') {
      return shorten(`[tool_result] ${b.content}`);
    }
  }
  return '';
}

/**
 * Walk Claude internal JSONL and emit a `SessionOutline`.
 * Tolerates malformed lines and unknown event types (drops them).
 */
export function extractClaudeOutline(args: {
  raw: string;
  sourceSessionId: string;
  cwd: string;
  language?: 'en' | 'ko';
}): SessionOutline {
  const { raw, sourceSessionId, cwd, language } = args;
  const steps: SessionStep[] = [];
  let model: string | undefined;
  let turnIndex = -1; // -1 until we see the first user turn
  let blockIndex = 0;

  const push = (
    kind: SessionStepKind,
    excerpt: string,
    extras: { toolName?: string; timestamp?: string } = {},
  ) => {
    steps.push({
      index: steps.length,
      kind,
      turnIndex: turnIndex < 0 ? 0 : turnIndex,
      blockIndex: blockIndex++,
      toolName: extras.toolName,
      excerpt,
      timestamp: extras.timestamp,
    });
  };

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event: RawClaudeEvent;
    try {
      event = JSON.parse(trimmed) as RawClaudeEvent;
    } catch {
      continue;
    }

    // Sidechain entries belong to sub-agents; outline keeps the main
    // thread for now to avoid noise.
    if (event.isSidechain) continue;

    const ts = typeof event.timestamp === 'string' ? event.timestamp : undefined;
    const role = event.message?.role;

    if (event.type === 'user' && !event.isMeta) {
      // New user turn → bump turnIndex, reset blockIndex.
      turnIndex += 1;
      blockIndex = 0;
      const content = event.message?.content;
      // A user message with tool_result blocks is part of the assistant
      // turn it answers, not a fresh user instruction. Heuristic: if the
      // content is purely tool_result blocks (no prose), treat as
      // tool-result, not user-instruction.
      const blocks = Array.isArray(content)
        ? content.filter(
            (b): b is Record<string, unknown> =>
              !!b && typeof b === 'object',
          )
        : [];
      const hasProse =
        typeof content === 'string' ||
        blocks.some((b) => b.type === 'text');
      if (hasProse) {
        push('user-instruction', userExcerpt(content), { timestamp: ts });
      } else if (blocks.some((b) => b.type === 'tool_result')) {
        // Roll back the turnIndex bump — tool-result is not a user turn.
        turnIndex -= 1;
        blockIndex = 0;
        for (const block of blocks) {
          if (block.type !== 'tool_result') continue;
          const innerText =
            typeof block.content === 'string'
              ? block.content
              : Array.isArray(block.content)
                ? block.content
                    .map((c) =>
                      c && typeof c === 'object' && 'text' in c
                        ? String((c as { text?: unknown }).text ?? '')
                        : '',
                    )
                    .filter(Boolean)
                    .join('\n')
                : '';
          push('tool-result', shorten(innerText), { timestamp: ts });
        }
      } else {
        push('user-instruction', userExcerpt(content), { timestamp: ts });
      }
    } else if (event.type === 'assistant' && role === 'assistant') {
      // Assistant content is one or more blocks; each becomes a step.
      const content = event.message?.content;
      const blocks = blocksFromContent(content);
      for (const b of blocks) {
        push(b.kind, b.excerpt, { toolName: b.toolName, timestamp: ts });
      }
      const m = (event.message as { model?: unknown }).model;
      if (typeof m === 'string' && !model) model = m;
    } else if (event.type === 'system' && event.subtype === 'init') {
      const m = (event as { model?: unknown }).model;
      if (typeof m === 'string' && !model) model = m;
      // Don't push to outline — system init is uninteresting here.
    } else {
      // Permissions / file-history-snapshot / unknown — surface as meta.
      const repr = JSON.stringify(event);
      push('meta', shorten(repr), { timestamp: ts });
    }
  }

  return {
    toolId: 'claude',
    sourceSessionId,
    cwd,
    steps,
    segments: groupIntoSegments(steps),
    model,
    generatedAt: new Date().toISOString(),
    language,
  };
}

