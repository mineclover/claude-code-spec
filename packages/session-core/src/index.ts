/**
 * @context-action/session-core — main entry (browser-safe).
 *
 * This file deliberately omits modules that depend on Node builtins
 * (`node:crypto`, `node:fs`, `node:path`) so it can be imported from a
 * webview/renderer bundle without tripping over Vite/Rolldown's externalized
 * stubs. Node-only modules live behind subpath exports:
 *
 *   - `@context-action/session-core/hash`        — sha256/canonicalJson primitives
 *   - `@context-action/session-core/fingerprint` — observed fingerprint + drift
 *
 * Importers that need the hashing/fingerprint helpers (e.g. the bun-side
 * session reader) should pull from those subpaths directly.
 */

// Cache metrics reducer (pure)
export {
  aggregateCacheMetrics,
  emptyCacheMetrics,
  updateCacheMetrics,
} from './cacheMetrics';

// Domain types (prefix fingerprint + session meta + view)
export type {
  CacheMetrics,
  DerivedSessionMeta,
  FingerprintDrift,
  FingerprintPair,
  ObservedComponentHashes,
  ObservedFingerprint,
  SessionMeta,
  SessionMetaView,
  StaticComponentHashes,
  StaticFingerprint,
} from './types/prefix-fingerprint';

// Session addressing (#N or #N.k)
export {
  entryDomId,
  formatAddress,
  parseAddress,
  type SessionAddress,
} from './session/address';

// Pure event-record signal extractors
export {
  extractCwd,
  extractModel,
  extractToolDelta,
  type ToolDelta,
} from './session/events';

// Project-level aggregation
export {
  aggregateSessionMetas,
  compareMcpOverrides,
  groupByFingerprint,
  trendByTime,
  type McpOverrideBucket,
  type McpOverrideComparison,
  type ProjectAggregate,
  type TrendMetric,
  type TrendPoint,
} from './session/aggregate';

// Session path resolution (pure string parsing)
export {
  extractSessionPathFromEvent,
  inferProjectPathFromDashDirName,
  resolveSessionPath,
  type SessionPathResolutionInput,
} from './sessionPathResolver';

// Runtime type guards
export { isPlainObject, isRecord } from './typeGuards';

// Branched-summary contract — shape of what `branch()` resolves to.
export type {
  SummaryCacheInvariants,
  SummaryDecision,
  SummaryLanguage,
  SummaryNextAction,
  SummaryOpenItem,
  SummaryReference,
  SummaryResult,
} from './summary/types';

// Portable types shared between server-side modules and renderer adapters.
export type {
  ListSummariesFilter,
  ProjectListItem,
  SummaryRecord,
} from './types/portable';

// Interpreter registry (Claude / Codex / Gemini stream parsers)
export { ClaudeInterpreter } from './interpreters/ClaudeInterpreter';
export { CodexInterpreter } from './interpreters/CodexInterpreter';
export { GeminiInterpreter } from './interpreters/GeminiInterpreter';
export {
  getInterpreter,
  getRegisteredInterpreterTypes,
  registerInterpreter,
} from './interpreters/index';
export type { CLIToolInterpreter } from './interpreters/types';
