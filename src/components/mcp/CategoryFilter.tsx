/**
 * CategoryFilter
 *
 * A small text input that emits the user's substring query upward. Hosted by
 * the Registry and Policy pages above their respective category-grouped
 * lists. Stateless — the parent owns the query string and applies it via
 * `filterEntries`.
 */

import type React from 'react';
import styles from './CategoryFilter.module.css';

interface CategoryFilterProps {
  query: string;
  onQueryChange: (next: string) => void;
  /** Optional placeholder; defaults to "Filter by id, name, category…". */
  placeholder?: string;
  /** Optional inline match-count summary (e.g. "12 / 30"). */
  resultLabel?: string;
}

export function CategoryFilter({
  query,
  onQueryChange,
  placeholder = 'Filter by id, name, category…',
  resultLabel,
}: CategoryFilterProps): React.JSX.Element {
  return (
    <div className={styles.wrapper}>
      <input
        type="text"
        className={styles.input}
        value={query}
        placeholder={placeholder}
        onChange={(e) => onQueryChange(e.target.value)}
        aria-label="Filter MCP entries"
      />
      {query.length > 0 && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={() => onQueryChange('')}
          aria-label="Clear filter"
          title="Clear"
        >
          ×
        </button>
      )}
      {resultLabel && <span className={styles.resultLabel}>{resultLabel}</span>}
    </div>
  );
}
