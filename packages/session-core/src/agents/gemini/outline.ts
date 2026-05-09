/**
 * Gemini outline extractor.
 *
 * Gemini stores each session as a single JSON document (not JSONL):
 *   ~/.gemini/tmp/<projectHash>/chats/session-*.json
 *
 * Top-level shape:
 *   { sessionId, projectHash, startTime, lastUpdated, messages: [...] }
 *
 * Each message has `id`, `timestamp`, `type` ('user' | 'gemini'),
 * `content` (string). Gemini messages may additionally carry:
 *   - `thoughts: [{ subject, description, timestamp }]` — reasoning
 *     summaries that Claude stores as separate `thinking` blocks.
 *     Codex stores them as `reasoning` items. Same concept, three
 *     wire formats.
 *   - `toolCalls: [{ id, name, args, result, status, displayName,
 *     description, ... }]` — tool calls AND their results in one
 *     record (Claude / Codex split the call from the result; Gemini
 *     bundles them). We split here for outline parity so segments
 *     read consistently across CLIs.
 */

import {
  MAX_EXCERPT_CHARS,
  type SessionOutline,
  type SessionStep,
  type SessionStepKind,
} from '../../outline/types';
import { groupIntoSegments } from '../../outline/grouping';

interface GeminiMessage {
  id?: string;
  timestamp?: string;
  type?: 'user' | 'gemini' | string;
  content?: string;
  thoughts?: Array<{
    subject?: string;
    description?: string;
    timestamp?: string;
  }>;
  toolCalls?: Array<{
    id?: string;
    name?: string;
    args?: unknown;
    result?: unknown;
    status?: string;
    displayName?: string;
    resultDisplay?: string;
  }>;
}

interface GeminiSession {
  sessionId?: string;
  projectHash?: string;
  startTime?: string;
  messages?: GeminiMessage[];
}

function shorten(text: string): string {
  if (typeof text !== 'string') return '';
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (trimmed.length <= MAX_EXCERPT_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_EXCERPT_CHARS)}…(+${trimmed.length - MAX_EXCERPT_CHARS} more)`;
}

/**
 * Stringify a Gemini tool result. The wire format puts the result
 * under `result: [{ functionResponse: { response: { output: "..." }
 * }}]` for the main case, but other branches embed structured data
 * directly. Prefer `resultDisplay` (renderer-formatted) when present,
 * else extract the function response output, else fall back to a
 * JSON dump.
 */
function readToolResult(call: {
  result?: unknown;
  resultDisplay?: string;
}): string {
  if (typeof call.resultDisplay === 'string' && call.resultDisplay.trim()) {
    return call.resultDisplay;
  }
  if (Array.isArray(call.result)) {
    const outputs = call.result
      .map((r) => {
        if (!r || typeof r !== 'object') return '';
        const fr = (r as { functionResponse?: { response?: unknown } })
          .functionResponse?.response;
        if (fr && typeof fr === 'object' && 'output' in fr) {
          const o = (fr as { output?: unknown }).output;
          return typeof o === 'string' ? o : JSON.stringify(o);
        }
        return JSON.stringify(r);
      })
      .filter(Boolean)
      .join('\n');
    if (outputs) return outputs;
  }
  if (call.result === undefined) return '';
  try {
    return JSON.stringify(call.result);
  } catch {
    return '';
  }
}

export function extractGeminiOutline(args: {
  raw: string;
  sourceSessionId: string;
  cwd: string;
  language?: 'en' | 'ko';
}): SessionOutline {
  const { raw, sourceSessionId, cwd, language } = args;
  let session: GeminiSession;
  try {
    session = JSON.parse(raw) as GeminiSession;
  } catch {
    // Malformed file: produce an empty outline so callers can still
    // render an "outline unavailable" placeholder rather than crashing.
    return {
      toolId: 'gemini',
      sourceSessionId,
      cwd,
      steps: [],
      segments: groupIntoSegments([]),
      generatedAt: new Date().toISOString(),
      language,
    };
  }

  const steps: SessionStep[] = [];
  let turnIndex = -1;
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
      excerpt: shorten(excerpt),
      timestamp: extras.timestamp,
    });
  };

  const messages = Array.isArray(session.messages) ? session.messages : [];
  for (const m of messages) {
    const ts = typeof m.timestamp === 'string' ? m.timestamp : undefined;

    if (m.type === 'user') {
      const text = typeof m.content === 'string' ? m.content : '';
      if (!text.trim()) continue;
      turnIndex += 1;
      blockIndex = 0;
      push('user-instruction', text, { timestamp: ts });
      continue;
    }

    if (m.type !== 'gemini') {
      // Unknown role: classify as meta so it shows up in the outline
      // without breaking segment grouping.
      const text = typeof m.content === 'string' ? m.content : '';
      push('meta', `${m.type ?? '?'}: ${text}`, { timestamp: ts });
      continue;
    }

    // Order: thinking → tool calls (with their results immediately
    // after) → assistant text. Gemini doesn't actually serialise the
    // ordering explicitly; this convention matches how Claude/Codex
    // outlines read.
    if (Array.isArray(m.thoughts)) {
      for (const t of m.thoughts) {
        const subject = typeof t.subject === 'string' ? t.subject : '';
        const desc = typeof t.description === 'string' ? t.description : '';
        if (!subject && !desc) continue;
        push(
          'thinking',
          subject && desc ? `${subject}: ${desc}` : subject || desc,
          { timestamp: typeof t.timestamp === 'string' ? t.timestamp : ts },
        );
      }
    }

    if (Array.isArray(m.toolCalls)) {
      for (const call of m.toolCalls) {
        const name =
          typeof call.name === 'string'
            ? call.name
            : typeof call.displayName === 'string'
              ? call.displayName
              : undefined;
        let argsExcerpt = '';
        try {
          argsExcerpt =
            call.args === undefined ? '' : JSON.stringify(call.args);
        } catch {
          argsExcerpt = '';
        }
        push('tool-call', argsExcerpt, { toolName: name, timestamp: ts });
        const out = readToolResult({
          result: call.result,
          resultDisplay: call.resultDisplay,
        });
        if (out) push('tool-result', out, { toolName: name, timestamp: ts });
      }
    }

    const content = typeof m.content === 'string' ? m.content.trim() : '';
    if (content) push('assistant-text', content, { timestamp: ts });
  }

  return {
    toolId: 'gemini',
    sourceSessionId,
    cwd,
    steps,
    segments: groupIntoSegments(steps),
    generatedAt: new Date().toISOString(),
    language,
  };
}
