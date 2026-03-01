# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- 신규 스키마 필드를 점진적으로 도입할 때는 `resolve*` 헬퍼를 만들어 `명시값 > 유추값 > 안전 기본값` 순으로 정규화하고, 런타임 소비 지점에서 해당 정규화 결과만 사용한다.
- capability 선언에 따라 필수 계약 필드를 강제해야 할 때는 `define*` 등록 헬퍼 + conditional type 조합으로 빌드 타임 제약을 두고, 런타임에서는 동일 계약을 `resolveCapabilityMatrix` 결과로 다시 게이트한다.
- 경로 템플릿(`${ENV}`/`~`) 확장과 skills disabled root 파생 규칙은 `lib` 공통 유틸로 승격해 내장/커스텀 어댑터가 동일 정규화 경로를 재사용하게 만든다.
- 버전드 설정 도입 시에는 `migrate*ToLatest` 파이프라인과 `run*MigrationTransaction`(apply/rollback) 보호 헬퍼를 함께 두어 `구버전 흡수`와 `실패 시 원복`을 동일 규칙으로 강제한다.
- 플래그 우선순위 분기가 필요한 CLI 명령 조합은 `fallback` 세그먼트에 우선 브랜치를 앞에서부터 선언하고, 각 브랜치 내부는 `conditional` 그룹으로 묶어 하나의 의미 단위(예: `mcp-config + strict`)를 원자적으로 출력한다.
- 도구별 MCP 플래그 정책은 전용 `mcpLaunch` 세그먼트로 승격하고, `resolveMcpLaunchStrategy`에서 `명시값 > 유추값 > 안전 기본값` 정규화 후 런타임에서 strict-only 허용 여부(`allowWithoutConfig`)를 게이트한다.
- 멀티 소스 설정 병합이 필요한 경우에는 `get*Candidates` 집계 API를 먼저 만들고, 소비 API(`get*List`/생성 API)는 후보 결과를 재사용하게 연결해 충돌 규칙을 단일 merge comparator로 고정한다.
- 세션 경로 해석은 `extract*FromEvent`와 `resolve*` 정규화 헬퍼를 분리해 `세션 명시 경로(cwd/projectPath) > 디렉토리명 유추 > 안전 기본값` 우선순위를 고정하고, 런타임 소비는 정규화 결과만 사용한다.
- provider별 파일시스템 레이아웃 차이가 있는 스캐너는 `resolve*Strategy`(명시값 > provider 유추값 > 안전 기본값)와 `scan/move` 공통 FS 헬퍼를 분리해 symlink/숨김 디렉토리/EXDEV fallback 규칙을 단일 구현으로 고정한다.
- 메타데이터 포맷이 provider마다 다른 힌트 필드는 `resolve*Info` 헬퍼로 `frontmatter > metadata > lockfile > source > fallback` 체인을 고정하고, UI 표시는 `format*` 헬퍼/상수 fallback을 재사용해 문구 드리프트를 방지한다.
- 파일 이동 기반 상태 전환에 후속 갱신/감사 로그를 결합할 때는 `run*MoveTransaction(apply/rollback)`으로 묶고, `rollbackError`까지 결과에 포함해 상위 계층이 복구 실패를 명시적으로 처리하게 만든다.
- 업데이트 필요도처럼 외부 최신 버전 조회가 선택적인 도메인은 `resolve*Need` 헬퍼로 `명시 정책 > 상태/버전 비교 유추 > 안전 기본값`을 고정하고, UI/배치 실행/로그 API는 해당 정규화 필드만 소비하게 만든다.

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

## 2026-03-01 - US-004
- What was implemented: maintenance registry 루트를 `schemaVersion + services` 문서로 승격하고, `migrateMaintenanceRegistryToLatest` 파이프라인(v1 배열 루트 → v2 문서 루트) 및 `runMaintenanceRegistryMigrationTransaction` 롤백 보호 로직을 추가했다. 또한 settings load/save 경로에 마이그레이션을 연결해 레거시 키(`maintenanceServices`)를 자동 승격/정리하도록 했고, editor/API/문서/예시를 최신 포맷으로 맞췄다.
- Files changed: `src/types/maintenance-registry.ts`, `src/lib/maintenanceRegistryMigration.ts`, `src/lib/maintenanceRegistryMigration.test.ts`, `src/lib/maintenanceRegistryValidation.ts`, `src/lib/maintenanceRegistryValidation.test.ts`, `src/services/appSettings.ts`, `src/ipc/handlers/settingsHandlers.ts`, `src/preload/apis/settings.ts`, `src/types/api/settings.ts`, `src/hooks/useMaintenanceRegistryDraft.ts`, `src/hooks/useMaintenanceRegistryDraft.test.ts`, `src/hooks/useMaintenanceRegistryEditor.ts`, `src/components/skills/SkillsRegistrySection.tsx`, `src/components/skills/SkillsRegistrySection.test.tsx`, `src/pages/SkillsPage.test.tsx`, `references/maintenance-services.md`, `references/maintenance-services.example.json`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: 레거시 입력 허용이 필요한 validator는 직접 다형 루트를 검증하기보다 `migration -> latest schema validation` 2단계로 분리하면 오류 경로 표시와 런타임 소비 포맷을 동시에 단순화할 수 있다.
  - Gotchas encountered: settings 로드 시 자동 마이그레이션을 디스크에 즉시 반영할 때 저장 실패 가능성이 있으므로, 메모리 스냅샷 기반 `save-with-rollback` 경로를 같이 두지 않으면 부분 적용 상태가 남을 수 있다.
