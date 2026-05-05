/**
 * Prefix Fingerprint types.
 *
 * The fingerprint identifies a Claude CLI execution's cacheable prefix (system
 * prompt + MCP tool list + CLAUDE.md + imports + skills + agents). Two tiers:
 *   - static:   hashed from declared inputs before execution
 *   - observed: hashed from the system/init event emitted by the CLI
 *
 * Drift between the two tiers points to a mismatch between declared config
 * and what the CLI actually loaded, which is the usual cause of silent cache
 * misses.
 */

/**
 * Sub-hashes for each component that contributes to the static prefix.
 * Every value is a hex sha256. Empty string indicates "component absent".
 */
export interface StaticComponentHashes {
  /** sha256 of CLAUDE.md content with @-imports inlined. */
  claudeMd: string;
  /** sha256 of concatenated @-imported file contents (sorted by path). */
  imports: string;
  /** sha256 of enumerated skills (sorted by id, each id + body). */
  skills: string;
  /** sha256 of enumerated agents (sorted by id, each id + body). */
  agents: string;
  /** sha256 of resolved MCP config canonical JSON. "" when MCP disabled. */
  mcpResolved: string;
  /** Model id + CLI version marker; approximates system-prompt version. */
  systemPromptVersion: string;
}

export interface StaticFingerprint {
  kind: 'static';
  /** sha256 over the sorted JSON of `components`. */
  total: string;
  components: StaticComponentHashes;
  /** Absolute paths / identifiers that fed each component. */
  sources: {
    claudeMdPath: string | null;
    importPaths: string[];
    skillIds: string[];
    agentIds: string[];
    mcpConfigPath: string | null;
  };
  computedAt: number;
}

/**
 * Sub-hashes derived from the system/init stream event. All strings are hex
 * sha256 of the canonical (sorted) value list, so ordering noise cannot cause
 * false drift.
 */
export interface ObservedComponentHashes {
  tools: string;
  mcpServers: string;
  agents: string;
  slashCommands: string;
  model: string;
  permissionMode: string;
  outputStyle: string;
}

export interface ObservedFingerprint {
  kind: 'observed';
  total: string;
  components: ObservedComponentHashes;
  /** Verbatim lists, kept for diffing and display. */
  details: {
    tools: string[];
    mcpServers: Array<{ name: string; status: string }>;
    agents: string[];
    slashCommands: string[];
    model: string;
    permissionMode: string;
    outputStyle: string;
  };
  sessionId: string;
  observedAt: number;
}

/**
 * Drift map keys reference StaticComponentHashes keys so the UI can show
 * exactly which declared component the observed side disagrees with.
 */
export interface FingerprintDrift {
  detected: boolean;
  /** Component keys whose static and observed hashes disagree. */
  differingComponents: Array<keyof StaticComponentHashes>;
  note?: string;
}

export interface FingerprintPair {
  static: StaticFingerprint;
  observed?: ObservedFingerprint;
  drift?: FingerprintDrift;
}

/**
 * Aggregated token / cost metrics per execution, summed across assistant and
 * result stream events. The raw values come directly from the CLI's `usage`
 * blocks; ratios are computed here for display convenience.
 */
export interface CacheMetrics {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  ephemeral5mTokens: number;
  ephemeral1hTokens: number;
  /** cacheRead / (cacheRead + inputTokens). 0 if no tokens observed. */
  cacheHitRatio: number;
  costUsd: number;
  /** Max `modelUsage[].contextWindow` seen on this session, if any. */
  contextWindow?: number;
  turns?: number;
  durationMs?: number;
}

/**
 * Sidecar metadata file written beside the CLI's JSONL log at
 * `~/.claude/projects/<dash-dir>/<sessionId>.meta.json`. Readable standalone;
 * never mutates the CLI's JSONL.
 */
export interface SessionMeta {
  schemaVersion: 1;
  sessionId: string;
  toolId: string;
  projectPath: string;
  fingerprint: FingerprintPair;
  metrics: CacheMetrics;
  /** Populated once Phase 2 resolver runs. */
  mcpResolved?: {
    enabledServerIds: string[];
    hash: string;
    baselineServerIds: string[];
    overrideAdd: string[];
    overrideRemove: string[];
    /** Inlined canonical JSON so analysis survives temp-file cleanup. */
    canonicalJson: string;
  };
  writtenAt: number;
}

/**
 * Analysis derived from a session's JSONL log alone (no sidecar required).
 *
 * The internal JSONL format omits the system/init event and thus cannot give
 * the full observed tool/agent list the way the stream-json output does. What
 * IS observable is the model used, the tools that appeared via
 * `deferred_tools_delta` attachments, the cwd, and cumulative usage on
 * assistant messages. These compose a best-effort grouping key that works for
 * sessions the app did not drive itself.
 */
export interface DerivedSessionMeta {
  schemaVersion: 1;
  source: 'derived';
  sessionId: string;
  toolId: string;
  /** cwd extracted from the first event that carries one, if any. */
  projectPath: string | null;
  /** Hash of (model, sorted tool list). Serves as the grouping key. */
  fingerprintHash: string;
  details: {
    model: string | null;
    tools: string[];
    eventCount: number;
  };
  metrics: CacheMetrics;
  computedAt: number;
}

/**
 * Unified view consumed by the Sessions list UI. The renderer does not need
 * to care whether the meta came from a sidecar or was derived from the log;
 * it only needs a stable grouping hash, metrics for badges, and an optional
 * drift indicator.
 */
export interface SessionMetaView {
  source: 'sidecar' | 'derived';
  sessionId: string;
  fingerprintHash: string;
  metrics: CacheMetrics;
  drift?: FingerprintDrift;
  model?: string;
  toolCount?: number;
  /**
   * Resolved MCP composition for sessions driven by this app. Only populated
   * when `source === 'sidecar'` and the execution went through the Phase 2
   * resolver. `canonicalJson` is intentionally omitted from the view: it is
   * available on the full `SessionMeta` when needed, but too large to ship to
   * the renderer for every row in a list.
   */
  mcpResolved?: {
    enabledServerIds: string[];
    hash: string;
    baselineServerIds: string[];
    overrideAdd: string[];
    overrideRemove: string[];
  };
}
