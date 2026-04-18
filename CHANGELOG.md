# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Project-level **observability dashboard** on the Sessions page: aggregate cache hit ratio, distinct prefix-fingerprint groups, sidecar/derived split, and per-baseline MCP override comparison (`src/components/sessions/{ProjectSummaryCard,TrendSparkline,McpOverrideComparisonTable}.tsx`, `src/lib/session/aggregate.ts`).
- **Address jump + copy** for session log entries: per-entry copy button, top-of-detail "Jump to #N.k" input that scrolls and flashes the matching block (`src/lib/session/address.ts`, `src/components/sessions/ClassifiedLogEntry.tsx`, `src/pages/SessionsPage.tsx`).
- **MCP Compose diff viewer**: side-by-side baseline vs. current selection with add/remove badges (`src/components/mcp/McpOverrideDiff.tsx`, integrated into `McpComposePanel`).
- **Registry / Policy substring filter** above the category-grouped lists (`src/components/mcp/CategoryFilter.tsx`, `src/lib/mcp/filter.ts`).
- **Application-wide error reporter** bridging main-side service failures to renderer toasts via the new `app:error` IPC channel (`src/lib/errorChannel.ts`, `src/services/errorReporter.ts`, `src/ipc/handlers/appHandlers.ts`, `src/preload/apis/app.ts`, `src/components/app/ErrorToaster.tsx`).
- Test coverage for `McpRegistryPage`, `McpPolicyPage`, `SessionAnalyticsService`, and `ExecutePage` mcpOverride wiring.

### Changed
- `MultiCliExecutionService`, `claudeSessions`, `appSettings`, `CliMaintenanceService`, `SessionAnalyticsService`, and `SessionMetaStore` now report failures through `errorReporter` in addition to existing `console.error` traces, so silent service failures surface as toasts.
- `ClassifiedLogEntry` headers render addresses through `formatAddress` and expose stable DOM ids via `entryDomId` so the jump input has a single source of truth.

## [2026-03-03]

### Added
- `useCollect` hook and platform-aware CLI command resolution.
- MoAI status bar editor tab.
- Copy button and `cli-status.json` persistence for CLI tools.

## [2026-03-02]

### Added
- IPC handlers for settings management.
- Skills support for Gemini and Codex execution.
- CLI Maintenance and Active Hooks pages added to routing.
- Session analysis with user question filtering.
- CSP headers and session security setup.

### Changed
- Service layer: improved stream parsing and settings handling.
- Stream event rendering uses semantic tokens.
- Project selector moved from page body to sidebar.
- Skills and CLI Maintenance split into separate pages.
- Provider and reference system enhanced.

### Removed
- Dead code from `McpConfigsPage`.

## [2026-03-01]

### Added
- US-005 — CLI command composition Rule Catalog upgrade.
- US-006 — Per-CLI MCP Launch Strategy abstraction.
- US-007 — Global/Project MCP Source Aggregator integration.
- US-008 — Session-based path resolution service.
- US-009 — Skill Store Scanner strategization.
- US-010 — Skill Version Resolver chain.
- US-011 — Skill Activation transaction and audit log.
- US-012 — Update planner workflow (check / run / summary).
- US-013 — Registry settings UI form mode (alongside JSON editor).
- US-014 — Provider-specific management page extension framework.
- US-015 — New service onboarding kit (templates / validation / docs).
- US-016 — Compatibility test matrix and fixture pipeline.

