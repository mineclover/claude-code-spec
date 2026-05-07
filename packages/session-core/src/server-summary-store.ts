/**
 * Sub-path entry that re-exports the on-disk summary store.
 *
 * Server-only — uses node:fs. Renderers consume `SummaryRecord` from
 * the main barrel and call `listSummaries` etc. through the host
 * adapter, never touching the file system directly.
 */

export {
  saveSummary,
  listSummaries,
  getSummary,
  deleteSummary,
} from './server/summary-store';
