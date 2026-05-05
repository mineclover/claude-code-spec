import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import {
  ElectrobunSessionDataSource,
  type ElectrobunRpcClient,
} from './data/electrobunDataSource';
import { MockSessionDataSource } from './data/mockDataSource';
import type { SessionDataSource } from './data/dataSource';
import type { SessionViewerRPC } from './rpc/schema';
import './styles.css';

/**
 * Detect Electrobun's preload-injected globals without re-declaring the
 * `Window` interface (Electrobun ships its own typings). The cast is local
 * to this probe so the rest of the file stays type-safe.
 */
function isHostedByElectrobun(): boolean {
  const probe = globalThis as { __electrobunWebviewId?: unknown };
  return probe.__electrobunWebviewId !== undefined;
}

/**
 * Pick a data source based on the host environment.
 *
 * - Electrobun BrowserWindow: instantiate Electroview, register our typed
 *   RPC schema, wrap the rpc proxy in ElectrobunSessionDataSource.
 * - Plain vite (e.g. `npm run dev` directly, or storybook-style preview):
 *   fall back to the in-memory mock so the UI keeps rendering.
 *
 * Detection uses the globals injected by Electrobun's preload. Importing
 * 'electrobun/view' is a no-op outside Electrobun, but to keep the bundle
 * lean we lazy-load it only when the host is detected.
 */
async function pickDataSource(): Promise<SessionDataSource> {
  if (!isHostedByElectrobun()) {
    return new MockSessionDataSource();
  }

  try {
    const { Electroview } = await import('electrobun/view');
    const rpc = Electroview.defineRPC<SessionViewerRPC>({
      handlers: {
        requests: {},
        messages: {
          sessionsChanged: ({ projectId }) => {
            // Future: trigger a re-fetch on the active project; for now log.
            console.log('[renderer] sessionsChanged', projectId);
          },
        },
      },
    });
    new Electroview({ rpc });
    return new ElectrobunSessionDataSource(rpc as unknown as ElectrobunRpcClient);
  } catch (err) {
    console.error('[main] electrobun init failed; falling back to mock', err);
    return new MockSessionDataSource();
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('#root element not found in index.html');
}

const root = ReactDOM.createRoot(rootEl);

pickDataSource().then((dataSource) => {
  root.render(
    <React.StrictMode>
      <App dataSource={dataSource} />
    </React.StrictMode>,
  );
});
