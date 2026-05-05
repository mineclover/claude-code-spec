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
  ProjectListItem,
} from '../data/dataSource';

export interface AdapterDescription {
  adapter: string;
  readonly: boolean;
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
    };
  }>;
};
