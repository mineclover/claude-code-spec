/**
 * Electrobun bun-process entrypoint.
 *
 * Spawns a single BrowserWindow that hosts the React renderer (vite dev URL
 * in development, bundled views:// scheme once `electrobun build` has been
 * run). Wires the typed RPC schema to a thin handler set that delegates to
 * the bun-side session reader.
 *
 * Run from this app's directory:
 *   bun run dev:bun        # assumes vite is already on :5180
 */

import { BrowserView, BrowserWindow } from 'electrobun/bun';
import {
  invalidateCache,
  listProjects,
  listSessions,
} from './sessionReader';
import type { SessionViewerRPC } from '../src/rpc/schema';

const DEV_URL = process.env.SESSION_VIEWER_URL ?? 'http://localhost:5180';
const PROD_URL = 'views://mainview/index.html';
const isDev = process.env.NODE_ENV !== 'production';

const rpc = BrowserView.defineRPC<SessionViewerRPC>({
  maxRequestTime: 5000,
  handlers: {
    requests: {
      describeAdapter: () => ({
        adapter: 'electrobun',
        readonly: true,
      }),
      listProjects: async () => listProjects(),
      listSessions: async (params: { projectId: string }) =>
        listSessions(params.projectId),
      branch: async () => {
        // Branch evaluation requires spawning a CLI subprocess against a
        // forked thread; deferred until we wire MultiCliExecutionService into
        // a host-process port. The renderer adapter translates this into
        // BranchUnsupportedError.
        throw new Error('branch: not implemented in PoC adapter');
      },
    },
    messages: {
      logToBun: (payload: { msg: string }) => {
        // Lightweight console relay; useful when Electrobun devtools is off.
        console.log('[renderer]', payload.msg);
      },
    },
  },
});

const win = new BrowserWindow({
  title: 'Session Viewer',
  url: isDev ? DEV_URL : PROD_URL,
  frame: { width: 1280, height: 820, x: 200, y: 160 },
  rpc,
});

// Allow a manual cache refresh via SIGUSR1 so devs can re-scan without restart.
process.on('SIGUSR1', () => {
  invalidateCache().catch((err) => console.error('[bun] invalidate failed', err));
});

console.log(`[bun] session-viewer window opened → ${win.webview ? 'ok' : 'failed'}`);
console.log(`[bun] adapter url: ${isDev ? DEV_URL : PROD_URL}`);
