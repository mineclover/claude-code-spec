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

import {
  annotateOutline as runAnnotateOutline,
  getRunner,
  RunnerUnavailableError,
  type ForkProgress,
} from '@context-action/cli-runner';
import { BrowserView, BrowserWindow, Updater } from 'electrobun/bun';
import {
  invalidateCache,
  listProjects,
  listSessions,
  readClaudeSessionRaw,
  readCodexSessionRaw,
  readGeminiSessionRaw,
  resolveSession,
} from '@context-action/session-core/server/readers';
import {
  deleteSummary as deleteSummaryFromStore,
  getSummary as getSummaryFromStore,
  listSummaries as listSummariesFromStore,
  saveSummary,
} from '@context-action/session-core/server/summary-store';
import {
  deleteOutline as deleteOutlineFromStore,
  getOutline as getOutlineFromStore,
  saveOutline,
} from '@context-action/session-core/server/outline-store';
import {
  extractClaudeOutline,
  extractCodexOutline,
  extractGeminiOutline,
  type SessionOutline,
} from '@context-action/session-core/outline';
import { randomUUID } from 'node:crypto';
import type { SessionViewerRPC } from '../shared/rpc-schema';
import {
  BranchUnsupportedError,
  type SummaryRecord,
} from '../shared/dataSource';

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

/**
 * Read the source session's raw bytes via the per-CLI reader and run
 * the matching outline extractor. Returns `null` when the source can't
 * be located (file missing, sessionId unknown to the cache, etc.). The
 * GUI surfaces null as a "no outline available" empty state.
 */
async function loadFreshOutline(
  sessionId: string,
): Promise<SessionOutline | null> {
  const resolved = await resolveSession(sessionId);
  if (!resolved) return null;
  const { toolId, cwd } = resolved;
  if (toolId === 'claude') {
    const raw = await readClaudeSessionRaw(sessionId, cwd);
    if (raw === null) return null;
    return extractClaudeOutline({ raw, sourceSessionId: sessionId, cwd });
  }
  if (toolId === 'codex') {
    const raw = await readCodexSessionRaw(sessionId, cwd);
    if (raw === null) return null;
    return extractCodexOutline({ raw, sourceSessionId: sessionId, cwd });
  }
  if (toolId === 'gemini') {
    const raw = await readGeminiSessionRaw(sessionId, cwd);
    if (raw === null) return null;
    return extractGeminiOutline({ raw, sourceSessionId: sessionId, cwd });
  }
  return null;
}

// Forward reference so the branch handler can call rpc.send.branchProgress
// once the rpc proxy is alive — the handler is only invoked after the
// BrowserWindow has wired its transport, so `rpcRef` is set by then.
type RPCWithSend = ReturnType<typeof BrowserView.defineRPC<SessionViewerRPC>>;
let rpcRef: RPCWithSend | null = null;

