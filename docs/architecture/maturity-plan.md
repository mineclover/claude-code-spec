# Feature Maturity Plan — Phases A → D → C → B → E

Next-session handoff. Each phase is a cohesive body of work targeting the ECS structure documented at `docs/architecture/ecs-structure.md`.

**Baseline (2026-04-18):** 272 tests passing · tsc clean · 0 runtime vulnerabilities · Electron 41, TS 6, Vite 8, Zod 4.

---

## Phase A — Observability dashboard (aggregate insights)

**Goal:** Move from per-session dots to project-level insight: aggregate cache metrics, prefix-group trends, MCP override effect comparison.

### Entity layer (new)

- `src/lib/session/aggregate.ts`
  - `aggregateSessionMetas(views: SessionMetaView[]): ProjectAggregate`
    - Returns `{ sessionCount, groupCount, avgCacheHitRatio, totalCostUsd, sidecarCount, derivedCount }`.
  - `groupByFingerprint(views: SessionMetaView[]): Map<hash, SessionMetaView[]>`
  - `trendByTime(views, window?: number): TrendPoint[]` — rolling cache-hit ratio over the last N sessions (ordered by `computedAt`).
  - `compareMcpOverrides(views): McpOverrideComparison[]` — groups sessions by `mcpResolved.baselineServerIds` hash; within each group, contrasts runs with/without override, emitting `{ baselineHash, overrides: [{overrideHash, count, avgCacheHitRatio}] }`.
  - Pure functions only. Consumes existing `SessionMetaView` shape (`src/types/prefix-fingerprint.ts:179-208`).

Reference shapes:
- `SessionMetaView` — `src/types/prefix-fingerprint.ts:179-208` (has `fingerprintHash`, `metrics.{cacheHitRatio, costUsd, ...}`, `mcpResolved?.{baselineServerIds, overrideAdd, overrideRemove, hash}`).
- `CacheMetrics` — `src/types/prefix-fingerprint.ts:104-118`.

### System layer

No new services. `SessionAnalyticsService` already produces the `views` array; the aggregate runs client-side in the renderer.

### Component layer (new)

- `src/components/sessions/ProjectSummaryCard.tsx` (+ `.module.css`)
  - Props: `{ aggregate: ProjectAggregate }`
  - Renders a row of stat tiles: Sessions · Groups · Avg Cache · Total Cost · Sidecar/Derived split.
- `src/components/sessions/TrendSparkline.tsx` (+ `.module.css`)
  - Props: `{ points: TrendPoint[]; metric: 'cacheHitRatio' | 'costUsd' }`
  - Pure CSS bars (no chart lib dep). Width bucket = 30 sessions by default.
- `src/components/sessions/McpOverrideComparisonTable.tsx` (+ `.module.css`)
  - Props: `{ comparisons: McpOverrideComparison[] }`
  - Displays baseline vs. override, delta in cache hit.

### Page integration

- `src/pages/SessionsPage.tsx`:
  - Above the session list, add `<ProjectSummaryCard aggregate={aggregate} />`.
  - Below the summary, `<TrendSparkline>` and `<McpOverrideComparisonTable>`.
  - Reuse the `sessionMetas` array already in state (line ~40-ish).

### Success criteria

- Dashboard visible on `/sessions` for a project with ≥5 sidecar sessions.
- `aggregateSessionMetas` + `compareMcpOverrides` have unit tests in `src/lib/session/aggregate.test.ts`.
- `npx tsc --noEmit` clean; full suite still passes.
- No new IPC channels (client-side computation only).

---

## Phase D — Interaction polish

**Goal:** Daily-usage sharp edges. Address jump, copy address, MCP diff view, registry/policy search.

### D.1 Address jump + copy (Sessions)

- Entity: `src/lib/session/address.ts`
  - `parseAddress(input: string): { entryIndex: number; blockIndex?: number } | null`
    - Accepts `#3`, `3`, `#3.2`, `3.2`. Returns null for garbage.
  - `formatAddress(entryIndex: number, blockIndex?: number): string` — `#3` or `#3.2`.
- Component: in `src/components/sessions/ClassifiedLogEntry.tsx`:
  - Add a small clipboard button next to the `#N` header (title "Copy address").
  - Tooltip uses the formatted string from `formatAddress`.
- Page: `src/pages/SessionsPage.tsx`:
  - Input at top of detail panel: "Jump to #N.k". On submit, scroll the matching `ClassifiedLogEntry` into view and briefly highlight.

References:
- ClassifiedEntry + blockIndex shape — `src/lib/sessionClassifier.ts` (`ToolCallInfo.blockIndex`, `ToolResultInfo.blockIndex`).
- Existing entry header render — `src/components/sessions/ClassifiedLogEntry.tsx` around the `#{index}` span.

### D.2 MCP Compose diff viewer

