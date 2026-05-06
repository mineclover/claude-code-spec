/**
 * Electrobun bun-process entrypoint.
 *
 * Loads the React renderer either from the running Vite dev server (HMR) or
 * from the bundled views:// scheme. Mirrors the official react-tailwind-vite
 * template's URL-probe pattern so a missing dev server gracefully falls back
 * to the packaged assets instead of opening a blank window.
 *
 * Wires the typed RPC schema to a thin handler set that delegates to the
 * bun-side session reader.
 */

import { BrowserView, BrowserWindow, Updater } from 'electrobun/bun';
import {
  invalidateCache,
  listProjects,
  listSessions,
} from './sessionReader';
import type { SessionViewerRPC } from '../shared/rpc-schema';

const DEV_SERVER_URL = process.env.SESSION_VIEWER_DEV_URL ?? 'http://localhost:5180';
const PROD_URL = 'views://mainview/index.html';

async function resolveMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel !== 'dev') return PROD_URL;
  try {
    await fetch(DEV_SERVER_URL, { method: 'HEAD' });
    console.log(`[bun] HMR enabled: using Vite dev server at ${DEV_SERVER_URL}`);
    return DEV_SERVER_URL;
  } catch {
    console.log(
      '[bun] Vite dev server not running; falling back to bundled views. ' +
        "Run 'npm run dev:hmr' for live reload.",
    );
    return PROD_URL;
  }
}

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
        console.log('[renderer]', payload.msg);
      },
    },
  },
});

const url = await resolveMainViewUrl();

const win = new BrowserWindow({
  title: 'Session Viewer',
  url,
  frame: { width: 1280, height: 820, x: 200, y: 160 },
  rpc,
});

// Diagnostic hooks — print every navigation lifecycle event so we can see
// whether the webview reaches dom-ready (and what URL it actually loaded).
for (const event of [
  'will-navigate',
  'did-navigate',
  'did-commit-navigation',
  'dom-ready',
] as const) {
  win.webview.on(event, (payload: unknown) => {
    console.log(`[webview:${event}]`, JSON.stringify(payload));
  });
}

// Devtools is opt-in via signal: side-effect of opening it appears to break
// the webview's compositor layer (content blanks out moments later). Open
// manually with `kill -USR2 <bun pid>` when you need it.
process.on('SIGUSR2', () => {
  try {
    win.webview.openDevTools();
    console.log('[bun] devtools opened (SIGUSR2)');
  } catch (err) {
    console.error('[bun] failed to open devtools', err);
  }
});

// Allow a manual cache refresh via SIGUSR1 so devs can re-scan without restart.
process.on('SIGUSR1', () => {
  invalidateCache().catch((err) => console.error('[bun] invalidate failed', err));
});

console.log(`[bun] session-viewer window opened → ${url}`);
