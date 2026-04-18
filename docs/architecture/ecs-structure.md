# ECS Structure

Layered architecture. Each layer's role is fixed; cross-layer rules are at the bottom.

| Layer | Location | Role | Dependencies |
|-------|----------|------|--------------|
| **Entity** | `src/lib/<domain>/*`, `src/lib/*` | Pure domain types + operations. No I/O, no Electron. | stdlib, `src/types/*` |
| **System** | `src/services/*` | Compose entities; perform I/O; hold app state. | Entity, stdlib, optional Electron |
| **Component** | `src/components/*` | Presentational / interactive React fragments. | Entity types, Preload API via `window.*` |
| **Page** | `src/pages/*` | Assemble components; wire to `window.*` APIs. | Component, Entity types |
| **IPC boundary** | `src/ipc/handlers/*` | Adapt `ipcMain` channels to Systems. Sanitize payloads. | System, Entity |
| **Preload bridge** | `src/preload/apis/*` | Expose `window.<domain>API` via `contextBridge.exposeInMainWorld`. | `src/types/api/*` |
| **Types** | `src/types/*`, `src/types/api/*` | Shared shape declarations. | — |

Entry points: `src/main.ts` (Electron main) · `src/preload.ts` (bridge) · `src/App.tsx` (renderer) · `src/cli/index.ts` (Node CLI, Electron-free).

---

## Domain: MCP

Registry × Policy × Override → Resolved CLI config. See `docs/prefix-fingerprint-roadmap.md` for motivation.

### Entity — `src/lib/mcp/`

| File | Exports | Role |
|------|---------|------|
| `paths.ts` | `MCP_REGISTRY_FILE`, `MCP_POLICY_FILE`, `MCP_PRESETS_FILE`, `registryPathFor`, `policyPathFor`, `presetsPathFor` | On-disk location constants + scope resolver |
| `grouping.ts` | `groupByCategory<T>`, `CategoryGroup<T>` | Generic category grouping for listing UIs |
| `entry.ts` | `sanitizeRegistryEntry`, `parseRegistryFileContent` | Validate/coerce `McpRegistryEntry` from untrusted input |
| `policy.ts` | `sanitizePolicy` | Validate/coerce `McpPolicyFile` |
| `preset.ts` | `sanitizePreset`, `sanitizePresets` | Validate/coerce `McpPreset` |

Types: `src/types/mcp-policy.ts` · `src/types/api/mcp.ts`.

### System — `src/services/McpResolverService.ts`

Loads registry (user + project merge), loads policy, computes `ResolvedMcpConfig`, materializes `<project>/.claude/.mcp-generated-<hash12>.json`. Pure Node; safe for CLI (`src/cli/index.ts` commands `mcp-resolve`, `mcp-registry`).

Consumes: `lib/mcp/paths`, `lib/mcp/entry`, `lib/fileIo` (`writeTextAtomicSync`), `lib/prefixHashing`.

Invoked from: `MultiCliExecutionService.execute()` when `ExecutionRequest.mcpOverride` is present.

### Component — `src/components/mcp/`

| File | Role |
|------|------|
| `ScopeBadge.tsx` | user/project scope pill |
| `OverrideBadge.tsx` | baseline / +add / −remove pill (`McpComposePanel`) |
| `McpBadges.module.css` | shared badge base + variants |
| `CategoryGroupedList.tsx` | generic `<T>` grouped iteration shell |
| `McpResolvedChip.tsx` | Sessions row chip + detail panel (`variant: 'compact' \| 'detail'`) |
| `McpComposePanel.tsx` | per-execution override UI + presets |
| `McpBanner.tsx` | legacy vs. new-system info banner |

### Page

- `src/pages/McpRegistryPage.tsx` — Registry CRUD (`/mcp-registry`)
- `src/pages/McpPolicyPage.tsx` — Policy editor (`/mcp-policy`)
- `src/pages/McpConfigsPage.tsx` — legacy file-picker (`/mcp-configs`)
- `src/pages/ExecutePage.tsx` — hosts `McpComposePanel`, sends `mcpOverride` to `window.executeAPI.execute`

