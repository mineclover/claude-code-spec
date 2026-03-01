# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*
- MCP launch strategy declaration pattern:
  Declare MCP path/strict behavior inside `commandSpec.segments` with `type: 'mcpLaunch'`
  and tune strict-only behavior per tool using `strict.allowWithoutConfig` plus
  config-present inclusion with `strict.includeWhenConfigPresent`, then verify
  representative combinations via command snapshot tests.
- Maintenance adapter onboarding pattern:
  Use `defineMaintenanceServiceAdapter`/`defineMaintenanceServiceAdapters` from
  `src/types/maintenance-adapter-sdk.ts` for registrations, then convert to runtime
  adapters with `createAdapterFromRegistration` in
  `src/services/maintenance/serviceIntegrations.ts`. This gives compile-time contract
  enforcement and runtime capability normalization in one flow.
- Adapter normalization utility pattern:
  Keep path template/skill root normalization in `src/lib/pathTemplateUtils.ts`
  (`resolvePathTemplate`, `normalizeDir`, `defaultDisabledRoot`) and service dedupe in
  `src/lib/collectionUtils.ts` (`dedupeByLast`), then consume both from
  `serviceIntegrations` so built-in/custom registrations share identical normalization.
- Registry migration safety pattern:
  Compose schema upgrades with `migrateMaintenanceRegistryToLatest` and execute writes
  via `runMaintenanceRegistryMigrationTransaction` in `src/services/appSettings.ts`,
  then persist using `saveSettingsWithRollback` snapshot restore so migration and disk
  write failures both recover safely.
- CLI command rule-catalog composition pattern:
  Model CLI arguments as declarative `commandSpec.segments` and compose with
  `fallback` + `conditional` segment nesting (plus `mcpLaunch` strategy flags) in
  `src/services/CliCommandComposer.ts` and `src/data/cli-tools/claude.ts` so new
  option combinations can be added without hardcoded branching.

---

## 2026-03-01 - US-002
- What was implemented
  - Verified adapter SDK contract package already exists as shared types in
    `src/types/maintenance-adapter-sdk.ts` and is consumed by maintenance integrations.
  - Verified compile-time required-field enforcement via
    `MaintenanceServiceAdapterRegistration` conditional typing and
    `src/types/maintenance-adapter-sdk.typecheck.ts` (`@ts-expect-error` guards).
  - Verified new-service minimal template is available in
    `src/services/maintenance/adapterTemplate.ts` with coverage in
    `src/services/maintenance/adapterTemplate.test.ts`.
  - Confirmed acceptance checks:
    - `npx tsc --noEmit`
    - `npx biome check src/types/maintenance-adapter-sdk.ts src/types/maintenance-adapter-sdk.typecheck.ts src/services/maintenance/serviceIntegrations.ts src/services/maintenance/adapterTemplate.ts src/services/maintenance/serviceIntegrations.test.ts src/services/maintenance/adapterTemplate.test.ts src/services/maintenance/compatibilityMatrix.ts src/services/maintenance/compatibilityMatrix.test.ts`
    - `npx vitest run src/services/maintenance/serviceIntegrations.test.ts src/services/maintenance/adapterTemplate.test.ts src/services/maintenance/compatibilityMatrix.test.ts`
- Files changed
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Type-level capability gating (`RequireContractWhenEnabled`) is used as the single
      source of truth for adapter contract completeness.
    - Built-in adapters are authored as typed registrations first, then normalized into
      runtime adapters to keep custom/built-in behavior consistent.
  - Gotchas encountered
    - No additional implementation was required; story scope was already satisfied in the
      current branch and only verification/logging was needed.
---

## 2026-03-01 - US-003
- What was implemented
  - Verified `claude/codex/gemini/ralph/moai/skills` built-in registrations are all
    authored through `defineMaintenanceServiceAdapter(s)` and normalized via
    `createAdapterFromRegistration` in
    `src/services/maintenance/serviceIntegrations.ts`.
  - Verified dedupe/path resolution logic is merged into shared utilities:
    `dedupeByLast` (`src/lib/collectionUtils.ts`) and
    `resolvePathTemplate`/`normalizeDir`/`defaultDisabledRoot`
    (`src/lib/pathTemplateUtils.ts`).
  - Verified no regression on version check / update / skill listing behaviors through
    `src/services/CliMaintenanceService.test.ts`.
  - Confirmed acceptance checks:
    - `npx tsc --noEmit`
    - `npx biome check src/lib/pathTemplateUtils.ts src/lib/pathTemplateUtils.test.ts src/services/maintenance/serviceIntegrations.ts src/services/maintenance/serviceIntegrations.test.ts src/services/CliMaintenanceService.test.ts`
    - `npx vitest run src/lib/pathTemplateUtils.test.ts src/services/maintenance/serviceIntegrations.test.ts src/services/CliMaintenanceService.test.ts`
