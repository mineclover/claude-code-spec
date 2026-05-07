/**
 * Sub-path entry that re-exports the multi-CLI readers.
 *
 * Server-only — pulls in node:fs/path/os via prefixHashing/cacheMetrics
 * dependency chain. Keep off the main barrel so the renderer's bundle
 * stays browser-clean.
 */

export {
  claudeReader,
  dashEncodeCwd,
  readClaudeSessionRaw,
} from './server/readers/claudeReader';
export { codexReader } from './server/readers/codexReader';
export { geminiReader } from './server/readers/geminiReader';
export type { CliSessionReader, ProjectScan } from './server/readers/types';
export {
  invalidateCache,
  listProjects,
  listSessions,
  resolveSession,
  type ResolvedSession,
} from './server/session-reader';