### IPC + Preload

- `src/ipc/handlers/mcpHandlers.ts` — CRUD + `resolve`, uses entity sanitizers
- `src/preload/apis/mcp.ts` — exposes `window.mcpAPI` (`McpAPI` in `src/types/api/mcp.ts`)

### Data flow

```
Page → window.mcpAPI → preload → ipcMain → mcpHandlers → McpResolverService
                                                       → (entities validate)
                                                       → writeJsonAtomic → disk
```

Resolved config persists to sidecar via `MultiCliExecutionService.persistSidecar` → `SessionMeta.mcpResolved`.

---

## Domain: Session

### Entity — `src/lib/session/` + `src/lib/*`

| File | Role |
|------|------|
| `lib/session/events.ts` | `extractToolDelta`, `extractModel`, `extractCwd` — JSONL event extractors |
| `lib/sessionClassifier.ts` | `classifyClaudeEntry` — row classification for the log UI |
| `lib/sessionPathResolver.ts` | `resolveSessionPath` — cwd inference |
| `lib/cacheMetrics.ts` | `emptyCacheMetrics`, `updateCacheMetrics`, `aggregateCacheMetrics` |
| `lib/prefixHashing.ts` | `sha256OfCanonicalJson`, `canonicalJson`, etc. |
| `lib/observedFingerprint.ts` | system/init → observed fingerprint |

Types: `src/types/prefix-fingerprint.ts` · `src/types/stream-events.ts`.

### System — `src/services/`

| File | Role |
|------|------|
| `SessionAnalyticsService.ts` | Batch JSONL analysis → `DerivedSessionMeta` (mtime+size cache) |
| `SessionMetaStore.ts` | Sidecar read/write |
| `claudeSessions.ts` | Directory enumeration, project resolution |
| `FingerprintService.ts` | Static fingerprint from CLAUDE.md + imports + skills + agents + MCP |
| `MultiCliExecutionService.ts` | Spawn + stream parse + MCP resolve + sidecar persist |

### Component — `src/components/sessions/`

`ClassifiedLogEntry.tsx` renders one classified entry (`#N.k` addressing, hook summaries, raw-JSON toggle).

### Page

`src/pages/SessionsPage.tsx` — list + detail, consumes `McpResolvedChip` and `window.sessionsAPI.getProjectSessionViews`.

### IPC + Preload

- `src/ipc/handlers/sessionsHandlers.ts` — `get-session-meta`, `get-project-session-views`, progress broadcast
- `src/preload/apis/sessions.ts` — `window.sessionsAPI`

---

## Shared utilities — `src/lib/`

| File | Role |
|------|------|
| `fileIo.ts` | `writeJsonAtomic` (async) + `writeJsonAtomicSync` / `writeTextAtomicSync` (sync for service layer) |
| `typeGuards.ts` | `isRecord`, `isPlainObject` |
| `cliRunner.ts` | `runBuffered`, `spawnStreaming` (execa wrappers, `forceKillAfterDelay`) |
| `shellPath.ts` | macOS login-shell PATH augmentation |
| `collectionUtils.ts` | `dedupeByLast` |

---

## Cross-layer rules

1. **Entity layer is electron-free.** Importing anything from `electron`, `src/services/appSettings`, or `src/main/*` is forbidden. The Node CLI depends on this. See `src/cli/index.test.ts` — tests import `main` directly, so any Electron leak blows up at module eval.
2. **Systems own I/O and state.** Entities return new values; Systems read files, mutate caches, fire IPC broadcasts.
3. **IPC handlers are thin.** Validate payload via entity sanitizers → call System → wrap in `{ success, error }` (no business logic).
4. **Components don't import `electron`.** They call `window.<domain>API.*` exclusively.
5. **Preload types live in `src/types/api/<domain>.ts`.** Handler, preload, and window.d.ts all reference the same interface.

---

