# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- 신규 스키마 필드를 점진적으로 도입할 때는 `resolve*` 헬퍼를 만들어 `명시값 > 유추값 > 안전 기본값` 순으로 정규화하고, 런타임 소비 지점에서 해당 정규화 결과만 사용한다.
- capability 선언에 따라 필수 계약 필드를 강제해야 할 때는 `define*` 등록 헬퍼 + conditional type 조합으로 빌드 타임 제약을 두고, 런타임에서는 동일 계약을 `resolveCapabilityMatrix` 결과로 다시 게이트한다.
- 경로 템플릿(`${ENV}`/`~`) 확장과 skills disabled root 파생 규칙은 `lib` 공통 유틸로 승격해 내장/커스텀 어댑터가 동일 정규화 경로를 재사용하게 만든다.

---

## 2026-03-01 - US-001
- What was implemented: `Maintenance/Execution/Skills/MCP` 4개 영역을 포함하는 공통 Capability Matrix 타입을 추가하고, registry validator/런타임 adapter/CliMaintenanceService/문서 예시까지 capability 기반으로 연동했다.
- Files changed: `src/types/capability-matrix.ts`, `src/lib/capabilityMatrix.ts`, `src/types/maintenance-registry.ts`, `src/lib/maintenanceRegistryValidation.ts`, `src/lib/maintenanceRegistryValidation.test.ts`, `src/services/maintenance/serviceIntegrations.ts`, `src/services/maintenance/serviceIntegrations.test.ts`, `src/services/CliMaintenanceService.ts`, `src/hooks/useMaintenanceRegistryEditor.ts`, `references/maintenance-services.md`, `references/maintenance-services.example.json`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: capability 같은 선언형 스키마는 validator + runtime adapter 양쪽에서 동시에 반영해야 실제 동작 보장이 된다.
  - Gotchas encountered: 기존 registry payload 호환성을 유지하려면 capability 미기재를 에러로 만들지 말고, 런타임 기본값 추론으로 연결해야 회귀를 막을 수 있다.
---

## 2026-03-01 - US-002
- What was implemented: `Tool/SkillStore/Execution/MCP` 공통 adapter SDK 계약 타입(`maintenance-adapter-sdk`)을 분리하고, `defineMaintenanceServiceAdapter` 등록 헬퍼로 capability 기반 필수 계약 누락을 빌드 타임에 검출하도록 추가했다. 또한 `serviceIntegrations`를 SDK 계약 기반으로 정리하고, custom registry의 `execution/mcp`는 `resolve*` 헬퍼로 `명시값 > 유추값 > 안전 기본값` 정규화 경로를 도입했다.
- Files changed: `src/types/maintenance-adapter-sdk.ts`, `src/types/maintenance-adapter-sdk.typecheck.ts`, `src/types/maintenance-registry.ts`, `src/lib/maintenanceRegistryValidation.ts`, `src/lib/maintenanceRegistryValidation.test.ts`, `src/services/maintenance/serviceIntegrations.ts`, `src/services/maintenance/serviceIntegrations.test.ts`, `src/services/maintenance/adapterTemplate.ts`, `src/pages/SkillsPage.test.tsx`, `references/maintenance-services.md`, `references/maintenance-services.example.json`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: 빌드 타임 계약 강제는 negative type test(`@ts-expect-error`) 파일을 함께 두면 `tsc --noEmit` 단계에서 회귀를 바로 검출할 수 있다.
  - Gotchas encountered: conditional type의 false branch에 `{}` 대체 타입을 잘못 두면 등록 타입 전체가 과도하게 좁아져 정상 어댑터까지 누락 오류를 유발할 수 있어 `unknown` 같은 중립 타입으로 유지해야 한다.
---

## 2026-03-01 - US-003
- What was implemented: `claude/codex/gemini/ralph/moai/skills` 내장 서비스가 동일 SDK 등록/런타임 경로를 검증하도록 테스트를 보강했고, path resolution(`${ENV}`/`~`) + disabled root 파생 로직을 `pathTemplateUtils` 공통 유틸로 분리해 커스텀/내장 어댑터 정규화 경로를 통일했다. 또한 `CliMaintenanceService` 회귀 테스트를 추가해 버전 체크/업데이트/스킬 조회 핵심 기능을 고정했다.
- Files changed: `src/lib/pathTemplateUtils.ts`, `src/lib/pathTemplateUtils.test.ts`, `src/services/maintenance/serviceIntegrations.ts`, `src/services/maintenance/serviceIntegrations.test.ts`, `src/services/CliMaintenanceService.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: 내장/커스텀 어댑터가 같은 SDK를 써도 경로 정규화 유틸이 분산돼 있으면 동작 드리프트가 생기므로, 템플릿 확장 규칙을 단일 유틸로 고정하고 테스트를 함께 두는 편이 안전하다.
  - Gotchas encountered: `${ENV}` 리터럴을 테스트 문자열로 검증할 때 lint(`noTemplateCurlyInString`)와 충돌하므로 ``\${...}`` 이스케이프 템플릿 문자열을 사용해야 한다.
---
