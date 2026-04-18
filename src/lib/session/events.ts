/**
 * Pure signal extractors for internal-format CLI session JSONL events.
 *
 * The internal JSONL emitted by Claude / Codex / Gemini has stable shapes for
 * a few pieces of information we care about:
 *
 *   - `assistant.message.model`                → the model id
 *   - `attachment.deferred_tools_delta.{add,remove}Names` → tool set deltas
 *   - top-level `cwd` on most events           → project path
 *
 * These helpers are exported as pure functions (no I/O) so both the batch
 * {@link ../../services/SessionAnalyticsService.SessionAnalyticsService}
 * and any future caller (e.g. a fingerprint refiner, an ad-hoc CLI
 * inspector) can reuse the same extraction without re-parsing JSONL.
 */

export interface ToolDelta {
  added: string[];
  removed: string[];
}

/**
 * Extract an added/removed tool-name delta from an `attachment` event of
 * subtype `deferred_tools_delta`. Returns null if the event is not a tool
 * delta or both lists are empty.
 */
export function extractToolDelta(event: Record<string, unknown>): ToolDelta | null {
  const att = event.attachment;
  if (!att || typeof att !== 'object') return null;
  const attachment = att as Record<string, unknown>;
  if (attachment.type !== 'deferred_tools_delta') return null;
  const added = Array.isArray(attachment.addedNames)
    ? (attachment.addedNames.filter((v) => typeof v === 'string') as string[])
    : [];
  const removed = Array.isArray(attachment.removedNames)
    ? (attachment.removedNames.filter((v) => typeof v === 'string') as string[])
    : [];
  if (added.length === 0 && removed.length === 0) return null;
  return { added, removed };
}

/**
 * Extract the assistant model id from an `assistant` event. Returns null for
 * other event types or when the shape doesn't match.
 */
export function extractModel(event: Record<string, unknown>): string | null {
  if (event.type !== 'assistant') return null;
  const message = event.message;
  if (!message || typeof message !== 'object') return null;
  const model = (message as Record<string, unknown>).model;
  return typeof model === 'string' ? model : null;
}

/**
 * Extract cwd from any event that carries one at the top level. Empty or
 * whitespace-only strings are treated as absent.
 */
export function extractCwd(event: Record<string, unknown>): string | null {
  const cwd = event.cwd;
  return typeof cwd === 'string' && cwd.trim() ? cwd : null;
}
