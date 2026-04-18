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
  /**
   * 1-based position of this tool_use inside the originating JSONL entry's
   * `message.content` array. Used as the `M` in the `#N.M` address so sub
   * references stay stable even when text/thinking blocks sit between
   * consecutive tool_use blocks.
   */
  blockIndex: number;
}

export interface ToolResultInfo {
  toolUseId: string;
  content: string;
  /** Same semantics as ToolCallInfo.blockIndex but inside a user entry. */
  blockIndex: number;
}

export interface HookInvocation {
  command: string;
  durationMs: number;
  error?: string;
}

export interface HookSummaryInfo {
  /** e.g. "stop", "pre_tool_use" — derived from the subtype prefix. */
  phase: string;
  hooks: HookInvocation[];
  errors: string[];
  preventedContinuation: boolean;
  stopReason?: string;
  totalDurationMs: number;
}

export interface ClassifiedEntry {
  speaker: Speaker;
  outputType: OutputType;
  textContent?: string;
  toolCalls?: ToolCallInfo[];
  toolResults?: ToolResultInfo[];
  thinkingContent?: string;
  hookSummary?: HookSummaryInfo;
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

  // System init (stream-json only; internal JSONL does not emit this)
  if (entry.type === 'system' && entry.subtype === 'init') {
    const parts: string[] = [];
    if (entry.model) parts.push(`Model: ${entry.model}`);
    if (entry.session_id) parts.push(`Session: ${String(entry.session_id).substring(0, 8)}`);
    if (entry.permissionMode) parts.push(`Permissions: ${entry.permissionMode}`);
    base.textContent = parts.join(' | ') || 'System init';
    return base;
  }

  // Hook summary events carry structured per-hook detail — populate
  // hookSummary so the UI can render commands/durations/errors as a block.
  if (
    entry.type === 'system' &&
    typeof entry.subtype === 'string' &&
    entry.subtype.endsWith('_hook_summary')
  ) {
    const summary = extractHookSummary(entry);
    base.hookSummary = summary;
    base.textContent =
      `${summary.phase} hooks: ${summary.hooks.length}` +
      (summary.totalDurationMs ? ` (${summary.totalDurationMs}ms)` : '') +
      (summary.errors.length ? ` — ${summary.errors.length} error(s)` : '') +
      (summary.preventedContinuation ? ' — BLOCKED' : '');
    return base;
  }

  // Other system subtypes found in the internal JSONL log.
  if (entry.type === 'system' && typeof entry.subtype === 'string') {
    base.textContent = summarizeSystemSubtype(entry);
    return base;
  }

  // File history snapshot: size of tracked backups is the only useful signal.
  if (entry.type === 'file-history-snapshot') {
    const snapshot = entry.snapshot as { trackedFileBackups?: Record<string, unknown> } | undefined;
    const count = snapshot?.trackedFileBackups
      ? Object.keys(snapshot.trackedFileBackups).length
      : 0;
    base.textContent = `File snapshot: ${count} tracked`;
    return base;
  }

  // Last-prompt marker written by the CLI between turns.
  if (entry.type === 'last-prompt') {
    const lastPrompt = typeof entry.lastPrompt === 'string' ? entry.lastPrompt : '';
    const preview = lastPrompt.trim().replace(/\s+/g, ' ').slice(0, 100);
    base.textContent = preview
      ? `Last prompt: ${preview}${lastPrompt.length > 100 ? '…' : ''}`
      : 'Last prompt';
    return base;
  }

  // Permission-mode change events.
  if (entry.type === 'permission-mode') {
    base.textContent = `Permission: ${entry.permissionMode ?? 'unknown'}`;
    return base;
  }

  // Attachment events (tool/skill metadata deltas, hook results).
  if (entry.type === 'attachment') {
    base.textContent = summarizeAttachment(entry.attachment);
    return base;
  }

