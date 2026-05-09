# Session Viewer

Electrobun + Vite + React 19 desktop app that surfaces Claude / Codex / Gemini
sessions from the host filesystem and lets the operator drive cache-preserving
fork operations against them.

## What it shows

Three top-level views:

1. **Sessions** — Project sidebar → session list → cache-invariant detail.
   "Branch & Summarize" forks the active session via cli-runner and produces
   a structured summary, persisted to `~/.session-viewer/summaries/`.
2. **Outline** — Same sidebar / list, plus a structured decomposition of the
   active session. Steps grouped into segments bounded by user instructions.
   "Annotate" runs the iterative cache-preserving annotator (claude or codex)
   to fill 1-line description tags on every describable step.
3. **Summaries** — Global view of every persisted summary with filters (cwd,
   toolId, since, search), sort (newest / oldest / cacheHit), and per-record
   detail.

## Architecture

```
src/
  bun/index.ts          ← Electrobun process (host) — owns RPC handlers,
                          spawns cli-runner, reads session-core stores
  shared/
    rpc-schema.ts       ← typed RPC schema (single source of truth)
    dataSource.ts       ← SessionDataSource interface + DTO re-exports
  mainview/             ← React renderer, bundled by Vite
    main.tsx            ← entry point + adapter selection
    App.tsx             ← top-level component / view-tab routing
    data/
      electrobunDataSource.ts  ← real adapter (RPC pass-through)
      mockDataSource.ts        ← in-memory adapter for `vite dev` preview
    components/         ← per-view leaf components
    i18n/locales/       ← en + ko strings
```

The renderer never imports `node:fs`, `electron`, or `electrobun/bun`.
Everything goes through `SessionDataSource`, fulfilled by either:

- `ElectrobunSessionDataSource` — typed RPC against bun (production)
- `MockSessionDataSource` — synthetic data for `vite dev` previews without the
  bun host

Adapter selection lives in `main.tsx` and probes `window.__electrobunWebviewId`.

## RPC surface

Defined in `shared/rpc-schema.ts` (full source-of-truth on the wire):

- Sessions: `listProjects`, `listSessions`
- Summarize: `branch` request + `branchProgress` push
- Summaries store: `listSummaries`, `getSummary`, `deleteSummary`
- Outline: `getOutline`, `annotateOutline` request + `outlineProgress` push,
  `deleteOutline`
- Health: `describeAdapter`

Both sides bump the default Electrobun RPC timeout to 5 minutes
(`maxRequestTime: 5 * 60_000`) because both `branch` and `annotateOutline`
involve real CLI round-trips that can legitimately take that long.

## i18n

`react-i18next` with `en` and `ko` locales. The EN/KR toggle in the topbar
switches **both** the UI chrome language and the model's output language —
the same `summaryLanguage` state drives `setRendererLanguage(...)` and the
`branch({language})` / `annotateOutline(sessionId, language)` calls.

## Running

```bash
npm start                    # Electron Forge launches the app
npm run dev:hmr              # Vite dev server for live-reloading the renderer
```

The bun launcher probes `http://localhost:5180` first; if Vite isn't running
it falls back to the bundled `views://mainview/index.html`.

## Testing

```bash
npm test --workspace=apps/session-viewer
```

15 tests across the mock data source and electrobun adapter wiring. UI
behavior is verified manually via the dev preview.
