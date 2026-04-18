# Features Overview

Live documentation index for the Claude Code analytics & control platform.
Each entry below maps 1:1 to a route in `src/App.tsx`. Older pages that have
been removed from routing are not listed here.

## Architecture overview

The platform drives the Claude / Gemini / Codex CLIs in headless mode,
captures their stream-JSON output, and adds a control layer for MCP server
selection, session analytics, and CLI maintenance.

- **Execution control** — headless CLI spawn, stream parsing, per-run MCP override.
- **Observability** — prefix fingerprint groups, cache hit ratios, override comparison, address jump.
- **Maintenance** — MCP registry/policy/compose, CLI version tracking, skill activation.

For layer vocabulary see
[`docs/architecture/ecs-structure.md`](../architecture/ecs-structure.md).

## Routes

| Route | Feature | Notes |
|---|---|---|
| `/` | Execute | Query input, MCP Compose panel, live stream output. |
| `/sessions` | [Sessions](./sessions/README.md) | Project dashboard, fingerprint groups, address jump, MCP chip. |
| `/mcp-configs` | MCP Configs (legacy) | Legacy file-picker; prefer Registry + Compose. |
| `/mcp-registry` | MCP Registry | CRUD for user + project registry entries. |
| `/mcp-policy` | MCP Policy | Baseline enable / allow / forbid matrix. |
| `/skills` | Skills | Skill install paths, activation audit log. |
| `/cli-maintenance` | CLI Maintenance | Tool version registry, update runner, audit log. |
| `/moai-statusline` | MoAI Status Line | Visual editor for the `.moai` status line segments. |
| `/hooks` | Active Hooks | Current `.claude/hooks/*` configuration view. |
| `/references` | References | Provider / hook / skill / output-style references. |
| `/settings` | Settings | Project paths, tool registration, MCP source aggregation. |

## Feature deep-dives

- [Sessions](./sessions/README.md) — layer map, address system, project dashboard.
- [MCP Compose](./mcp-compose/README.md) — resolver pipeline, presets, materialization.

## Related documents

- [ECS architecture](../architecture/ecs-structure.md) — entity / system / component / page / IPC layering.
- [Maturity plan](../architecture/maturity-plan.md) — Phase A–E handoff (dashboard, interaction polish, tests, errors, docs).
- [Prefix fingerprint roadmap](../prefix-fingerprint-roadmap.md) — cache / fingerprint observability and MCP Compose roadmap.
- [CHANGELOG](../../CHANGELOG.md) — release history.