---

## 2026-03-01 - US-005
- What was implemented: CLI command rule catalog에 `conditional` 그룹과 `fallback` 세그먼트를 추가하고, `CliCommandComposer`/`ToolRegistry`를 재귀 조합/검증 구조로 확장했다. `claude` 명령 정의를 새 규칙으로 리팩터링해 `mcpConfig + strictMcpConfig` 우선순위와 permission 모드 분기를 선언형으로 표현했고, 조합 결과를 스냅샷 테스트로 고정했다.
- Files changed: `src/types/cli-tool.ts`, `src/services/CliCommandComposer.ts`, `src/services/ToolRegistry.ts`, `src/data/cli-tools/claude.ts`, `src/services/CliCommandComposer.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: 기존 `option/static/mapped`만으로는 조합 우선순위를 여러 곳에서 중복 조건으로 표현하게 되므로, `fallback(우선순위)` + `conditional(그룹 원자성)` 조합이 규칙 카탈로그 확장성과 가독성을 동시에 확보한다.
  - Gotchas encountered: `fallback` 후보에 빈 배열을 반환하는 세그먼트가 섞여도 다음 후보로 안전하게 진행되어야 하므로, `first non-empty` 선택 규칙을 컴포저/테스트에 동시에 고정하지 않으면 도구별 플래그 회귀가 발생하기 쉽다.
---

## 2026-03-01 - US-006
- What was implemented: CLI command spec에 `mcpLaunch` 세그먼트를 추가해 도구별 MCP launch 전략(`mcp-config`/`strict` 조합)을 선언형으로 분리했다. `CliCommandComposer`에는 `resolveMcpLaunchStrategy` 정규화 경로를 도입해 strict-only 허용 여부를 도구별로 제어하고, `ToolRegistry` 검증과 `claude` 정의/테스트를 새 전략으로 이관했다.
- Files changed: `src/types/cli-tool.ts`, `src/services/CliCommandComposer.ts`, `src/services/ToolRegistry.ts`, `src/data/cli-tools/claude.ts`, `src/services/CliCommandComposer.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: 조합 규칙을 세그먼트 타입(`mcpLaunch`)으로 올리면 개별 CLI 정의는 정책만 선언하고, 런타임 합성기는 공통 게이트(`allowWithoutConfig`)만 유지해 도구별 분기를 확장하기 쉬워진다.
  - Gotchas encountered: `mcp-config` 경로가 있을 때 strict를 항상 포함할지 여부와 strict-only 허용 여부는 서로 다른 규칙이므로, 단일 boolean으로 합치면 조합 회귀가 생겨 별도 필드로 분리해야 안전하다.
---

