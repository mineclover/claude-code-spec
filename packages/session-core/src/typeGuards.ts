/**
 * Runtime type guards used across the codebase.
 *
 * Historically these were redefined inside every caller that needed them.
 * Centralizing improves discoverability and lets both of the common variants
 * ("is any object" vs "is a plain object, not an array") be picked
 * deliberately rather than by accident.
 */

/**
 * `true` for any non-null object, including arrays. Matches the behavior of
 * `typeof value === 'object' && value !== null`. Prefer {@link isPlainObject}
 * when you want to reject arrays.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * `true` for non-null objects that are not arrays. Use this when parsing a
 * "map-like" JSON shape where an array would be wrong.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
