/**
 * CategoryGroupedList — generic rendering shell for category-grouped item lists.
 *
 * Extracted from McpRegistryPage, McpPolicyPage, and McpComposePanel, which
 * each duplicated the same outer loop: iterate groups, emit a header, then
 * iterate entries. Row DOM differs across consumers (button, checkbox row,
 * grid row), so the component parameterizes item rendering via `renderItem`
 * while unifying the grouping container + header.
 *
 * The component supplies default styling for the group wrapper and header via
 * its own CSS module. Consumers may override by passing `groupClassName`,
 * `headerClassName`, or a full `renderHeader` callback.
 */
import { Fragment, type ReactElement, type ReactNode } from 'react';
import type { CategorizedItem, CategoryGroup } from '../../lib/mcp/grouping';
import styles from './CategoryGroupedList.module.css';

export interface CategoryGroupedListProps<T extends CategorizedItem> {
  groups: CategoryGroup<T>[];
  renderItem: (item: T, groupCategory: string) => ReactNode;
  /** Custom header renderer. If omitted, a default <h4> with the default header class is used. */
  renderHeader?: (category: string) => ReactNode;
  /** Override the default key extractor (defaults to item.id). */
  keyFn?: (item: T) => string;
  /** Class applied to the group wrapper <div>. Defaults to the module's `group`. */
  groupClassName?: string;
  /** Class applied to the default header. Ignored when `renderHeader` is provided. */
  headerClassName?: string;
  /** Shown when `groups` is empty. When omitted, nothing is rendered for an empty list. */
  emptyMessage?: ReactNode;
}

export function CategoryGroupedList<T extends CategorizedItem>(
  props: CategoryGroupedListProps<T>,
): ReactElement | null {
  const {
    groups,
    renderItem,
    renderHeader,
    keyFn,
    groupClassName,
    headerClassName,
    emptyMessage,
  } = props;

  if (groups.length === 0) {
    return emptyMessage !== undefined ? <>{emptyMessage}</> : null;
  }

  const resolvedGroupClass = groupClassName ?? styles.group;
  const resolvedHeaderClass = headerClassName ?? styles.groupHeader;
  const getKey = keyFn ?? ((item: T) => item.id);

  return (
    <>
      {groups.map((group) => (
        <div key={group.category} className={resolvedGroupClass}>
          {renderHeader ? (
            renderHeader(group.category)
          ) : (
            <h4 className={resolvedHeaderClass}>{group.category}</h4>
          )}
          {group.entries.map((entry) => (
            <Fragment key={getKey(entry)}>{renderItem(entry, group.category)}</Fragment>
          ))}
        </div>
      ))}
    </>
  );
}
