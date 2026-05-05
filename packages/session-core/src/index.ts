/**
 * @context-action/session-core
 *
 * Cache-preserving session analytics primitives.
 *
 * - prefix-hashing: deterministic content-addressable hashing for cache invariants
 * - cacheMetrics: cache_read / cache_write / cache_creation reducer
 * - observedFingerprint: extract and diff prefix fingerprints from system/init
 * - session: addressing, event signal extraction, project-level aggregation
 * - sessionPathResolver: cwd/projectPath inference from event records
 * - typeGuards: shared runtime guards
 *
 * All modules are Electron-free; node:fs/path/crypto are the only environment
 * dependencies (works under Bun, Node, and Electrobun).
 */

// Prefix hashing primitives
export {
  canonicalJson,
  sha256Hex,
  sha256OfCanonicalJson,
  sha256OfNamedContents,
  sha256OfSortedList,
} from './prefixHashing';

// Cache metrics reducer
export {
  aggregateCacheMetrics,
  emptyCacheMetrics,
  updateCacheMetrics,
} from './cacheMetrics';

// Observed-side fingerprint extraction + drift detection
export { detectDrift, extractObservedFingerprint } from './observedFingerprint';

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

// Session path resolution
export {
  extractSessionPathFromEvent,
  inferProjectPathFromDashDirName,
  resolveSessionPath,
  type SessionPathResolutionInput,
} from './sessionPathResolver';

// Runtime type guards
export { isPlainObject, isRecord } from './typeGuards';

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
