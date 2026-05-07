/**
 * Sub-path entry that re-exports the on-disk outline store. Mirrors
 * `server-summary-store.ts` so consumers can import only the file-IO
 * surface (which pulls node:fs) instead of the full server bundle.
 */

export {
  saveOutline,
  listOutlines,
  getOutline,
  deleteOutline,
} from './server/outline-store';
export type { ListOutlinesFilter } from './server/outline-store';
