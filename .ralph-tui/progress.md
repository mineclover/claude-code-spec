# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- 신규 스키마 필드를 점진적으로 도입할 때는 `resolve*` 헬퍼를 만들어 `명시값 > 유추값 > 안전 기본값` 순으로 정규화하고, 런타임 소비 지점에서 해당 정규화 결과만 사용한다.

---

## 2026-03-01 - US-001
- What was implemented: `Maintenance/Execution/Skills/MCP` 4개 영역을 포함하는 공통 Capability Matrix 타입을 추가하고, registry validator/런타임 adapter/CliMaintenanceService/문서 예시까지 capability 기반으로 연동했다.
- Files changed: `src/types/capability-matrix.ts`, `src/lib/capabilityMatrix.ts`, `src/types/maintenance-registry.ts`, `src/lib/maintenanceRegistryValidation.ts`, `src/lib/maintenanceRegistryValidation.test.ts`, `src/services/maintenance/serviceIntegrations.ts`, `src/services/maintenance/serviceIntegrations.test.ts`, `src/services/CliMaintenanceService.ts`, `src/hooks/useMaintenanceRegistryEditor.ts`, `references/maintenance-services.md`, `references/maintenance-services.example.json`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: capability 같은 선언형 스키마는 validator + runtime adapter 양쪽에서 동시에 반영해야 실제 동작 보장이 된다.
  - Gotchas encountered: 기존 registry payload 호환성을 유지하려면 capability 미기재를 에러로 만들지 말고, 런타임 기본값 추론으로 연결해야 회귀를 막을 수 있다.
---