## 2026-03-01 - US-007
- What was implemented: 전역(`~/.claude.json`)/프로젝트(`.mcp*.json`, `.claude|.codex|.gemini/.mcp*.json`) source를 통합하는 `getMcpServerCandidates` API를 추가하고, 충돌 시 `projectLocal > project > global` 우선순위 + 동일 우선순위 내 source order comparator로 deterministic merge를 적용했다. 또한 `getMcpServerList`/`createMcpConfig`/`createMcpDefaultConfig`가 해당 candidate API를 재사용하도록 연결하고 IPC/preload/settings API contract에 candidate endpoint를 노출했다.
- Files changed: `src/services/settings.ts`, `src/services/settings.test.ts`, `src/ipc/handlers/settingsHandlers.ts`, `src/preload/apis/settings.ts`, `src/types/api/settings.ts`, `src/types/api/index.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: 서버 선택 UI와 설정 파일 생성기가 같은 후보 집계기를 공유하면 merge 규칙이 분기되지 않아 도구별(default target) 생성 경로 회귀를 줄일 수 있다.
  - Gotchas encountered: 프로젝트 source를 전역 source보다 나중에 읽더라도 우선순위 comparator가 분리되어 있지 않으면 입력 순서 변경만으로 충돌 결과가 바뀌므로, source scope 기반 priority를 명시적으로 두는 편이 안전하다.
---

## 2026-03-01 - US-008
- What was implemented: 세션 이벤트/메타데이터의 경로 필드를 우선 해석하는 `sessionPathResolver` 유틸(`extractSessionPathFromEvent`, `resolveSessionPath`)을 추가하고, `claudeSessions`가 해당 정규화 결과를 통해 프로젝트 경로를 결정하도록 연결했다. 디렉토리명 기반 dash 추정은 `inferProjectPathFromDashDirName` fallback으로만 분리했으며 기본 경로 해석은 세션 명시 경로 우선으로 고정했다. 또한 `agent-town`, `agent_town`, `agent.town` 특수문자 케이스를 포함한 회귀 테스트를 추가했다.
- Files changed: `src/lib/sessionPathResolver.ts`, `src/lib/sessionPathResolver.test.ts`, `src/services/claudeSessions.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: 경로 해석처럼 추정 오차 비용이 큰 영역은 이벤트 스키마 탐색(`extract*`)과 우선순위 정규화(`resolve*`)를 분리하면 fallback 정책을 런타임 전체에 일관되게 강제할 수 있다.
  - Gotchas encountered: Claude dash 디렉토리명은 하이픈을 구분자로도 데이터로도 사용하므로(`agent-town`) 역변환 기반 유추를 기본 경로로 쓰면 오탐이 생기며, 메타데이터 경로를 우선 추출하지 않으면 회귀가 재발한다.
---

## 2026-03-01 - US-009
- What was implemented: provider별 skill store 스캔을 `skillStoreScanner` 전략 인터페이스로 분리하고, `CliMaintenanceService`가 해당 전략의 installRoot/disabledRoot 후보를 통해 스캔/활성화 경로를 해석하도록 리팩터링했다. 또한 symlink 허용 + 숨김 디렉토리 제외 스캔 규칙과 EXDEV 이동 fallback(copy+remove), 스킬 목록 dedupe/정렬 comparator를 공통 헬퍼로 승격했다.
- Files changed: `src/services/maintenance/skillStoreScanner.ts`, `src/services/maintenance/skillStoreScanner.test.ts`, `src/services/CliMaintenanceService.ts`, `src/services/maintenance/serviceIntegrations.ts`, `src/types/maintenance-adapter-sdk.ts`, `src/types/maintenance-registry.ts`, `src/lib/maintenanceRegistryValidation.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: provider 확장이 예정된 스캔 로직은 서비스 클래스 내부 분기보다 전략 해석(`resolve*`) + 공통 FS 동작(`scan/move`) 분리 구조가 테스트와 회귀 방지에 유리하다.
  - Gotchas encountered: Node 내장 `fs.promises` 메서드는 직접 spy가 불가능한 경우가 있어(EXDEV 테스트), 파일 연산 의존성 주입 포인트를 열어 테스트에서 모의 구현을 주입해야 안정적으로 검증할 수 있다.
---

## 2026-03-01 - US-010
- What was implemented: `resolveSkillVersionInfo`/`formatSkillVersionHint` 헬퍼를 추가해 버전 힌트 해석을 `frontmatter > metadata > lockfile > source > fallback(unknown)` 순서로 정규화했다. `CliMaintenanceService`는 새 resolver 결과만 사용하도록 연결했고, `SkillsInstalledSection`은 공통 formatter를 사용해 버전 정보 부재 시 fallback 문구를 일관되게 표시하도록 정리했다. 또한 provider별 샘플 `SKILL.md` fixture(claude/codex/gemini/agents) 기반 resolver 테스트를 추가해 체인 우선순위를 고정했다.
- Files changed: `src/lib/skillVersionResolver.ts`, `src/lib/skillVersionResolver.test.ts`, `src/lib/__fixtures__/skill-version-resolver/claude/SKILL.md`, `src/lib/__fixtures__/skill-version-resolver/codex/SKILL.md`, `src/lib/__fixtures__/skill-version-resolver/gemini/SKILL.md`, `src/lib/__fixtures__/skill-version-resolver/agents/SKILL.md`, `src/services/CliMaintenanceService.ts`, `src/components/skills/SkillsInstalledSection.tsx`, `src/components/skills/SkillsInstalledSection.test.tsx`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: provider별로 버전 필드 위치가 달라도 resolver 입력을 `(frontmatter, metadata, lock)`로 고정하면 서비스 런타임과 UI 표시 포맷을 동시에 단순화할 수 있다.
  - Gotchas encountered: lockfile `source`는 항상 semver를 담지 않으므로 source fallback은 raw source를 그대로 쓰지 말고 `@`/`#`/query 기반 추출 후에만 버전 힌트로 채택해야 잘못된 표기를 줄일 수 있다.
