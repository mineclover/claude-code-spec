import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import {
  ElectrobunSessionDataSource,
  type ElectrobunRpcClient,
} from './data/electrobunDataSource';
import { MockSessionDataSource } from './data/mockDataSource';
import type { SessionDataSource } from '../shared/dataSource';
import type { SessionViewerRPC } from '../shared/rpc-schema';
import './index.css';

/**
 * Detect Electrobun's preload-injected globals without re-declaring the
 * `Window` interface (Electrobun ships its own typings).
 */
function isHostedByElectrobun(): boolean {
  const probe = globalThis as { __electrobunWebviewId?: unknown };
  return probe.__electrobunWebviewId !== undefined;
}

/**
 * Pick a data source based on the host environment.
 *
 * Electrobun adapter requires both the global preload (which gives us the
 * webview id and rpc socket port) and a successful dynamic import of
 * 'electrobun/view'. Either of those failing falls us back to the mock so
 * the UI still renders.
 */
async function pickDataSource(): Promise<SessionDataSource> {
  if (!isHostedByElectrobun()) {
    console.log('[main] electrobun globals absent → mock adapter');
    return new MockSessionDataSource();
  }

  try {
    const { Electroview } = await import('electrobun/view');
    const rpc = Electroview.defineRPC<SessionViewerRPC>({
      // Default is 1 s; bumped here to match the bun-side timeout because
      // initial multi-CLI scans (especially the codex tree) easily exceed
      // a second on a cold cache.
      maxRequestTime: 60_000,
      handlers: {
        requests: {},
        messages: {
          sessionsChanged: ({ projectId }) => {
            console.log('[renderer] sessionsChanged', projectId);
          },
        },
      },
    });
    new Electroview({ rpc });
    console.log('[main] electrobun adapter wired');
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

// Render an immediate placeholder so the user sees something while the data
// source resolves. If the resolver throws (or hangs), we still show a useful
// error pane instead of an empty document.
function Placeholder({ status }: { status: string }) {
  return (
    <div style={{ padding: 32, fontFamily: 'monospace', color: '#aab2c0' }}>
      <h2 style={{ color: '#e7eaf0', marginTop: 0 }}>Session Viewer</h2>
      <p>{status}</p>
    </div>
  );
}

function ErrorPane({ message }: { message: string }) {
  return (
    <div style={{ padding: 32, fontFamily: 'monospace', color: '#ff7a86' }}>
      <h2 style={{ color: '#ff7a86', marginTop: 0 }}>renderer init failed</h2>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{message}</pre>
      <p style={{ color: '#aab2c0' }}>
        Open the devtools console for the full stack trace.
      </p>
    </div>
  );
}

root.render(<Placeholder status="resolving data source…" />);

// Surface unhandled errors during init.
window.addEventListener('error', (e) => {
  console.error('[main] window error', e.error ?? e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[main] unhandled rejection', e.reason);
});

pickDataSource()
  .then((dataSource) => {
    root.render(
      <React.StrictMode>
        <App dataSource={dataSource} />
      </React.StrictMode>,
    );
  })
  .catch((err) => {
    console.error('[main] pickDataSource rejected', err);
    root.render(<ErrorPane message={String(err?.stack ?? err)} />);
  });
