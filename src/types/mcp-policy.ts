/**
 * MCP Registry, Policy, Override, and Resolution types.
 *
 * Three-layer resolution:
 *   1. Registry          ~/.claude/mcp-registry.json (+ project override)
 *        Universe of servers the app knows about.
 *   2. Project Policy    <projectRoot>/.claude/mcp-policy.json
 *        Declares the project's default baseline, whitelist, blacklist.
 *   3. Execution Override per-execution { add, remove }
 *        `remove` handles the ralph-style case where a default-enabled server
 *        must be disabled for a specific run.
 *
 * Resolution produces a canonical JSON consumed by the CLI via --mcp-config,
 * and a stable hash that feeds the prefix fingerprint.
 */

/**
 * One entry in the MCP registry. Mirrors the CLI's own mcpServers schema
 * fields so an entry can be written to a config file verbatim.
 */
export interface McpRegistryEntry {
  /** Stable identifier, e.g. "serena". Lowercase, hyphenated. */
  id: string;
  /** Human-readable label for the UI. Falls back to id when missing. */
  name?: string;
  /** stdio | http | sse. CLI currently uses stdio as default. */
  type?: 'stdio' | 'http' | 'sse';
  command: string;
  args: string[];
  env?: Record<string, string>;
  /** Grouping for the registry UI; e.g. "analysis", "development". */
  category?: string;
  description?: string;
  /** Where this entry is defined; merged in precedence user < project. */
  scope: 'user' | 'project';
}

export interface McpRegistryFile {
  schemaVersion: 1;
  entries: McpRegistryEntry[];
}

/**
 * Effective registry after merging user + project scopes. Project entries
 * with the same id override user entries (same field used by the resolver).
 */
export interface ResolvedRegistry {
  entries: McpRegistryEntry[];
  sources: {
    userPath: string | null;
    projectPath: string | null;
  };
}

/**
 * Project-level policy controlling which registry entries are usable in
 * this project and which are enabled by default.
 *
 * Precedence within policy: `forbidden` > `allowed` > `defaultEnabled`.
 */
export interface McpPolicyFile {
  schemaVersion: 1;
  /** Ids enabled when no execution override is supplied. */
  defaultEnabled: string[];
  /**
   * Ids the project permits. Empty array means "all registry entries
   * allowed". Non-empty array acts as a whitelist.
   */
  allowed: string[];
  /** Ids the project forbids regardless of other settings. */
  forbidden: string[];
}

/** Per-execution delta layered on top of policy.defaultEnabled. */
export interface McpExecutionOverride {
  /** Enable these for this run (must pass policy.allowed, policy.forbidden). */
  add: string[];
  /** Disable these for this run, even if in policy.defaultEnabled (ralph). */
  remove: string[];
}

/**
 * Shape written to the --mcp-config temp file. Matches Claude CLI's expected
 * format exactly.
 */
export interface CliMcpConfigFile {
  mcpServers: Record<
    string,
    {
      type?: 'stdio' | 'http' | 'sse';
      command: string;
      args: string[];
      env?: Record<string, string>;
    }
  >;
}

/**
 * Output of the resolver. Everything needed to execute AND to audit the
 * resolution (for session metadata and UI preview).
 */
export interface ResolvedMcpConfig {
  /** Final enabled server ids, sorted ascending. Stable ordering = stable hash. */
  enabledServerIds: string[];
  /** sha256 of `canonicalJson`. */
  hash: string;
  /** Deterministic JSON serialization of the CLI config. */
  canonicalJson: string;
  /** The actual object that would be written to disk as --mcp-config input. */
  cliConfig: CliMcpConfigFile;
  /** Path of the temp file written, if the resolver materialized one. */
  configPath?: string;

  /** Audit trail. */
  baselineServerIds: string[];
  addedByOverride: string[];
  removedByOverride: string[];
  /** Ids requested that the resolver rejected (policy violations etc.). */
  disallowed: Array<{ id: string; reason: 'forbidden' | 'not-allowed' | 'not-registered' }>;
}

/**
 * A named override the user pinned for quick reuse. Saved per project at
 * `<projectRoot>/.claude/mcp-presets.json`.
 */
export interface McpPreset {
  id: string;
  name: string;
  override: McpExecutionOverride;
  createdAt: number;
}

export interface McpPresetsFile {
  schemaVersion: 1;
  presets: McpPreset[];
}

/** Default policy used when no mcp-policy.json exists in the project. */
export const DEFAULT_MCP_POLICY: McpPolicyFile = {
  schemaVersion: 1,
  defaultEnabled: [],
  allowed: [],
  forbidden: [],
};