---

## 2026-03-01 - US-011
- What was implemented: 스킬 활성/비활성 전환 경로를 `runSkillStoreMoveTransaction(apply/rollback)` 기반 트랜잭션으로 감싸고, 이동 후 상태 refresh 또는 감사 로그 저장 실패 시 롤백하도록 `CliMaintenanceService.setSkillActivation`을 리팩터링했다. 또한 파일 기반 `FileSkillActivationAuditStore`를 추가해 `provider/skillId/before/after/timestamp` 이벤트를 영속 저장하고, IPC(`tools:get-skill-activation-events`) 및 renderer hook/UI를 통해 최근 activation 이벤트를 조회/표시하도록 연결했다.
- Files changed: `src/types/tool-maintenance.ts`, `src/services/maintenance/skillActivationAuditLog.ts`, `src/services/maintenance/skillActivationAuditLog.test.ts`, `src/services/maintenance/skillStoreScanner.ts`, `src/services/maintenance/skillStoreScanner.test.ts`, `src/services/CliMaintenanceService.ts`, `src/services/CliMaintenanceService.test.ts`, `src/ipc/handlers/toolsHandlers.ts`, `src/types/api/tools.ts`, `src/preload/apis/tools.ts`, `src/hooks/useInstalledSkills.ts`, `src/pages/SkillsPage.tsx`, `src/components/skills/SkillsInstalledSection.tsx`, `src/components/skills/SkillsInstalledSection.test.tsx`, `src/pages/SkillsPage.module.css`, `src/pages/SkillsPage.test.tsx`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: 트랜잭션 apply 단계에 `상태 refresh + 감사 로그 append`까지 포함하면 로그 저장 실패도 동일 rollback 경로로 흡수할 수 있어 상태/감사 일관성을 유지하기 쉽다.
  - Gotchas encountered: 디렉토리 이동 롤백은 항상 가능한 것이 아니므로(경로 미존재/2차 실패) transaction result에 `rollbackError`를 노출하고 호출부에서 별도 에러 메시지로 승격해야 디버깅이 가능하다.
---

## 2026-03-01 - US-012
- What was implemented: CLI 버전 체크에 `latestVersion/updateRequired/updateReason` 필드를 추가해 업데이트 필요도를 명시적으로 계산하고, 선택된 도구만 순차 배치 업데이트하는 `runToolUpdates` + 성공/실패 요약을 도입했다. 또한 `FileToolUpdateAuditStore` 기반 실행 로그 저장/조회 API(`runToolUpdates`, `getToolUpdateLogs`)를 IPC/preload/renderer까지 연결하고, Skills 페이지를 업데이트 플래너 UI(선택/배치 실행/요약/로그 조회)로 확장했다.
- Files changed: `src/types/tool-maintenance.ts`, `src/types/api/tools.ts`, `src/services/maintenance/toolUpdateAuditLog.ts`, `src/services/maintenance/toolUpdateAuditLog.test.ts`, `src/services/CliMaintenanceService.ts`, `src/services/CliMaintenanceService.test.ts`, `src/services/maintenance/serviceIntegrations.ts`, `src/ipc/handlers/toolsHandlers.ts`, `src/preload/apis/tools.ts`, `src/hooks/useCliMaintenance.ts`, `src/components/skills/SkillsCliMaintenanceSection.tsx`, `src/components/skills/SkillsCliMaintenanceSection.test.tsx`, `src/pages/SkillsPage.tsx`, `src/pages/SkillsPage.test.tsx`, `src/pages/SkillsPage.module.css`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: 배치 업데이트처럼 롤백이 어려운 작업은 실행 성공/실패 자체와 로그 저장을 분리하고, 로그 append 실패는 결과를 깨지 않도록 격리해야 운영 복원력이 높다.
  - Gotchas encountered: 최신 버전 조회 커맨드를 도구별로 항상 제공할 수 없으므로(비 npm/커스텀 CLI), 업데이트 필요도는 semver 비교 실패/최신 조회 실패를 포함한 안전 기본값 경로를 반드시 가져야 UI 오판을 줄일 수 있다.
---
