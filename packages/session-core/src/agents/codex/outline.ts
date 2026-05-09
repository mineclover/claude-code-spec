/**
 * Codex outline extractor.
 *
 * Codex's `~/.codex/sessions/<YYYY/MM/DD>/rollout-*.jsonl` is a
 * per-line JSON envelope. Each line has a top-level `type` and a
 * `payload`. There are two parallel families:
 *
 *   - `response_item` carries the canonical model + tool content:
 *     `payload.type === 'message'` with `role` 'user' / 'assistant' /
 *     'developer'; `payload.type === 'reasoning'`; `payload.type ===
 *     'function_call'`; `payload.type === 'function_call_output'`.
 *   - `event_msg` is the streaming-protocol mirror of the same data
 *     (token_count, agent_message, agent_reasoning, etc.). It mostly
 *     duplicates `response_item`, so we skip it for outline purposes
 *     EXCEPT for `task_started`, which we use as the signal that
 *     boilerplate developer/system injections are over and the
 *     subsequent `message.user` is real operator input.
 *
 * Without that boundary the outline would treat every auto-injected
 * AGENTS.md / permissions block as a "user instruction" and split the
 * segments incorrectly. The first `task_started` is the cleanest cut.
 */

import {
  MAX_EXCERPT_CHARS,
  type SessionOutline,
  type SessionStep,
  type SessionStepKind,
} from '../../outline/types';
import { groupIntoSegments } from '../../outline/grouping';

interface RawCodexEnvelope {
  type?: string;
  timestamp?: string;
  payload?: {
    type?: string;
    role?: string;
    content?: unknown;
    summary?: unknown;
    name?: string;
    arguments?: string;
    output?: string;
    call_id?: string;
  };
}

function shorten(text: string): string {
  if (typeof text !== 'string') return '';
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (trimmed.length <= MAX_EXCERPT_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_EXCERPT_CHARS)}…(+${trimmed.length - MAX_EXCERPT_CHARS} more)`;
}

/**
 * Codex `message.content` is an array of `{ type: 'input_text' |
 * 'output_text', text: string }` entries. Concatenate the text
 * fields in order — that's what the model actually saw or produced.
 */
function readContentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((p) => {
      if (!p || typeof p !== 'object') return '';
      const obj = p as { type?: string; text?: string };
      if (
        (obj.type === 'input_text' || obj.type === 'output_text') &&
        typeof obj.text === 'string'
      ) {
        return obj.text;
      }
      return '';
    })
    .join('\n')
    .trim();
}

/**
 * Codex reasoning entries carry `summary: [{type: 'summary_text', text}]`
 * and an opaque `encrypted_content` we can't show. Surface the summary
 * text — it's the human-readable reasoning excerpt.
 */
function readReasoningText(summary: unknown): string {
  if (!Array.isArray(summary)) return '';
  return summary
    .map((s) => {
      if (!s || typeof s !== 'object') return '';
      const obj = s as { type?: string; text?: string };
      return obj.type === 'summary_text' && typeof obj.text === 'string'
        ? obj.text
        : '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function extractCodexOutline(args: {
  raw: string;
  sourceSessionId: string;
  cwd: string;
  language?: 'en' | 'ko';
}): SessionOutline {
  const { raw, sourceSessionId, cwd, language } = args;
  const steps: SessionStep[] = [];
  let turnIndex = -1;
  let blockIndex = 0;
  let seenTaskStarted = false;
  let model: string | undefined;

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
      excerpt: shorten(excerpt),
      timestamp: extras.timestamp,
    });
  };

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event: RawCodexEnvelope;
    try {
      event = JSON.parse(trimmed) as RawCodexEnvelope;
    } catch {
      continue;
    }

    const ts = typeof event.timestamp === 'string' ? event.timestamp : undefined;
    const t = event.type;

    if (t === 'session_meta') {
      // First entry. Capture the model id when present (Codex stores it
      // under `model` directly on the payload).
      const p = event.payload as
        | { model?: string; cwd?: string }
        | undefined;
      if (p && typeof p.model === 'string') model = p.model;
      push('meta', `codex session_meta`, { timestamp: ts });
      continue;
    }

    if (t === 'event_msg') {
      const ptype = event.payload?.type;
      if (ptype === 'task_started') {
        seenTaskStarted = true;
        // The task-start marker isn't itself useful as a step, but we
        // surface it once so the outline shows where boilerplate ends
        // and operator turns begin.
        if (steps[steps.length - 1]?.kind !== 'meta' || steps.length === 0) {
          // (no-op — we just don't want to emit dozens of meta steps)
        }
      }
      // Skip every other event_msg flavor: token_count / agent_message /
      // agent_reasoning / user_message / task_complete all duplicate
      // response_item content for the streaming protocol.
      continue;
    }

    if (t === 'turn_context') {
      // Streaming-protocol metadata. Drop.
      continue;
    }

    if (t !== 'response_item') continue;

    const p = event.payload;
    if (!p || typeof p.type !== 'string') continue;
    const ptype = p.type;

    if (ptype === 'message') {
      const text = readContentText(p.content);
      if (!text) continue;
      const role = p.role;
      if (role === 'developer' || role === 'system') {
        push('meta', `${role}: ${text}`, { timestamp: ts });
      } else if (role === 'user') {
        if (!seenTaskStarted) {
          // Pre-task user injections are AGENTS.md and friends — meta.
          push('meta', `user(boilerplate): ${text}`, { timestamp: ts });
        } else {
          turnIndex += 1;
          blockIndex = 0;
          push('user-instruction', text, { timestamp: ts });
        }
      } else if (role === 'assistant') {
        push('assistant-text', text, { timestamp: ts });
      } else {
        push('meta', `message:${role ?? '?'}: ${text}`, { timestamp: ts });
      }
      continue;
    }

    if (ptype === 'reasoning') {
      const text = readReasoningText((p as { summary?: unknown }).summary);
      if (text) push('thinking', text, { timestamp: ts });
      continue;
    }

    if (ptype === 'function_call') {
      const name =
        typeof (p as { name?: string }).name === 'string'
          ? (p as { name: string }).name
          : undefined;
      const argText =
        typeof (p as { arguments?: string }).arguments === 'string'
          ? (p as { arguments: string }).arguments
          : '';
      push('tool-call', argText, { toolName: name, timestamp: ts });
      continue;
    }

    if (ptype === 'function_call_output') {
      const out =
        typeof (p as { output?: string }).output === 'string'
          ? (p as { output: string }).output
          : '';
      push('tool-result', out, { timestamp: ts });
      continue;
    }
  }

  return {
    toolId: 'codex',
    sourceSessionId,
    cwd,
    steps,
    segments: groupIntoSegments(steps),
    model,
    generatedAt: new Date().toISOString(),
    language,
  };
}
