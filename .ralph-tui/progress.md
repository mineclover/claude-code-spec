# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Capability matrix resolution pattern:
  - Declare `capability` per service with `maintenance/execution/skills/mcp`.
  - Always pass declarations through `resolveCapabilityMatrix(...)` with fallback inference from actual contracts (`tools`, `skillStore`, `execution`, `mcp`) so omitted fields get safe defaults.
  - Gate runtime adapters by capability flags (`enabled ? contract : undefined`) to avoid partial/unsafe activation.

---

## [2026-03-01] - US-001
- What was implemented
  - Verified the standard Capability Matrix schema is already implemented across `maintenance/execution/skills/mcp` in shared types and adapter runtime normalization.
  - Verified built-in service capability declarations for `claude/codex/gemini/ralph/moai` are documented in `references/maintenance-services.md` and covered by adapter tests.
  - Verified safe defaults are applied when capability declarations are missing via `resolveCapabilityMatrix` and `createCustomMaintenanceAdapters` tests.
  - Re-ran quality gates for the story scope (`tsc`, `biome`, `vitest`) and confirmed pass.
- Files changed
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Capability flags should be treated as the single source of truth for runtime adapter exposure, with contracts inferred only as fallback for omitted declarations.
  - Gotchas encountered
    - `biome check` currently evaluates only supported file types; markdown files in the command may be skipped without failing the run.
---