- Component: `src/components/mcp/McpOverrideDiff.tsx`
  - Props: `{ baseline: string[]; current: string[] }`
  - Renders a two-column diff: baseline on left, current on right, added/removed badges (`<OverrideBadge>`) highlighting each.
- Integrate into `src/components/mcp/McpComposePanel.tsx`: between the summary row and the checkbox list, show the diff when expanded AND override is non-empty.

### D.3 Registry / Policy search

- Add a shared component `src/components/mcp/CategoryFilter.tsx` with `{ onQueryChange: (q: string) => void }`.
- In `McpRegistryPage.tsx` and `McpPolicyPage.tsx`: filter `grouped` by substring match on `entry.id` or `entry.name`.
- Pure filter helper in `src/lib/mcp/filter.ts`: `filterEntries(entries, query): McpRegistryEntry[]`.

### Success criteria

- `parseAddress` + `formatAddress` have 100% branch coverage (`src/lib/session/address.test.ts`).
- Visual test: open a session with 50+ entries, type `#20.2`, verify scroll + highlight.
- Compose panel diff shows correct add/remove when a baseline server is toggled off and a non-baseline server is toggled on.

---

## Phase C — Test coverage fill-in

**Current gaps (from recent survey):**

| Target | Current | Needed |
|--------|---------|--------|
| `src/pages/McpRegistryPage.tsx` | 0 tests | form validation, save/delete, scope handling |
| `src/pages/McpPolicyPage.tsx` | 0 tests | toggle matrix, save, revert, dirty state |
| `src/services/SessionAnalyticsService.ts` | indirect via CLI | `analyzeSessionFile` happy path, cache hit/miss, `analyzeProjectDir` with `skipSessionIds` |
| ExecutePage `mcpOverride` wiring | 0 | test that `mcpOverride` prop forwards through to `window.executeAPI.execute` |

### Files to create

1. `src/pages/McpRegistryPage.test.tsx` — mock `window.mcpAPI`, assert CRUD flows. Style after `src/pages/CliMaintenancePage.test.tsx`.
2. `src/pages/McpPolicyPage.test.tsx` — toggle scenarios, dirty tracking, save/revert.
3. `src/services/SessionAnalyticsService.test.ts` — use `tmpdir` fixtures (see `src/services/McpResolverService.test.ts` for the pattern).

### Entity/system touch

None. Tests only.

### Success criteria

- Total tests ≥ 310 (currently 272).
- No regressions.
- `npx vitest run` under 5s.

---

## Phase B — Error surfacing

**Goal:** Stop silently swallowing service-layer failures. Today: `console.error` only. Target: surface to user via toast, keep server-side log for diagnostics.

### Entity layer

- `src/lib/errorChannel.ts`
  - `type ErrorReport = { source: string; message: string; detail?: string; at: number }`
  - Pure helper `formatError(err: unknown): { message: string; detail?: string }`.

### System layer

- `src/services/errorReporter.ts` (new)
  - Singleton instance. Method: `.report(source: string, err: unknown): void` → pushes to registered subscribers.
  - On the main process, subscribers include the IPC broadcaster.
- IPC: broadcast channel `app:error` in `src/ipc/handlers/` (new handler file, ~25 LOC).

### Known silent catch sites to audit (from `grep console.error src/services/*.ts`)

| File | Lines |
|------|-------|
| `appSettings.ts` | 119, 121, 155, 184, 193 |
| `claudeSessions.ts` | 140, 428, 443, 461, 481, 515, 556, 578, 595, 654 |
| `CliMaintenanceService.ts` | 443 |
| `MultiCliExecutionService.ts` | 145, 221, 262 |
| `McpResolverService.ts` | (silent catches — no logging; add reporter) |
| `SessionAnalyticsService.ts` | 184 |
| `SessionMetaStore.ts` | (silent catches) |

### Component layer

- `src/components/app/ErrorToaster.tsx` — subscribes to `window.appAPI.onError(callback)`, fires `react-hot-toast` on each report.
- Mount in `src/App.tsx` next to `<Toaster />`.

### Preload API

- `src/preload/apis/app.ts` (new) — exposes `onError(cb): () => void`.
- `src/types/api/app.ts` + `src/window.d.ts` update.

### Success criteria

- Forcing a permission-denied read on `claudeProjectsDir` produces a visible toast.
- No new unhandled promise rejections in DevTools console.
- `console.error` sites above now also call `errorReporter.report`.

---

## Phase E — Documentation & CHANGELOG

**Goal:** Capture what has shipped. Reference-heavy, consistent with `docs/architecture/ecs-structure.md`.

### Files to create / update

| File | Action |
|------|--------|
| `CHANGELOG.md` (repo root) | Create. Seed with entries from git log since last tag. Use Keep-a-Changelog format. |
| `docs/features/sessions/README.md` | Create. Reference `SessionsPage`, address system, MCP chip. |
| `docs/features/mcp-compose/README.md` | Create. Reference `McpComposePanel`, `McpResolverService`, presets, materialization path. |
| `docs/features/index.md` | Link above two, drop stale entries. |
| `docs/architecture/ecs-structure.md` | Append section: "Phase A/D additions" once completed. |