## When adding a new domain

Minimum files (by layer):

```
src/types/<domain>.ts            # data types
src/types/api/<domain>.ts        # IPC API interface
src/lib/<domain>/*.ts            # pure operations
src/services/<Domain>Service.ts  # I/O + state
src/ipc/handlers/<domain>Handlers.ts
src/preload/apis/<domain>.ts     # exposeMainWorld
src/components/<domain>/*.tsx    # UI pieces (optional)
src/pages/<Domain>Page.tsx       # page (optional)
```

Register handlers in `src/main/ipc-setup.ts`; expose preload in `src/preload.ts`; add `window.<domain>API` to `src/window.d.ts`.

---

## References

- Prefix fingerprint roadmap: `docs/prefix-fingerprint-roadmap.md`
- Feature index: `docs/features/index.md`
- Electron module isolation: see `src/cli/index.test.ts`

---

## Phase A / D additions (2026-04)

The dashboards and MCP polish work (Phases A and D of
[`maturity-plan.md`](./maturity-plan.md)) followed the ECS shape exactly.
What was added, by layer:

### Entity layer additions (`src/lib/`)

| Module | Phase | Purpose |
|---|---|---|
| `src/lib/session/aggregate.ts` | A | Pure project-wide rollups over `SessionMetaView`: `aggregateSessionMetas`, `groupByFingerprint`, `trendByTime`, `compareMcpOverrides`. Token-weighted means. |
| `src/lib/session/address.ts` | D | `parseAddress` / `formatAddress` / `entryDomId` for `#N` and `#N.k` log addresses. |
| `src/lib/mcp/filter.ts` | D | `filterEntries(entries, query)` substring filter (id / name / category / description). |
| `src/lib/errorChannel.ts` | B | `ErrorReport` shape + `formatError(err: unknown)` for the cross-cutting error reporter. |

All four are electron-free and have unit tests in adjacent `*.test.ts`.

### System layer additions (`src/services/`)

| Service | Phase | Purpose |
|---|---|---|
| `errorReporter.ts` | B | Process-wide subscriber registry. Services call `.report(source, err)`; the main-side IPC handler subscribes to broadcast on `app:error`. Electron-free; tests live next to it. |

The existing services were not split — they grew an `errorReporter.report`
call alongside their existing `console.error` traces (`appSettings`,
`claudeSessions`, `CliMaintenanceService`, `MultiCliExecutionService`,
`SessionAnalyticsService`, `SessionMetaStore`).

### Component layer additions (`src/components/`)

| Component | Phase | Hosted on |
|---|---|---|
| `sessions/ProjectSummaryCard.tsx` | A | `SessionsPage` |
| `sessions/TrendSparkline.tsx` | A | `SessionsPage` |
| `sessions/McpOverrideComparisonTable.tsx` | A | `SessionsPage` |
| `mcp/McpOverrideDiff.tsx` | D | `McpComposePanel` |
| `mcp/CategoryFilter.tsx` | D | `McpRegistryPage`, `McpPolicyPage` |
| `app/ErrorToaster.tsx` | B | `App.tsx` (next to `<Toaster />`) |

### Cross-cutting IPC additions

| Channel | Direction | Purpose |
|---|---|---|
| `app:error` | main → renderer broadcast | `ErrorReport` from `errorReporter` to `ErrorToaster`. No request/response. |

The handler lives at `src/ipc/handlers/appHandlers.ts`; the preload API is
at `src/preload/apis/app.ts` and exposed as `window.appAPI`.

### Invariants reinforced

- The `aggregate.ts` math runs **client-side only** — no new IPC channels
  for project-wide rollup. The renderer already has the `SessionMetaView`
  array.
- The `address.ts` DOM-id contract is the single source of truth: producer
  (`ClassifiedLogEntry`) and consumer (Sessions detail jump input) both
  call `entryDomId`. Renaming the scheme touches one file.
- The `filterEntries` helper does not mutate its input; both pages can
  feed it the same `registry.entries` reference safely.
