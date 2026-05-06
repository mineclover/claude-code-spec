/**
 * Transport-agnostic data source for the session viewer.
 *
 * The renderer never imports node:fs / electron / electrobun. Instead it
 * consumes this `SessionDataSource` interface, and a host-specific adapter
 * fulfils it:
 *   - Electron: ipcRenderer-backed adapter (future)
 *   - Electrobun: typed-RPC adapter (future)
 *   - Tests / dev: in-memory mock (current)
 *   - HTTP: fetch-based adapter for hosted preview (future)
 *
 * The interface is intentionally narrow — only the shapes the UI actually
 * needs — so adapters are cheap to write and the contract is auditable.
 */

import type { SessionMetaView } from '@context-action/session-core';

/**
 * One project = one cwd that contains many sessions. Adapters group sessions
 * by their resolved project path and surface a stable `id` for navigation.
 */
export interface ProjectListItem {
  id: string;
  /** Display path (cwd or its abbreviation). */
  path: string;
  sessionCount: number;
  /** Most recent session timestamp, ms. Optional for adapters that don't track. */
  lastSeenAt?: number;
  /** CLI that owns this project, e.g. 'claude' | 'codex' | 'gemini'. */
  toolId?: string;
}

/**
 * Cache-preserving "branch" candidate for a session. Carrying the parent's
 * thread id and prefix invariants here lets the viewer trigger a fork through
 * the data source without exposing CLI plumbing to the UI.
 */
export interface BranchRequest {
  /** The session whose tail prefix the branch should share. */
  sessionId: string;
  /** Operator-supplied evaluation prompt that runs only on the fork. */
  evaluationPrompt: string;
}

export interface BranchResult {
  /** Newly minted thread/session id; same prefix bytes as the source. */
  forkSessionId: string;
  /** Cache_read tokens reported on the first turn — key invariant check. */
  cacheReadTokens: number;
  /** Whether the run completed without producing the operator's prompt
   *  invalidating any prior cached blocks. */
  prefixPreserved: boolean;
}

export interface SessionDataSource {
  /**
   * Health probe used to decide whether to render real data or the empty state.
   * Returns the adapter name for diagnostics.
   */
  describe(): { adapter: string; readonly: boolean };

  listProjects(): Promise<ProjectListItem[]>;

  /**
   * Returns the per-project session views (one per Claude/Codex/Gemini session
   * found under the project). Sorted by the adapter — typically newest first.
   */
  listSessions(projectId: string): Promise<SessionMetaView[]>;

  /**
   * Optional: branch evaluation. Adapters that don't support live execution
   * (mock, HTTP read-only) should throw a `BranchUnsupportedError`.
   */
  branch(request: BranchRequest): Promise<BranchResult>;
}

export class BranchUnsupportedError extends Error {
  constructor(adapter: string) {
    super(`Branch evaluation not supported by adapter: ${adapter}`);
    this.name = 'BranchUnsupportedError';
  }
}
