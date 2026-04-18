/**
 * Session log entry addressing.
 *
 * Entries in a session log are referenced by `#N` (top-level entry) or
 * `#N.k` (k-th block within entry N — typically a tool call or tool result).
 * Both `N` and `k` are 1-based to match the on-screen labels rendered by
 * `ClassifiedLogEntry`.
 *
 * Pure parsing/formatting only — no DOM, no electron.
 */

export interface SessionAddress {
  entryIndex: number;
  blockIndex?: number;
}

const PATTERN = /^\s*#?\s*(\d+)(?:\.(\d+))?\s*$/;

/**
 * Parse a user-typed address. Accepts `#3`, `3`, `#3.2`, `3.2`. Whitespace is
 * tolerated. Returns `null` for any other shape (including negative numbers,
 * trailing junk, or zero — addresses are 1-based).
 */
export function parseAddress(input: string): SessionAddress | null {
  if (typeof input !== 'string' || input.length === 0) return null;
  const match = PATTERN.exec(input);
  if (!match) return null;

  const entryIndex = Number.parseInt(match[1], 10);
  if (!Number.isFinite(entryIndex) || entryIndex < 1) return null;

  if (match[2] === undefined) {
    return { entryIndex };
  }

  const blockIndex = Number.parseInt(match[2], 10);
  if (!Number.isFinite(blockIndex) || blockIndex < 1) return null;
  return { entryIndex, blockIndex };
}

/**
 * Render an address back to its canonical `#N` or `#N.k` string.
 * Throws on invalid input — callers should validate via `parseAddress` first
 * if they're forwarding user input.
 */
export function formatAddress(entryIndex: number, blockIndex?: number): string {
  if (!Number.isFinite(entryIndex) || entryIndex < 1) {
    throw new RangeError(`entryIndex must be a positive integer, got ${entryIndex}`);
  }
  if (blockIndex === undefined) return `#${entryIndex}`;
  if (!Number.isFinite(blockIndex) || blockIndex < 1) {
    throw new RangeError(`blockIndex must be a positive integer, got ${blockIndex}`);
  }
  return `#${entryIndex}.${blockIndex}`;
}

/**
 * DOM id used to anchor the entry header for scroll-into-view. Kept in this
 * module so the producer (ClassifiedLogEntry) and the consumer (jump input)
 * stay in agreement.
 */
export function entryDomId(entryIndex: number, blockIndex?: number): string {
  return blockIndex === undefined
    ? `session-entry-${entryIndex}`
    : `session-entry-${entryIndex}-${blockIndex}`;
}
