# Sessions

The Sessions page (`/sessions`) is the read-only side of the platform: it
inventories every CLI session under `~/.claude/projects/<dash-dir>/`, joins
them against per-session sidecars when available, and renders cache /
fingerprint metrics so the user can see *which* runs share a cache-eligible
prefix.

**Route:** `/sessions`
**Page:** `src/pages/SessionsPage.tsx`

## Layer map

This feature follows the project's ECS shape (entity / system / component) —
see [`docs/architecture/ecs-structure.md`](../../architecture/ecs-structure.md)
for vocabulary.

### Entity layer (`src/lib/`)

| Module | Role |
|---|---|
| `src/lib/session/events.ts` | JSONL line extractors (cwd, model, tool delta). |
| `src/lib/session/aggregate.ts` | Pure project-wide rollups: `aggregateSessionMetas`, `groupByFingerprint`, `trendByTime`, `compareMcpOverrides`. |
| `src/lib/session/address.ts` | `parseAddress` / `formatAddress` / `entryDomId` for `#N` and `#N.k` log-entry references. |
| `src/lib/sessionClassifier.ts` | Speaker + output-type classification per JSONL entry. |
| `src/lib/cacheMetrics.ts` | `CacheMetrics` reducer over assistant `usage` blocks. |

### System layer (`src/services/`)

| Service | Role |
|---|---|
| `claudeSessions.ts` | Lists projects, paginates sessions, reads JSONL logs. |
| `SessionAnalyticsService.ts` | Streams a JSONL into a `DerivedSessionMeta` (model + tools + metrics + fingerprint). Caches by `(mtime, size)`. |
| `SessionMetaStore.ts` | Reads / writes per-session sidecars (`<sessionId>.meta.json`). |
| `errorReporter.ts` | Bridges service failures to the renderer toast surface. |

### Component layer (`src/components/sessions/`)

| Component | Purpose |
|---|---|
| `ClassifiedLogEntry.tsx` | Single log entry with `#N` address, copy button, and per-block sub-addresses (`#N.k`). |
| `ProjectSummaryCard.tsx` | Stat tiles: sessions, groups, avg cache, cost, sidecar/derived split. |
| `TrendSparkline.tsx` | Pure-CSS bar trend (no chart lib). |
| `McpOverrideComparisonTable.tsx` | Per-baseline override → cache-hit comparison. |
| `McpResolvedChip.tsx` | Compact + detail chips for a session's resolved MCP composition. |

## Address system

Every session entry is rendered with a `#N` header (1-based). Tool calls and
tool results inside an entry get `#N.k` sub-addresses. The detail-pane "Jump
to #N.k" input parses the user input through `parseAddress`, looks up the
DOM id from `entryDomId`, scrolls into view, and flashes the matching node
via the global `.session-entry-highlight` class.

Both sides of the contract are pure — no DOM in `src/lib/session/address.ts`
and no string parsing in the components — so a renamed scheme would touch
exactly one file.

## Project dashboard

When a project is selected and at least one `SessionMetaView` is loaded, the
sessions panel renders the dashboard above the session list. The aggregate
runs client-side over the `getProjectSessionViews` map — no extra IPC
traffic. See `Phase A` in
[`docs/architecture/maturity-plan.md`](../../architecture/maturity-plan.md)
for the design rationale.

## Tests of note

- `src/lib/session/aggregate.test.ts` — token-weighted cache-hit math, baseline grouping, override identity hashing.
- `src/lib/session/address.test.ts` — round-trip `parseAddress` ↔ `formatAddress`, hostile inputs.
- `src/services/SessionAnalyticsService.test.ts` — JSONL extraction, cache hit/miss, `skipSessionIds`.
