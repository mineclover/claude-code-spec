# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*
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
