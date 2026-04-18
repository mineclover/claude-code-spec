/**
 * MCP registry entry — pure sanitization and parsing.
 *
 * This module is I/O-free: it accepts already-loaded JSON strings or
 * arbitrary `unknown` values and returns validated, narrowed shapes.
 * Callers (IPC handlers, resolver service) are responsible for reading
 * the bytes off disk and passing them in.
 */

import type { McpEntryScope } from '../../types/api/mcp';
import type {
  McpRegistryEntry,
  McpRegistryFile,
} from '../../types/mcp-policy';

/**
 * Validate and narrow an arbitrary value into an `McpRegistryEntry`.
 *
 * Rules:
 *   - `id` must be a non-empty string.
 *   - `command` must be a non-empty string.
 *   - `args` is coerced to string[]; non-string items are dropped.
 *   - `env` is coerced to Record<string,string>; non-string values are dropped.
 *     Missing or non-object `env` becomes `undefined`.
 *   - `type` must be one of 'stdio' | 'http' | 'sse'; otherwise undefined.
 *   - `name`, `category`, `description` pass through only if strings.
 *   - `scope` is taken from the caller argument, NOT the input (so that
 *     the loaded scope always matches where the file was read from).
 *
 * Returns `null` if the required invariants (id, command) aren't met.
 */
export function sanitizeRegistryEntry(
  input: unknown,
  scope: McpEntryScope,
): McpRegistryEntry | null {
  if (!input || typeof input !== 'object') return null;
  const e = input as Record<string, unknown>;
  if (typeof e.id !== 'string' || !e.id) return null;
  if (typeof e.command !== 'string' || !e.command) return null;
  const args = Array.isArray(e.args) ? e.args.filter((a) => typeof a === 'string') : [];
  const envRaw = e.env && typeof e.env === 'object' ? (e.env as Record<string, unknown>) : null;
  const env = envRaw
    ? Object.fromEntries(
        Object.entries(envRaw).filter(([, v]) => typeof v === 'string') as [string, string][],
      )
    : undefined;
  const type =
    e.type === 'stdio' || e.type === 'http' || e.type === 'sse'
      ? (e.type as 'stdio' | 'http' | 'sse')
      : undefined;
  return {
    id: e.id,
    name: typeof e.name === 'string' ? e.name : undefined,
    type,
    command: e.command,
    args: args as string[],
    env,
    category: typeof e.category === 'string' ? e.category : undefined,
    description: typeof e.description === 'string' ? e.description : undefined,
    scope,
  };
}

/**
 * Parse the raw JSON contents of an `mcp-registry.json` file into a
 * validated `McpRegistryFile`. Returns `null` when the JSON is malformed
 * or the top-level shape is not recognizable (no `entries` array).
 *
 * Each entry is sanitized with a default scope of `'user'`. Callers that
 * need project-scope entries are expected to re-scope via spread during
 * merge (matching the historical behavior in `McpResolverService`).
 */
export function parseRegistryFileContent(raw: string): McpRegistryFile | null {
  let parsed: Partial<McpRegistryFile>;
  try {
    parsed = JSON.parse(raw) as Partial<McpRegistryFile>;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  if (!Array.isArray(parsed.entries)) return null;
  const entries: McpRegistryEntry[] = [];
  for (const item of parsed.entries) {
    const sanitized = sanitizeRegistryEntry(item, 'user');
    if (sanitized) entries.push(sanitized);
  }
  return { schemaVersion: 1, entries };
}