- Files changed
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Built-in adapter migration quality can be validated by pairing
      `serviceIntegrations` contract tests (registration/merge paths) with
      `CliMaintenanceService` behavior tests (version/update/skills flows).
  - Gotchas encountered
    - Story scope was already implemented in the current branch, so this iteration
      focused on acceptance verification and progress log updates.
---

## 2026-03-01 - US-004
- What was implemented
  - Verified registry root schema versioning is enforced by
    `MaintenanceRegistryDocument` (`schemaVersion`) in
    `src/types/maintenance-registry.ts` and strict validation in
    `src/lib/maintenanceRegistryValidation.ts`.
  - Verified legacy-to-latest migration pipeline exists in
    `src/lib/maintenanceRegistryMigration.ts` via
    `REGISTRY_MIGRATION_PIPELINE` + `migrateMaintenanceRegistryToLatest`.
  - Verified rollback protection exists through
    `runMaintenanceRegistryMigrationTransaction` and
    `SettingsService.normalizeMaintenanceRegistry()` snapshot restoration flow in
    `src/services/appSettings.ts`.
  - Confirmed acceptance checks:
    - `npx tsc --noEmit`
    - `npx biome check src/types/maintenance-registry.ts src/lib/maintenanceRegistryMigration.ts src/lib/maintenanceRegistryMigration.test.ts src/lib/maintenanceRegistryValidation.ts src/lib/maintenanceRegistryValidation.test.ts src/services/appSettings.ts`
    - `npx vitest run src/lib/maintenanceRegistryMigration.test.ts src/lib/maintenanceRegistryValidation.test.ts src/lib/maintenanceRegistryForm.test.ts src/hooks/useMaintenanceRegistryDraft.test.ts`
- Files changed
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Registry migration is guarded in two layers: schema migration transaction rollback
      during in-memory apply, and settings snapshot rollback during disk persistence.
  - Gotchas encountered
    - Story scope was already implemented in the current branch; only verification and
      progress documentation were required.
---

## 2026-03-01 - US-005
- What was implemented
  - Verified composable command rule catalog supports `conditional` groups and
    `fallback` selection in `src/types/cli-tool.ts` and
    `src/services/CliCommandComposer.ts`.
  - Verified Claude command composition uses declarative MCP/permission combinations
    (`mcpLaunch` + `fallback` + `conditional`) in
    `src/data/cli-tools/claude.ts`.
  - Verified strict MCP launch strategy behavior (allow/block strict-only usage per
    tool) and command snapshot outputs through
    `src/services/CliCommandComposer.test.ts`.
  - Confirmed acceptance checks:
    - `npx tsc --noEmit`
    - `npx biome check src/types/cli-tool.ts src/services/CliCommandComposer.ts src/data/cli-tools/claude.ts src/services/CliCommandComposer.test.ts`
    - `npx vitest run src/services/CliCommandComposer.test.ts`
- Files changed
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Wrapping permission flag resolution in a `fallback` segment cleanly enforces
      precedence (`--permission-mode` mapping first, bypass fallback second) without
      imperative branching.
  - Gotchas encountered
    - Story scope was already implemented in the current branch; this iteration focused
      on acceptance verification and progress logging.
---

## 2026-03-01 - US-006
- What was implemented
  - Verified per-tool MCP launch strategy abstraction already exists in
    `src/types/cli-tool.ts` (`CLICommandMcpLaunchStrictConfig`) and
    `src/services/CliCommandComposer.ts` (`resolveMcpLaunchStrategy` /
    `renderMcpLaunchSegment`), including strict-only control via
    `strict.allowWithoutConfig`.
  - Verified `mcp-config` + `strict` combination rules are declared at service
    definition level in `src/data/cli-tools/claude.ts` via declarative
    `commandSpec.segments` (`mcpLaunch` + `fallback`).
  - Verified Claude representative combinations are covered in
    `src/services/CliCommandComposer.test.ts`:
    default, bypass, strict-only, strict+mcp-config.
  - Confirmed acceptance checks:
    - `npx tsc --noEmit`
    - `npx biome check src/types/cli-tool.ts src/services/CliCommandComposer.ts src/data/cli-tools/claude.ts src/services/CliCommandComposer.test.ts`
    - `npx vitest run src/services/CliCommandComposer.test.ts`
- Files changed
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - `mcpLaunch` segment parameters are sufficient to encode tool-specific strict
      behavior without imperative command branching.
  - Gotchas encountered
    - Story scope was already implemented in the current branch; this iteration
      focused on acceptance verification and progress logging.
---
