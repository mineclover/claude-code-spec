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
  ListSummariesFilter,
  ProjectListItem,
  SessionMetaView,
  SummaryLanguage,
  SummaryRecord,
  SummaryResult,
} from '@context-action/session-core';
import type { SessionOutline } from '@context-action/session-core/outline';
import type {
  BranchProgressEvent,
  OutlineProgressEvent,
} from './rpc-schema';

export type {
  BranchProgressEvent,
  ListSummariesFilter,
  OutlineProgressEvent,
  ProjectListItem,
  SessionOutline,
  SummaryLanguage,
  SummaryRecord,
};

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

  /**
   * Fetch the outline for a session. Returns either the annotated outline
   * (when previously persisted) or a freshly extracted one.
   */
  getOutline(sessionId: string): Promise<SessionOutline | null>;

  /**
   * Run the iterative annotator. Annotates the source session's outline
   * via cache-preserving forks and persists the result. Returns the
   * annotated outline. Adapters that don't support live execution
   * should throw a `BranchUnsupportedError`.
   */
  annotateOutline(
    sessionId: string,
    language?: SummaryLanguage,
  ): Promise<SessionOutline>;

  /**
   * Subscribe to annotator progress. Same shape family as
   * `subscribeProgress` for branch — fork-by-fork updates as the
   * annotator iterates. Returns an unsubscribe function.
   */
  subscribeOutlineProgress(
    listener: (event: OutlineProgressEvent) => void,
  ): () => void;

  /** Remove a persisted outline. Idempotent. */
  deleteOutline(sessionId: string): Promise<void>;
}

export class BranchUnsupportedError extends Error {
  constructor(adapter: string) {
    super(`Branch evaluation not supported by adapter: ${adapter}`);
    this.name = 'BranchUnsupportedError';
  }
}