const rpc = BrowserView.defineRPC<SessionViewerRPC>({
  // Two long-running operations live behind RPC: the multi-CLI session
  // scan (1–3s on cold cache) and Branch & Summarize (a real CLI fork
  // round-trip — minutes when the source thread is large). 5 minutes
  // covers the practical worst case while still giving up on a stuck run.
  maxRequestTime: 5 * 60_000,
  handlers: {
    requests: {
      describeAdapter: () => ({
        adapter: 'electrobun',
        readonly: true,
      }),
      listProjects: async () => listProjects(),
      listSessions: async (params: { projectId: string }) =>
        listSessions(params.projectId),
      branch: async (params) => {
        const resolved = await resolveSession(params.sessionId);
        if (!resolved) {
          throw new BranchUnsupportedError(
            `electrobun (sessionId ${params.sessionId} not in cache)`,
          );
        }
        const runner = getRunner(resolved.toolId);
        if (!runner) {
          throw new BranchUnsupportedError(
            `electrobun (no runner registered for ${resolved.toolId})`,
          );
        }
        const cap = await runner.capability();
        if (!cap.available) {
          throw new RunnerUnavailableError(
            resolved.toolId,
            cap.unavailableReason ?? 'unknown',
          );
        }
        console.log(
          `[bun] branch → ${resolved.toolId} session ${resolved.sessionId} in ${resolved.cwd}`,
        );
        const onProgress = (e: ForkProgress) => {
          // Best-effort push; failures must never abort the fork itself.
          try {
            rpcRef?.send.branchProgress({
              sourceSessionId: e.sourceSessionId,
              phase: e.phase,
              message: e.message,
              elapsedMs: e.elapsedMs,
              forkSessionId: e.forkSessionId,
              textDelta: e.textDelta,
              cacheReadTokens: e.cacheReadTokens,
              error: e.error,
            });
          } catch (err) {
            console.error('[bun] branchProgress send failed', err);
          }
        };
        const summary = await runner.fork({
          sourceSessionId: resolved.sessionId,
          cwd: resolved.cwd,
          toolId: resolved.toolId,
          kind: params.kind,
          language: params.language,
          promptOverride: params.promptOverride,
          onProgress,
        });
        console.log(
          `[bun] branch ← ${resolved.toolId} cache_read=${summary.cacheInvariants?.cacheReadTokens ?? 0} ratio=${summary.cacheInvariants?.prefixPreservedRatio.toFixed(2) ?? '0'}`,
        );
        // Persist after success so the operator can revisit this summary
        // later. The id is the fork's own session id when we have one;
        // otherwise we mint a UUID so the store still has a stable key.
        const record: SummaryRecord = {
          id: summary.cacheInvariants?.forkSessionId ?? randomUUID(),
          sourceSessionId: resolved.sessionId,
          toolId: resolved.toolId,
          cwd: resolved.cwd,
          createdAt: summary.generatedAt,
          promptOverride: params.promptOverride,
          language: params.language,
          summary,
        };
        try {
          await saveSummary(record);
        } catch (err) {
          console.error('[bun] saveSummary failed', err);
        }
        return summary;
      },
      listSummaries: async (params) => listSummariesFromStore(params),
      getSummary: async ({ id }) => getSummaryFromStore(id),
      deleteSummary: async ({ id }) => {
        await deleteSummaryFromStore(id);
      },
      getOutline: async ({ sessionId }) => {
        // Persisted (annotated) outline always wins — that's the one the
        // operator already paid the fork cost for. If none exists, fall
        // through to a fresh extraction so the renderer can still show
        // the structure tree before annotation runs.
        const persisted = await getOutlineFromStore(sessionId);
        if (persisted) return persisted;
        return loadFreshOutline(sessionId);
      },
      annotateOutline: async ({ sessionId, language }) => {
        const resolved = await resolveSession(sessionId);
        if (!resolved) {
          throw new BranchUnsupportedError(
            `electrobun (sessionId ${sessionId} not in cache)`,
          );
        }
        if (resolved.toolId === 'gemini') {
          throw new BranchUnsupportedError(
            'outline-annotate is not viable for gemini (prompt-serialize forks lose prefix bytes)',
          );
        }
        const runner = getRunner(resolved.toolId);
        if (!runner) {
          throw new BranchUnsupportedError(
            `electrobun (no runner registered for ${resolved.toolId})`,
          );
        }
        const cap = await runner.capability();
        if (!cap.available) {
          throw new RunnerUnavailableError(
            resolved.toolId,
            cap.unavailableReason ?? 'unknown',
          );
        }
        const baseOutline = await loadFreshOutline(sessionId);
        if (!baseOutline) {
          throw new BranchUnsupportedError(
            `outline source not found for session ${sessionId}`,
          );
        }
        console.log(
          `[bun] annotateOutline → ${resolved.toolId} session ${sessionId} (${baseOutline.steps.length} steps)`,
        );
        const onProgress = (e: ForkProgress) => {
          try {
            rpcRef?.send.outlineProgress({
              sourceSessionId: e.sourceSessionId,
              phase: e.phase,
              message: e.message,
              elapsedMs: e.elapsedMs,
              forkSessionId: e.forkSessionId,
              textDelta: e.textDelta,
              cacheReadTokens: e.cacheReadTokens,
              error: e.error,
            });
          } catch (err) {
            console.error('[bun] outlineProgress send failed', err);
          }
        };
        const { outline } = await runAnnotateOutline(
          baseOutline,
          resolved.cwd,
          { language, onProgress },
        );
        try {
          await saveOutline(outline);
        } catch (err) {
          console.error('[bun] saveOutline failed', err);
        }
        const tagged = outline.steps.filter((s) => !!s.description).length;
        console.log(
          `[bun] annotateOutline ← ${tagged}/${outline.steps.length} tagged across ${outline.annotation?.forks.length ?? 0} forks`,
        );
        return outline;
      },
      deleteOutline: async ({ sessionId }) => {
        await deleteOutlineFromStore(sessionId);
      },
    },
    messages: {
      logToBun: (payload: { msg: string }) => {
        console.log('[renderer]', payload.msg);
      },
    },
  },
});

rpcRef = rpc;

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
