/**
 * Hashing and canonicalization utilities for prefix fingerprinting.
 *
 * Stability rules:
 *   - JSON keys are sorted recursively before hashing, so map-ordering noise
 *     never produces false drift.
 *   - String inputs are hashed verbatim (no whitespace normalization) so
 *     content changes that matter to the CLI are reflected.
 *   - The "empty" hash (for absent components) is the empty string "", which
 *     is easy to distinguish from a zero-byte file hash when debugging.
 */

import { createHash } from 'node:crypto';

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Hash a list of strings in a stable, order-independent way. */
export function sha256OfSortedList(values: readonly string[]): string {
  if (values.length === 0) return '';
  const sorted = [...values].sort();
  return sha256Hex(sorted.join('\n'));
}

/** Deterministically serialize an unknown value with sorted object keys. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      out[k] = sortKeysDeep(v);
    }
    return out;
  }
  return value;
}

/** Hash a JSON-compatible value using canonical serialization. */
export function sha256OfCanonicalJson(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

/**
 * Hash a set of (identifier, content) pairs so that both the names and the
 * contents contribute. Identifiers are sorted; content is appended delimited.
 */
export function sha256OfNamedContents(items: readonly { id: string; content: string }[]): string {
  if (items.length === 0) return '';
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const hasher = createHash('sha256');
  for (const { id, content } of sorted) {
    hasher.update(id);
    hasher.update('\0');
    hasher.update(content);
    hasher.update('\n---\n');
  }
  return hasher.digest('hex');
}
