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
} from './agents/claude/reader';
export {
  codexReader,
  readCodexSessionRaw,
} from './agents/codex/reader';
export {
  geminiReader,
  readGeminiSessionRaw,
} from './agents/gemini/reader';
export type { CliSessionReader, ProjectScan } from './agents/types';
export {
  invalidateCache,
  listProjects,
  listSessions,
  resolveSession,
  type ResolvedSession,
} from './server/session-reader';
