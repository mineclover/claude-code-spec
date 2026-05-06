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
  };
  send: {
    logToBun(payload: SessionViewerRPC['bun']['messages']['logToBun']): void;
  };
}

export class ElectrobunSessionDataSource implements SessionDataSource {
  private cachedDescription: { adapter: string; readonly: boolean } | null = null;

  constructor(private readonly rpc: ElectrobunRpcClient) {}

  describe() {
    return (
      this.cachedDescription ?? {
        adapter: 'electrobun (handshake pending)',
        readonly: false,
      }
    );
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
