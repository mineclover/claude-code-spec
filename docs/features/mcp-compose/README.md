# MCP Compose

The MCP Compose feature lets a user pick — *per execution* — exactly which
MCP servers participate in the run, on top of a project-level baseline
defined by `.claude/mcp-policy.json`. The difference between the user's
selection and the policy baseline becomes the `McpExecutionOverride`, which
the resolver feeds through to the spawned CLI.

**Hosted on:** `ExecutePage` (`/`)
**Panel:** `src/components/mcp/McpComposePanel.tsx`

## Layer map

See [`docs/architecture/ecs-structure.md`](../../architecture/ecs-structure.md)
for ECS vocabulary. This feature spans entity → system → component.

### Entity layer (`src/lib/mcp/`)

| Module | Role |
|---|---|
| `paths.ts` | Canonical `<project>/.claude/mcp-{registry,policy}.json` and `~/.claude/mcp-registry.json` paths. |
| `entry.ts` | `McpRegistryEntry` sanitizer + IPC payload validator. |
| `policy.ts` | `McpPolicyFile` sanitizer + IPC payload validator. |
| `preset.ts` | `McpPreset` sanitizer + IPC payload validator. |
| `grouping.ts` | `groupByCategory` for the registry / policy lists. |
| `filter.ts` | Substring filter (`filterEntries`) used by Registry and Policy pages. |

The sanitizers in `entry.ts`, `policy.ts`, and `preset.ts` are the **single
source of truth** for IPC payload validation. The `mcpHandlers.ts`
re-exports them via `__internal` for tests.

### System layer (`src/services/`)

| Service | Role |
|---|---|
| `McpResolverService.ts` | 3-layer resolution (registry → policy → override). Returns canonical JSON + stable hash. |
| `MultiCliExecutionService.ts` | Calls the resolver, materializes the resolved config to a temp file, and adds `--mcp-config` + `--strict-mcp-config` to the spawn. |

### Component layer (`src/components/mcp/`)

| Component | Purpose |
|---|---|
| `McpComposePanel.tsx` | Per-run server selector, presets bar, baseline reset. |
| `McpOverrideDiff.tsx` | Side-by-side baseline vs. current selection with add/remove badges. |
| `CategoryGroupedList.tsx` | Reusable category-grouped renderer (Registry, Policy, Compose share it). |
| `CategoryFilter.tsx` | Substring filter input above category-grouped lists. |
| `McpResolvedChip.tsx` | Sessions-side chip rendering a session's resolved MCP composition. |
| `OverrideBadge.tsx` / `ScopeBadge.tsx` | Small inline badges for diff + scope. |

## Resolution pipeline

1. Renderer assembles `(registry, policy, override)` and sends it via
   `window.mcpAPI.resolve(...)`.
2. `McpResolverService.resolve` produces a `ResolvedMcpConfig` with stable
   `enabledServerIds` and `hash` (canonical-JSON SHA-256).
3. `MultiCliExecutionService.start` calls `mcpResolverService.materialize` to
   write `.claude/.mcp-generated-<hash>.json`, then spawns the CLI with
   `--mcp-config <path> --strict-mcp-config`.
4. The session's sidecar `.meta.json` records `mcpResolved` so the Sessions
   page can render the chip and the dashboard can compare per-baseline
   override effect.

Atomic writes go through `writeJsonAtomic` / `writeTextAtomicSync`
(`src/lib/fileIo.ts`) — do not reinvent atomic write inside a service.

## Presets

Presets are saved JSON in `<project>/.claude/mcp-presets.json`. Each preset
is just `{ id, name, override, createdAt }` — the override is the same
shape passed to the resolver. The presets bar in the panel shows existing
presets, lets the user apply one onto the baseline, save the current
selection as a new preset, or delete an existing preset.

## Tests of note

- `src/services/McpResolverService.test.ts` — fixture pattern for tmp project + registry/policy.
- `src/services/MultiCliExecutionService.test.ts` — spawn stubbing for the integration path.
- `src/components/mcp/McpComposePanel.test.tsx` — selection → override mapping + presets.
- `src/lib/mcp/filter.test.ts` — substring filter cases.
- `src/pages/McpRegistryPage.test.tsx` / `src/pages/McpPolicyPage.test.tsx` — CRUD + matrix.
