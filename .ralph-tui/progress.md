# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*
- Skill activation transaction boundary pattern:
  Keep activation/deactivation filesystem move and activation audit append inside a
  single `runSkillStoreMoveTransaction` apply block in
  `src/services/CliMaintenanceService.ts`, and rollback by moving the directory back
  when any post-move step fails, so persisted state and audit trail stay consistent.
- Skill store scanner strategy composition pattern:
  Keep provider-specific root resolution in `resolveSkillStoreScanRoots` through
  `SkillStoreScanRootStrategy` mappings, and centralize shared filesystem rules
  (`shouldSkipDirectoryEntry` for hidden/symlink handling, `movePathWithExdevFallback`
  for cross-device moves, `dedupeAndSortInstalledSkills` for provider-stable output)
  in `src/services/maintenance/skillStoreScanner.ts` so new providers only declare
  roots/strategy IDs without duplicating scan behavior.
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
- MCP source aggregation precedence pattern:
  Build MCP source candidates in stable order (global home config -> configured
  additional paths -> project root/tool directories), then resolve duplicate
  server names by deterministic ranking (`sourceScope` priority
  `global < project < projectLocal`, then later discovery order, then
  lexicographic `sourcePath` tie-break) via `getMcpServerCandidates` in
  `src/services/settings.ts`.
- Session path resolution precedence pattern:
  Extract explicit project paths from raw session event payloads first via
  `extractSessionPathFromEvent`, then normalize selection with
  `resolveSessionPath` (`explicit > inferred > safe default`) while keeping
  `inferProjectPathFromDashDirName` as legacy fallback only.
- Skill version hint resolver chain pattern:
  Normalize provider metadata drift by resolving version hints through a fixed
  priority chain in `resolveSkillVersionInfo`:
  frontmatter version -> metadata version -> lockfile hash -> source-derived ref
  -> `SKILL_VERSION_HINT_FALLBACK`, and keep UI rendering aligned with
  `formatSkillVersionHint` so missing values consistently display `unknown`.

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

## 2026-03-01 - US-007
- What was implemented
  - Verified global/project MCP source aggregation API is already implemented in
    `src/services/settings.ts` via `getMcpServerCandidates`, including merged
    candidate metadata (`sourcePath`, `sourceScope`) for reuse across CLIs.
  - Verified tool config generation (`createMcpConfig`,
    `createMcpDefaultConfig`) reuses the shared aggregated candidate path via
    `resolveSelectedServers`.
  - Verified deterministic duplicate-server merge behavior in
    `shouldReplaceCandidate`:
    `sourceScope` priority (`global < project < projectLocal`) ->
    discovery order -> lexicographic source path.
  - Verified API exposure path for candidates:
    `src/ipc/handlers/settingsHandlers.ts` (`settings:get-mcp-server-candidates`),
    `src/preload/apis/settings.ts`, and `src/types/api/settings.ts`.
  - Confirmed acceptance checks:
    - `npx tsc --noEmit`
    - `npx biome check src/services/settings.ts src/services/settings.test.ts src/ipc/handlers/settingsHandlers.ts src/preload/apis/settings.ts src/types/api/settings.ts`
    - `npx vitest run src/services/settings.test.ts`
- Files changed
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Candidate selection is centralized by `resolveSelectedServers`, which
      prevents divergence between profile-based and tool-default MCP config
      generation paths.
  - Gotchas encountered
    - Story scope was already implemented in the current branch; this iteration
      focused on acceptance verification and progress logging.
---

## 2026-03-01 - US-008
- What was implemented
  - Verified metadata-first path extraction is already implemented:
    `extractSessionPathFromEvent` scans raw session event/metadata records for
    `cwd`/`projectPath` variants (including nested records) in
    `src/lib/sessionPathResolver.ts`, and `extractSessionMetadata` consumes it
    from session log blocks in `src/services/claudeSessions.ts`.
  - Verified name-based path inference remains fallback-only:
    `resolveSessionPath` enforces `explicit > inferred > safe default` and
    `inferProjectPathFromDashDirName` is used only when explicit metadata path
    is missing.
  - Verified special character regression coverage already exists in
    `src/lib/sessionPathResolver.test.ts` for `-`, `_`, `.` cases.
  - Confirmed acceptance checks:
    - `npx tsc --noEmit`
    - `npx biome check src/lib/sessionPathResolver.ts src/lib/sessionPathResolver.test.ts src/services/claudeSessions.ts`
    - `npx vitest run src/lib/sessionPathResolver.test.ts`
- Files changed
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Session path resolution is intentionally two-phase: explicit extraction
      from session payloads first, then controlled fallback inference for legacy
      dash-encoded directory names.
  - Gotchas encountered
    - Story scope was already implemented in the current branch; this iteration
      focused on acceptance verification and progress logging.
---

