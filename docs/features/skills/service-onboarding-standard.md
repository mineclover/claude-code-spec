# 서비스 추가 표준 절차 (Maintenance Service Onboarding Kit)

새 maintenance service를 registry에 추가할 때는 아래 절차를 그대로 따른다.

## 1) 코드 템플릿으로 시작

- 템플릿 파일: `src/services/maintenance/adapterTemplate.ts`
- 기본 템플릿 함수: `createNpmMaintenanceAdapterTemplate(serviceId)`
- 템플릿이 이미 `defineMaintenanceServiceAdapter`를 통해 계약 필드(`tools`, `execution`, `mcp`)를 포함한다.

## 2) Adapter Contract Example 확인

신규 서비스 등록 시 타입 계약은 아래 typecheck 예제로 검증한다.

- 계약 타입 정의: `src/types/maintenance-adapter-sdk.ts`
- 계약 typecheck 예제: `src/types/maintenance-adapter-sdk.typecheck.ts`

핵심 규칙:
- capability에서 `maintenance.enabled: true`면 `tools`가 필수
- capability에서 `skills.enabled: true`면 `skillStore`가 필수
- capability에서 `execution.enabled: true`면 `execution`이 필수
- capability에서 `mcp.enabled: true`면 `mcp`가 필수

## 3) Registry Validation Example 실행

온보딩 payload 검증 예제는 아래 테스트를 기준으로 작성/확장한다.

- 예제 테스트: `src/services/maintenance/adapterTemplate.test.ts`
  - 템플릿 생성 결과가 계약 필드를 충족하는지 검증
  - 템플릿 기반 registry payload가 `validateMaintenanceRegistryPayload`를 통과하는지 검증
  - 계약 필드가 모두 없는 payload가 올바르게 거부되는지 검증

## 4) 서비스 추가 체크리스트

- [ ] `service.id`를 lowercase kebab-case로 확정했다.
- [ ] `tool.id`/`versionCommand.command`를 실제 실행 파일명과 일치시켰다.
- [ ] `updateCommand`를 비대화형 옵션(`--yes` 등)으로 구성했다.
- [ ] capability 선언과 계약 필드(`tools/skillStore/execution/mcp`)를 일치시켰다.
- [ ] Registry JSON이 schemaVersion `2` 문서 루트를 사용한다.
- [ ] UI 저장 전 `validateMaintenanceRegistryPayload` 기준 오류가 없는지 확인했다.
- [ ] 아래 품질 게이트를 통과했다.

## 5) 품질 게이트

```bash
npx tsc --noEmit
npx biome check src/services/maintenance/adapterTemplate.test.ts docs/features/skills/service-onboarding-standard.md docs/features/skills/index.md .ralph-tui/progress.md
npx vitest run src/services/maintenance/adapterTemplate.test.ts src/lib/maintenanceRegistryValidation.test.ts
```

## Related References

- `references/maintenance-services.md`
- `references/maintenance-services.example.json`