### Sources of truth to lift from (don't re-invent)

- `docs/prefix-fingerprint-roadmap.md` — Phase 2 table covers MCP Compose well
- `src/components/mcp/*.tsx` JSDoc — copy component purpose lines
- `src/lib/mcp/*.ts` file headers — already describe the entity modules

### Success criteria

- `npm run start` succeeds (sanity check — no docs change should break build).
- CHANGELOG entries grouped by Added / Changed / Fixed / Removed with date headers.
- Feature READMEs link back to `ecs-structure.md` for layer vocabulary.

---

## Execution notes for the next session

### Baseline state reference

- Latest ECS doc: `docs/architecture/ecs-structure.md`
- Prefix fingerprint roadmap: `docs/prefix-fingerprint-roadmap.md`
- Test command: `npx vitest run` (baseline 272 pass)
- Typecheck: `npx tsc --noEmit` + `(cd packages/code-api && npx tsc --noEmit)`

### Dependency constraints to respect

- TS 6 with `ignoreDeprecations: "6.0"` in `tsconfig.json` (TS 7 will force `moduleResolution: "bundler"` migration).
- `@electron/fuses` pinned at v1 (peer dep lock from `@electron-forge/plugin-fuses`).
- Node CLI at `src/cli/index.ts` must remain Electron-free — test at `src/cli/index.test.ts:62` fails loudly if that invariant breaks.

### ECS invariants to keep

1. `src/lib/**` — no `electron`, no `appSettings` imports.
2. Sanitizers in `src/lib/mcp/{entry,policy,preset}.ts` are the single source of truth for IPC payload validation. Handlers re-export via `__internal` (`src/ipc/handlers/mcpHandlers.ts:243-249`) — keep that re-export.
3. `writeJsonAtomic` (async) + `writeTextAtomicSync` in `src/lib/fileIo.ts` — don't reinvent atomic write inside new services.
4. Category grouping uses `src/lib/mcp/grouping.ts:groupByCategory` — do not re-inline.

### Parallelization guidance

- Phase A subtasks are sequential (aggregate → summary card → trend → comparison table). Single agent.
- Phase D subtasks (D.1, D.2, D.3) touch different files — parallel-safe with 3 agents.
- Phase C: 3 test files, no shared state — parallel-safe.
- Phase B: sequential. IPC channel first, then services wire in, then components.
- Phase E: single pass.

### Known stale items (not part of A–E, mentioned for context)

- `src-old/` directory — archived pre-pivot code. Safe to delete if space matters.
- `workflow/tasks/task-00{1..6}.md` — reference `src-old/` services, status "completed" is stale.

---

## Reference map (quick links)

**Core domain types:**
- `src/types/prefix-fingerprint.ts` — SessionMeta, SessionMetaView, CacheMetrics, DerivedSessionMeta
- `src/types/mcp-policy.ts` — McpRegistryEntry, McpPolicyFile, ResolvedMcpConfig, McpPreset
- `src/types/execution.ts` — ExecutionRequest (includes mcpOverride), ExecutionInfo

**Key entity modules:**
- `src/lib/mcp/` — paths, grouping, entry, policy, preset
- `src/lib/session/events.ts` — JSONL extractors
- `src/lib/sessionClassifier.ts` — log entry classification
- `src/lib/cacheMetrics.ts` — CacheMetrics reducer
- `src/lib/fileIo.ts` — atomic writers
- `src/lib/typeGuards.ts` — isRecord, isPlainObject

**Key services (systems):**
- `src/services/McpResolverService.ts` — 3-layer resolution
- `src/services/SessionAnalyticsService.ts` — JSONL → DerivedSessionMeta
- `src/services/MultiCliExecutionService.ts` — spawn + MCP materialize + sidecar persist
- `src/services/FingerprintService.ts` — static fingerprint

**Pages:**
- `src/pages/SessionsPage.tsx` — filter chips, chip + detail, mcpResolved display
- `src/pages/McpRegistryPage.tsx` — CRUD
- `src/pages/McpPolicyPage.tsx` — matrix editor
- `src/pages/ExecutePage.tsx` — hosts McpComposePanel
- `src/pages/McpConfigsPage.tsx` — legacy file-picker (has banner)

**Components:**
- `src/components/mcp/` — McpComposePanel, McpResolvedChip, McpBanner, ScopeBadge, OverrideBadge, CategoryGroupedList
- `src/components/sessions/ClassifiedLogEntry.tsx` — `#N.k` addressing, hook summary

**Tests of note:**
- `src/cli/index.test.ts` — proves core services are Electron-free
- `src/services/McpResolverService.test.ts` — fixture pattern for tmp project + registry/policy
- `src/services/MultiCliExecutionService.test.ts` — stubbing spawnStreaming for integration test