  // Result event
  if (entry.type === 'result') {
    const parts: string[] = [];
    if (entry.subtype) parts.push(`Status: ${entry.subtype}`);
    if (entry.duration_ms != null) parts.push(`Duration: ${Number(entry.duration_ms) / 1000}s`);
    if (entry.num_turns != null) parts.push(`Turns: ${entry.num_turns}`);
    if (entry.total_cost_usd != null)
      parts.push(`Cost: $${Number(entry.total_cost_usd).toFixed(4)}`);
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
      // Check if it's a tool_result (array content). blockIndex preserves the
      // item's position in the original content array so `#N.M` matches the
      // JSONL layout regardless of any non-tool_result blocks mixed in.
      if (Array.isArray(message.content)) {
        base.speaker = 'human';
        base.outputType = 'tool-output';
        const contentArr = message.content as Array<{
          type?: string;
          tool_use_id?: string;
          content?: unknown;
        }>;
        const results: ToolResultInfo[] = [];
        for (let i = 0; i < contentArr.length; i++) {
          const c = contentArr[i];
          if (c.type !== 'tool_result') continue;
          results.push({
            toolUseId: c.tool_use_id || '',
            content: typeof c.content === 'string' ? c.content : JSON.stringify(c.content),
            blockIndex: i + 1,
          });
        }
        base.toolResults = results;
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

    const message = entry.message as
      | { content?: Array<{ type: string; [key: string]: unknown }> }
      | undefined;
    const content = message?.content;
    if (!content || !Array.isArray(content)) {
      base.outputType = 'answer';
      base.textContent = '';
      return base;
    }

    // Parse all content blocks. blockIndex on each tool_use records the
    // block's position in the original content array so `#N.M` addresses
    // reference the JSONL layout rather than the filtered tool list.
    const textParts: string[] = [];
    const toolCalls: ToolCallInfo[] = [];
    let thinkingContent = '';

    for (let i = 0; i < content.length; i++) {
      const block = content[i];
      if (block.type === 'text') {
        textParts.push(block.text as string);
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name as string,
          id: block.id as string,
          input: (block.input as Record<string, unknown>) || {},
          blockIndex: i + 1,
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

  // Fallback: tag the event type so the user sees a stable label instead of
  // a JSON prefix that looks truncated. Full JSON is always reachable via
  // the raw-expand toggle in ClassifiedLogEntry.
  const kind = typeof entry.type === 'string' ? entry.type : 'unknown';
  base.textContent = `Unclassified event (type=${kind})`;
  return base;
}

/**
 * Parse {type: 'system', subtype: '<phase>_hook_summary'} into the structured
 * shape the UI renders. Each hook in `hookInfos` is normalized; any
 * `hookErrors` entries are surfaced separately so failures are not buried
 * inside the JSON.
 */
function extractHookSummary(entry: ClaudeSessionEntry): HookSummaryInfo {
  const subtype = String(entry.subtype ?? '');
  const phase = subtype.replace(/_hook_summary$/, '').replace(/_/g, ' ') || 'hook';
  const rawHooks = Array.isArray(entry.hookInfos) ? entry.hookInfos : [];
  const rawErrors = Array.isArray(entry.hookErrors) ? entry.hookErrors : [];
  const hooks: HookInvocation[] = [];
  let totalDurationMs = 0;
  for (const item of rawHooks) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const command = typeof rec.command === 'string' ? rec.command : '';
    const durationMs = typeof rec.durationMs === 'number' ? rec.durationMs : 0;
    const error = typeof rec.error === 'string' && rec.error ? rec.error : undefined;
    totalDurationMs += durationMs;
    hooks.push({ command, durationMs, error });
  }
  const errors = rawErrors
    .map((e) => (typeof e === 'string' ? e : typeof e === 'object' && e ? JSON.stringify(e) : ''))
    .filter(Boolean);
  return {
    phase,
    hooks,
    errors,
    preventedContinuation: entry.preventedContinuation === true,
    stopReason:
      typeof entry.stopReason === 'string' && entry.stopReason ? entry.stopReason : undefined,
    totalDurationMs,
  };
}

/**
 * Human-readable one-liners for the {type: 'system', subtype: X} shapes that
 * appear in the internal JSONL log. Unknown subtypes fall back to a stable
 * label — raw JSON is still available via the entry's expand toggle.
 */
function summarizeSystemSubtype(entry: ClaudeSessionEntry): string {
  const subtype = String(entry.subtype);
  switch (subtype) {
    case 'turn_duration': {
      const ms = typeof entry.durationMs === 'number' ? entry.durationMs : 0;
      const messages = typeof entry.messageCount === 'number' ? entry.messageCount : 0;
      const seconds = (ms / 1000).toFixed(1);
      return `Turn: ${seconds}s, ${messages} messages`;
    }
    default:
      return `system/${subtype}`;
  }
}

/**
 * attachment entries wrap diverse payloads; the distinguishing field is
 * attachment.type. A short summary per known kind keeps the log scannable.
 */
function summarizeAttachment(attachment: unknown): string {
  if (!attachment || typeof attachment !== 'object') return 'attachment';
  const a = attachment as Record<string, unknown>;
  const type = typeof a.type === 'string' ? a.type : 'attachment';
  switch (type) {
    case 'deferred_tools_delta': {
      const added = Array.isArray(a.addedNames) ? a.addedNames.length : 0;
      const removed = Array.isArray(a.removedNames) ? a.removedNames.length : 0;
      return `Tools delta: +${added} / -${removed}`;
    }
    case 'skill_listing': {
      const content = typeof a.content === 'string' ? a.content : '';
      const count = content
        ? content.split('\n').filter((l) => l.trim().startsWith('-')).length
        : 0;
      return `Skill listing: ${count} skills`;
    }
    case 'hook_success': {
      const hookName = typeof a.hookName === 'string' ? a.hookName : 'hook';
      return `Hook success: ${hookName}`;
    }
    case 'hook_failure': {
      const hookName = typeof a.hookName === 'string' ? a.hookName : 'hook';
      return `Hook failure: ${hookName}`;
    }
    default:
      return `attachment/${type}`;
  }
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
    base.textContent =
      typeof entry.content === 'string'
        ? entry.content
        : JSON.stringify(entry.content ?? entry, null, 2).substring(0, 500);
    return base;
  }

  // event_msg → agent/answer
  if (entry.type === 'event_msg') {
    base.speaker = 'agent';
    base.outputType = 'answer';
    base.textContent =
      typeof entry.content === 'string'
        ? entry.content
        : typeof entry.message === 'string'
          ? entry.message
          : JSON.stringify(entry, null, 2).substring(0, 500);
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
      textContent:
        typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content),
      rawEntry: entry,
    };
  }

  if (entry.type === 'assistant') {
    return {
      speaker: 'agent',
      outputType: 'answer',
      textContent:
        typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content),
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
