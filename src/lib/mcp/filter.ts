/**
 * Substring filtering for MCP registry entries.
 *
 * Used by the Registry and Policy pages to narrow long lists. Pure: case-
 * insensitive match against the entry's id, name, category, and description
 * (the four fields a user would scan to find a server).
 */

import type { McpRegistryEntry } from '../../types/mcp-policy';

/**
 * Returns the subset of `entries` whose id, name, category, or description
 * contains `query` (case-insensitive). An empty / whitespace-only query
 * matches every entry.
 */
export function filterEntries(
  entries: readonly McpRegistryEntry[],
  query: string,
): McpRegistryEntry[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return [...entries];
  return entries.filter((entry) => {
    if (entry.id.toLowerCase().includes(trimmed)) return true;
    if (entry.name && entry.name.toLowerCase().includes(trimmed)) return true;
    if (entry.category && entry.category.toLowerCase().includes(trimmed)) return true;
    if (entry.description && entry.description.toLowerCase().includes(trimmed)) return true;
    return false;
  });
}
