/**
 * SessionDataSource backed by Electrobun's typed RPC.
 *
 * Renderer-side adapter: every method is a pass-through to a request on the
 * `rpc.request.*` proxy created by `Electroview.defineRPC`. The bun side
 * fulfils these in apps/session-viewer/bun/main.ts.
 *
 * Activated only when `window.__electrobunWebviewId` is present (i.e. the
 * webview is hosted by an Electrobun BrowserWindow). Otherwise main.tsx falls
 * back to MockSessionDataSource so plain `vite dev` still renders.
 */

import type { SessionMetaView } from '@context-action/session-core';
import {
  BranchUnsupportedError,
  type BranchProgressEvent,
  type BranchRequest,
  type BranchResult,
  type ProjectListItem,
  type SessionDataSource,
} from '../../shared/dataSource';
import type { SessionViewerRPC } from '../../shared/rpc-schema';

/**
 * Shape of the renderer-side rpc proxy that Electroview exposes once
 * `setTransport` has fired. Typed to our schema so `request.foo({...})` is
 * fully checked end-to-end against bun.
 *
 * `send` is intentionally narrowed to webview-side messages (logToBun) since
 * those are the only fire-and-forget signals a renderer initiates.
 */
export interface ElectrobunRpcClient {
  request: {
    describeAdapter(): Promise<{ adapter: string; readonly: boolean }>;
    listProjects(): Promise<ProjectListItem[]>;
    listSessions(params: { projectId: string }): Promise<SessionMetaView[]>;
    branch(params: BranchRequest): Promise<BranchResult>;
    listSummaries(
      params: import('../../shared/dataSource').ListSummariesFilter,
    ): Promise<import('../../shared/dataSource').SummaryRecord[]>;
    getSummary(params: {
      id: string;
    }): Promise<import('../../shared/dataSource').SummaryRecord | null>;
    deleteSummary(params: { id: string }): Promise<void>;
  };
  send: {
    logToBun(payload: SessionViewerRPC['bun']['messages']['logToBun']): void;
  };
}

export class ElectrobunSessionDataSource implements SessionDataSource {
  private cachedDescription: { adapter: string; readonly: boolean } | null = null;
  private readonly progressListeners = new Set<(e: BranchProgressEvent) => void>();

  constructor(private readonly rpc: ElectrobunRpcClient) {}

  describe() {
    return (
      this.cachedDescription ?? {
        adapter: 'electrobun (handshake pending)',
        readonly: false,
      }
    );
  }

  /**
   * Called by main.tsx when a `branchProgress` message arrives from bun.
   * Public so the Electroview message handler — which has to be defined
   * outside this class — can fan it out to subscribers.
   */
  dispatchProgress(event: BranchProgressEvent): void {
    for (const fn of this.progressListeners) {
      try {
        fn(event);
      } catch (err) {
        console.error('[electrobunDataSource] progress listener threw', err);
      }
    }
  }

  subscribeProgress(listener: (event: BranchProgressEvent) => void): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  listSummaries(
    filter: import('../../shared/dataSource').ListSummariesFilter = {},
  ) {
    return this.rpc.request.listSummaries(filter);
  }

  getSummary(id: string) {
    return this.rpc.request.getSummary({ id });
  }

  async deleteSummary(id: string): Promise<void> {
    await this.rpc.request.deleteSummary({ id });
  }

  async listProjects(): Promise<ProjectListItem[]> {
    if (!this.cachedDescription) {
      try {
        this.cachedDescription = await this.rpc.request.describeAdapter();
      } catch {
        // best-effort
      }
    }
    return this.rpc.request.listProjects();
  }

  listSessions(projectId: string): Promise<SessionMetaView[]> {
    return this.rpc.request.listSessions({ projectId });
  }

  async branch(req: BranchRequest): Promise<BranchResult> {
    try {
      return await this.rpc.request.branch(req);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not implemented|unsupported/i.test(msg)) {
        throw new BranchUnsupportedError('electrobun');
      }
      throw err;
    }
  }
}
