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

import type {
  SessionMetaView,
  SummaryLanguage,
  SummaryResult,
} from '@context-action/session-core';
import type { BranchProgressEvent } from './rpc-schema';

export type { SummaryLanguage };

export type { BranchProgressEvent };

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
 * thread id and a high-level evaluation kind here lets the viewer trigger a
 * fork through the data source without exposing CLI plumbing to the UI.
 */
export interface BranchRequest {
  /** The session whose tail prefix the branch should share. */
  sessionId: string;
  /**
   * What the sidecar should do once it shares the prefix.
   * v1 supports `summarize` only; later modes (e.g. `eval`, `next-step`)
   * extend this discriminator.
   */
  kind?: 'summarize';
  /**
   * Language the model should answer in (oneLiner, narrative, decisions, …).
   * Defaults to `'en'` when omitted. The JSON envelope itself is always
   * the same shape — only the human-readable strings switch language.
   */
  language?: SummaryLanguage;
  /**
   * Operator-supplied free-form prompt. Optional — the host applies a
   * canonical template per `kind` when omitted. Provided text is appended
   * after the canonical template so operators can refine the eval without
   * having to re-state the JSON envelope expectations.
   */
  promptOverride?: string;
}

/**
 * v1 result shape: the structured summary the renderer can render directly.
 * `cacheInvariants` inside it carries the prefix-preservation proof. Future
 * branch kinds will return discriminated variants.
 */
export type BranchResult = SummaryResult;

/**
 * Persisted record of a past branch evaluation. The host writes one of these
 * to disk after a successful `branch` resolves; the renderer fetches them
 * back through `listSummaries` / `getSummary` to show history per session.
 */
export interface SummaryRecord {
  /** Stable id — matches `summary.cacheInvariants.forkSessionId` when set. */
  id: string;
  /** Source session this branch was produced from. */
  sourceSessionId: string;
  /** Which CLI ran the fork. */
  toolId: string;
  /** cwd of the source session at fork time. */
  cwd: string;
  /** ISO timestamp of when the host materialised the record. */
  createdAt: string;
  /** Optional operator-supplied prompt override (if any). */
  promptOverride?: string;
  /** Language the model wrote the summary in (best-effort label). */
  language?: SummaryLanguage;
  /** The full structured summary as returned by the runner. */
  summary: SummaryResult;
}

export interface ListSummariesFilter {
  /** Restrict to summaries forked from this source session. */
  sourceSessionId?: string;
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

  /**
   * Subscribe to fork progress events emitted while a `branch` request is
   * in flight. Adapters that can't observe (mock, HTTP) should accept the
   * callback and return a no-op unsubscribe. Returns a function the caller
   * invokes to unregister the listener.
   */
  subscribeProgress(listener: (event: BranchProgressEvent) => void): () => void;

  /** List persisted past summaries, newest-first. */
  listSummaries(filter?: ListSummariesFilter): Promise<SummaryRecord[]>;

  /** Fetch a specific past summary by id. Resolves to `null` if missing. */
  getSummary(id: string): Promise<SummaryRecord | null>;

  /** Remove a persisted summary. Idempotent — missing ids are silently OK. */
  deleteSummary(id: string): Promise<void>;
}

export class BranchUnsupportedError extends Error {
  constructor(adapter: string) {
    super(`Branch evaluation not supported by adapter: ${adapter}`);
    this.name = 'BranchUnsupportedError';
  }
}