## 2026-03-01 - US-009
- What was implemented
  - Verified provider-specific scan strategy abstraction already exists in
    `src/services/maintenance/skillStoreScanner.ts` via
    `SkillStoreScanRootStrategy` + provider mapping (`PROVIDER_SCAN_STRATEGIES`) and
    explicit/inferred/default precedence in `resolveSkillStoreScanRoots`.
  - Verified shared filesystem behavior is centralized:
    symlink/hidden handling in `shouldSkipDirectoryEntry`,
    EXDEV fallback in `movePathWithExdevFallback`,
    and transactional rollback wrapper in `runSkillStoreMoveTransaction`.
  - Verified installed skill dedupe and stable sorting are centralized in
    `dedupeAndSortInstalledSkills` and consumed by
    `CliMaintenanceService.getInstalledSkills()`, preserving behavior for provider
    extensions.
  - Verified regression coverage exists in
    `src/services/maintenance/skillStoreScanner.test.ts`:
    strategy precedence, symlink/hidden scan rules, EXDEV fallback, and
    provider/id dedupe-sort stability.
  - Confirmed acceptance checks:
    - `npx tsc --noEmit`
    - `npx biome check src/services/maintenance/skillStoreScanner.ts src/services/maintenance/skillStoreScanner.test.ts src/services/CliMaintenanceService.ts src/services/CliMaintenanceService.test.ts src/types/maintenance-adapter-sdk.ts src/services/maintenance/serviceIntegrations.ts`
    - `npx vitest run src/services/maintenance/skillStoreScanner.test.ts src/services/CliMaintenanceService.test.ts src/services/maintenance/serviceIntegrations.test.ts`
- Files changed
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Provider onboarding for skill scanning should be done by adding strategy/provider
      mappings, while keeping directory traversal/move/dedupe rules in shared scanner
      utilities to avoid behavior drift.
  - Gotchas encountered
    - Story scope was already implemented in the current branch; this iteration
      focused on acceptance verification and progress logging.
---

## 2026-03-01 - US-010
- What was implemented
  - Verified skill version resolver chain already exists in
    `src/lib/skillVersionResolver.ts` with sequential precedence:
    `frontmatter.version -> metadata.version -> lock.skillFolderHash -> source-derived hint -> unknown`.
  - Verified consistent fallback display path:
    resolver fallback and UI formatter both use `SKILL_VERSION_HINT_FALLBACK`
    (`unknown`) via `formatSkillVersionHint`, consumed in
    `src/components/skills/SkillsInstalledSection.tsx`.
  - Verified provider fixture coverage exists in
    `src/lib/skillVersionResolver.test.ts` and
    `src/lib/__fixtures__/skill-version-resolver/{claude,codex,gemini,agents}/SKILL.md`.
  - Confirmed acceptance checks:
    - `npx tsc --noEmit`
    - `npx biome check src/lib/skillVersionResolver.ts src/lib/skillVersionResolver.test.ts src/lib/__fixtures__/skill-version-resolver/claude/SKILL.md src/lib/__fixtures__/skill-version-resolver/codex/SKILL.md src/lib/__fixtures__/skill-version-resolver/gemini/SKILL.md src/lib/__fixtures__/skill-version-resolver/agents/SKILL.md src/components/skills/SkillsInstalledSection.tsx src/components/skills/SkillsInstalledSection.test.tsx src/services/CliMaintenanceService.ts`
    - `npx vitest run src/lib/skillVersionResolver.test.ts src/components/skills/SkillsInstalledSection.test.tsx src/services/CliMaintenanceService.test.ts`
- Files changed
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Version hint extraction should remain centralized in one resolver chain and
      tested with cross-provider fixture frontmatter shapes instead of provider-specific
      branching in services/UI.
  - Gotchas encountered
    - Story scope was already implemented in the current branch; this iteration
      focused on acceptance verification and progress logging.
---

## 2026-03-01 - US-011
- What was implemented
  - Verified activation/deactivation transaction path already exists in
    `src/services/CliMaintenanceService.ts`:
    `setSkillActivation` composes move + refresh + audit append in
    `runSkillStoreMoveTransaction` and restores moved directories on failure.
  - Verified activation audit payload persistence is implemented with required fields
    (`provider`, `skillId`, `before`, `after`, `timestamp`) via
    `SkillActivationAuditStore.append` and `FileSkillActivationAuditStore`
    (`src/services/maintenance/skillActivationAuditLog.ts`).
  - Verified UI recent activation event query path is wired end-to-end:
    IPC `tools:get-skill-activation-events`
    (`src/ipc/handlers/toolsHandlers.ts`) ->
    preload `toolsAPI.getSkillActivationEvents`
    (`src/preload/apis/tools.ts`) ->
    hook load (`src/hooks/useInstalledSkills.ts`) ->
    render in `Recent Activation Events`
    (`src/components/skills/SkillsInstalledSection.tsx`).
  - Confirmed acceptance checks:
    - `npx tsc --noEmit`
    - `npx biome check src/services/CliMaintenanceService.ts src/services/CliMaintenanceService.test.ts src/services/maintenance/skillActivationAuditLog.ts src/services/maintenance/skillActivationAuditLog.test.ts src/hooks/useInstalledSkills.ts src/components/skills/SkillsInstalledSection.tsx src/components/skills/SkillsInstalledSection.test.tsx src/ipc/handlers/toolsHandlers.ts src/preload/apis/tools.ts src/types/api/tools.ts src/types/tool-maintenance.ts`
    - `npx vitest run src/services/CliMaintenanceService.test.ts src/services/maintenance/skillActivationAuditLog.test.ts src/components/skills/SkillsInstalledSection.test.tsx`
- Files changed
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Activation state changes should treat move + state refresh + audit append as one
      transaction boundary; rollback must reverse the move when refresh/audit fails.
  - Gotchas encountered
    - Story scope was already implemented in the current branch; this iteration focused
      on acceptance verification and progress logging.
---
