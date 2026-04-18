/**
 * MCP preset — pure sanitization.
 *
 * A preset is a named, reusable execution override. Sanitization:
 *   - `id` and `name` must both be non-empty strings.
 *   - `override.add` / `override.remove` coerced to string[]; non-string
 *     items are dropped. Missing or non-object `override` becomes
 *     `{ add: [], remove: [] }`.
 *   - `createdAt` kept only if a number; otherwise defaulted to `Date.now()`.
 */

import type { McpPreset } from '../../types/mcp-policy';

export function sanitizePreset(input: unknown): McpPreset | null {
  if (!input || typeof input !== 'object') return null;
  const e = input as Record<string, unknown>;
  if (typeof e.id !== 'string' || !e.id) return null;
  if (typeof e.name !== 'string' || !e.name) return null;
  const override =
    e.override && typeof e.override === 'object' ? (e.override as Record<string, unknown>) : {};
  const add = Array.isArray(override.add)
    ? (override.add as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  const remove = Array.isArray(override.remove)
    ? (override.remove as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  const createdAt = typeof e.createdAt === 'number' ? e.createdAt : Date.now();
  return { id: e.id, name: e.name, override: { add, remove }, createdAt };
}

export function sanitizePresets(input: unknown[]): McpPreset[] {
  const out: McpPreset[] = [];
  for (const item of input) {
    const p = sanitizePreset(item);
    if (p) out.push(p);
  }
  return out;
}
