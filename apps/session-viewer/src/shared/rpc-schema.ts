/**
 * RPC schema shared between the Electrobun bun process (host) and the webview
 * (renderer). This file is the single source of truth — both sides import the
 * same `SessionViewerRPC` type so the wire is type-checked end-to-end.
 *
 * Keep the surface narrow and aligned with SessionDataSource so the
 * renderer-side adapter is a thin pass-through.
 */

import type { SessionMetaView } from '@context-action/session-core';
import type { RPCSchema } from 'electrobun/view';
import type {
  BranchRequest,
  BranchResult,
  ListSummariesFilter,
  ProjectListItem,
  SummaryRecord,
} from './dataSource';

export interface AdapterDescription {
  adapter: string;
  readonly: boolean;
}

/**
 * Progress event pushed from bun → renderer while a `branch` request is
 * in flight. The RPC request itself can take minutes; these messages give
 * the UI something to render so the operator sees activity.
 *
 * MUST stay structurally compatible with `ForkProgress` from
 * `@context-action/cli-runner` — bun forwards each runner event verbatim
 * through this DTO. Adding a field here means adding it there too.
 */
export interface BranchProgressEvent {
  /** Source session whose fork is being run. */
  sourceSessionId: string;
  /** Coarse phase — UI uses it to drive the spinner state. */
  phase:
    | 'started'
    | 'cli-spawned'
    | 'system-init'
    | 'assistant-streaming'
    | 'assistant-complete'
    | 'parsed'
    | 'failed';
  /** Operator-facing one-liner (e.g. "spawned claude --resume…"). */
  message?: string;
  /** Wall-clock ms since the branch request was received. */
  elapsedMs: number;
  /** Newly-minted fork session id, set once system/init fires. */
  forkSessionId?: string;
  /**
   * Streaming chunk of the model's text response when phase ===
   * 'assistant-streaming'. Renderer accumulates these into the live
   * transcript view.
   */
  textDelta?: string;
  /** Cumulative cache_read tokens observed so far. */
  cacheReadTokens?: number;
  /** Error blurb when phase === 'failed'. */
  error?: string;
}

export type SessionViewerRPC = {
  bun: RPCSchema<{
    requests: {
      describeAdapter: { params: void; response: AdapterDescription };
      listProjects: { params: void; response: ProjectListItem[] };
      listSessions: {
        params: { projectId: string };
        response: SessionMetaView[];
      };
      branch: { params: BranchRequest; response: BranchResult };
      listSummaries: {
        params: ListSummariesFilter;
        response: SummaryRecord[];
      };
      getSummary: {
        params: { id: string };
        response: SummaryRecord | null;
      };
      deleteSummary: { params: { id: string }; response: void };
    };
    messages: {
      // Reserved: e.g. log lines from the renderer to the bun process.
      logToBun: { msg: string };
    };
  }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      // Reserved: bun → renderer push (e.g. live session updates).
      sessionsChanged: { projectId: string };
      // Live progress for an in-flight Branch & Summarize request.
      branchProgress: BranchProgressEvent;
    };
  }>;
};
