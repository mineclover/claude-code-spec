/**
 * Category-based grouping for registry-like entities.
 *
 * Extracted from McpRegistryPage, McpPolicyPage, and McpComposePanel, which
 * each duplicated the same groupByCategory logic.
 *
 * Generic over any item shape with an optional `category` string. Items with
 * a missing/blank category fall into the synthetic group `uncategorized`.
 * Groups are sorted by category name; items within each group by id.
 */

export interface CategorizedItem {
  id: string;
  category?: string;
}

export interface CategoryGroup<T extends CategorizedItem> {
  category: string;
  entries: T[];
}

const UNCATEGORIZED = 'uncategorized';

export function groupByCategory<T extends CategorizedItem>(items: readonly T[]): CategoryGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.category?.trim() || UNCATEGORIZED;
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([category, list]) => ({
      category,
      entries: list.slice().sort((a, b) => (a.id < b.id ? -1 : 1)),
    }));
}
