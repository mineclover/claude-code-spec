# Prefix Fingerprint & Session Analysis Roadmap

**작성일**: 2026-04-17
**대상 범위**: 세션 분석, prefix fingerprint, cache metrics, MCP Compose

---

## 요약

Claude Code의 **prompt cache 효과 극대화**를 목표로 하는 분석 레이어. 동일 prefix(시스템 프롬프트 + MCP 설정 + 초기 메시지)가 반복될 때 캐시 히트율이 올라가므로, prefix 품질을 측정·시각화·관리하기 위한 도구군을 구축한다.

**핵심 원칙:**
- MCP 기본 OFF + 실행 시점 명시적 opt-in (해제 포함)
- 기존 JSONL에서도 분석 가능 (앱 실행으로 작성된 세션에만 의존하지 않음)
- Electron 모듈 격리: core 서비스는 순수 Node에서 동작

---

## 단계 구성

| Phase | 범위 | 상태 |
|-------|------|------|
| **Phase 1** | Observability — 캐시·핑거프린트 수집/표시 | 완료 |
| **Phase 2** | MCP Compose — Registry × Policy × Execution Override | 완료 |
| **보조** | UI polish, execa 이행, CLI surface | 완료 |

---

## Phase 1 — Observability (완료)

### 1.1 데이터 모델 · 계산

| ID | 작업 | 주요 산출물 |
|----|------|------------|
| T1 | 캐시/핑거프린트 캡처 포인트 탐색 | 기존 `StreamParser`, `claudeSessions` 진입점 파악 |
| T2 | `StreamParser` 확장: `system/init` + `usage` 캐시 필드 | `stream-events.ts`에 `cache_creation.ephemeral_5m/1h_input_tokens` 필드 추가 |
| T3 | Prefix Fingerprint 데이터 모델 설계 (static + observed) | `src/types/prefix-fingerprint.ts` — `StaticFingerprint`, `ObservedFingerprint`, `FingerprintPair`, `FingerprintDrift`, `CacheMetrics`, `SessionMeta`, `DerivedSessionMeta`, `SessionMetaView` |
| T4 | Static fingerprint 계산 구현 | `src/services/FingerprintService.ts` — CLAUDE.md + @-imports + skills + agents + mcpResolved → sha256 |
| T5 | Observed fingerprint 계산 구현 | `src/lib/observedFingerprint.ts` — `extractObservedFingerprint(systemInit)`, `detectDrift(static, observed)` |
| T6 | 세션 로그에 fingerprint + cache metrics 영속화 | `SessionMetaStore` — `~/.claude/projects/<dash>/<sessionId>.meta.json` 사이드카 |
| T7 | `claude-sessions:get-session-analysis` IPC 확장 | 사이드카 fields + derived 합성 반환 |

**핵심 해시 규칙:**
- `prefixHashing.ts` — `sha256OfCanonicalJson`, `sha256OfSortedList`, `sha256OfNamedContents`
- canonical JSON(키 정렬)으로 결정론적 해싱

### 1.2 세션 분석 · IPC

| ID | 작업 | 주요 산출물 |
|----|------|------------|
| T8 | `ClaudeSessionsListPage`에 cache 그룹핑 + 캐시-히트 인디케이터 | 프로젝트별 fingerprint 그룹 수 표시 |
| T16 | 대시(-) 포함 프로젝트 경로 해석 버그 수정 | `extractCwdFromSessionFileHead` 32KB 멀티라인 스캔, 명시 cwd 우선 |
| T17 | 사이드카 파일 미기록 원인 진단 | `persistSidecar` 진단 로그 추가 |
| T18 | `SessionAnalyticsService` 구현 — JSONL에서 metrics/fingerprint 도출 | `analyzeSessionFile()`, `analyzeProjectDir({skipSessionIds, onProgress})`, mtime+size LRU 캐시 |
| T19 | derived-meta IPC 추가 + 사이드카 optional화 | `get-project-session-views` — 사이드카 우선, 없으면 derived |
| T20 | execute-side 기능 보류 전환 | 분석 레이어를 기존 JSONL 중심으로 피벗 |
| T21 | derived 세션 분석에 mtime-keyed cache + progress | `sessions:load-progress` broadcast, 133+ 세션 프로젝트 UX 개선 |

### 1.3 UI: Sessions 페이지

| ID | 작업 | 주요 산출물 |
|----|------|------------|
| T22 | Sessions 헤더에 dot legend 툴팁 추가 | solid=사이드카 / hollow=derived / dashed=no meta |
| T23 | `classifyClaudeEntry`를 internal-log 이벤트 타입까지 확장 | `ClassifiedEntry`에 `hookSummary`, `file-history-snapshot`, `last-prompt`, `permission-mode`, `attachment.*` 케이스 추가 |
| T24 | `ClassifiedLogEntry`의 system 이벤트에 raw-JSON expand 토글 | 디버깅 편의 |
| T25 | hook-related 로그 이벤트 구조화 렌더링 | `HookSummaryBlock` — phase/hooks/durations/BLOCKED/errors |
| T26 | Session Log에 카테고리 필터 chip 추가 | Messages, sub-agents, tools, thinking, system, hooks |
| T27 | 엔트리 주소 라벨 (`#N` 및 `#N.k`) | M = JSONL content 배열 내 원 위치(blockIndex), 필터링된 인덱스 아님 |

---

## 보조 작업 (완료)

| ID | 작업 | 주요 산출물 |
|----|------|------------|
| T28 | CLI 실행 call site 전체를 execa로 이행 | `src/lib/cliRunner.ts` — `runBuffered`, `spawnStreaming` (forceKillAfterDelay 3s), `MultiCliExecutionService`·`CliMaintenanceService`·`moaiHandlers` 마이그레이션 |
| T29 | Core 서비스용 Node CLI surface 추가 | `src/cli/index.ts` — `analyze` / `session` / `fingerprint` / `groups` / `legend`; `npm run cli` 스크립트; vitest smoke 6/6 |

**실행 예:**

```bash
npm run cli -- analyze --claude-dir ~/.claude/projects/-Users-junwoobang-workflow-claude-code-spec
# Sessions: 1 · Groups: 1 · Dir: ...
# SESSION     SRC       GROUP         MODEL           CACHE   TOOLS
# 88c93be0    derived   4bfb6bdd98    opus-4-7        100.0%     24
```

**격리 보증**: CLI는 `electron`/`settingsService`를 전이적으로 import하지 않음. 테스트가 `main(argv)`를 직접 호출하여 import 체인을 컴파일 타임에 검증.

---

## Phase 2 — MCP Compose (완료)

| ID | 작업 | 주요 산출물 | 상태 |
|----|------|-------------|------|
| T9 | MCP Registry / Project Policy 스키마 설계 | `src/types/mcp-policy.ts` — `McpRegistryEntry`, `McpPolicyFile`, `McpExecutionOverride {add, remove}`, `ResolvedMcpConfig`, `McpPreset` | 완료 |
| T10 | MCP resolution 파이프라인 | `src/services/McpResolverService.ts` — loadRegistry / loadPolicy / resolve / materialize. 13/13 테스트 통과 | 완료 |
| T11 | MCP Registry 관리 UI | `src/pages/McpRegistryPage.tsx` — user/project scope, 카테고리 그룹핑, id/command/args/env CRUD | 완료 |
| T12 | Project MCP Policy editor UI | `src/pages/McpPolicyPage.tsx` — defaultEnabled/allowed/forbidden 체크박스 매트릭스, 실시간 hash preview | 완료 |
| T13 | Execution-time Compose 패널 | `src/components/mcp/McpComposePanel.tsx` — baseline 대비 ON/OFF 토글 → add/remove 자동 도출, 실행 시 `mcpOverride` 전달 | 완료 |
| T14 | Pinned Presets | `.claude/mcp-presets.json`, Compose 패널 내 Load/Save/Delete 칩. ralph 유형(`remove: [sequential-thinking]`) 재사용 대응 | 완료 |
| T15 | 결정된 MCP config을 session meta에 기록 | `MultiCliExecutionService.execute`가 override 있을 시 resolver 호출 → materialize → `execution.mcpResolved` 세팅. `persistSidecar`가 `SessionMeta.mcpResolved` (해시/baseline/add/remove/canonicalJson) 기록 | 완료 |

**파이프라인 동작:**
1. ExecutePage의 `McpComposePanel`이 registry+policy 로드, baseline 체크박스 초기값 세팅
2. 사용자가 토글하면 `deriveOverride(enabled, baseline)` → `{add, remove}` 계산
3. Execute 시 override가 baseline과 다를 때만 `mcpOverride` IPC로 전송
4. `MultiCliExecutionService`가 resolver 실행 → `.claude/.mcp-generated-<hash12>.json` 생성 → `options.mcpConfig`를 해당 경로로 덮어씀
5. 세션 종료 시 `SessionMeta.mcpResolved`에 `{enabledServerIds, hash, baselineServerIds, overrideAdd, overrideRemove, canonicalJson}` 기록

**재현성**: `SessionMeta.mcpResolved.canonicalJson`이 인라인 저장되므로 `.mcp-generated-*.json` 파일이 나중에 삭제돼도 과거 실행의 MCP 구성을 정확히 재구성 가능.

---

## 아키텍처 결정 요약

### ADR-1: 사이드카 우선 → reader 우선 피벗
**맥락**: 초기에 사이드카(앱 실행 시 기록)만 사용 → 기존 JSONL 세션이 대시보드에 전혀 보이지 않음.
**결정**: `SessionMetaView = sidecar | derived` 합집합. derived는 JSONL에서 추출(정확도 낮음, 범위 넓음), sidecar는 앱 실행 시 기록(정확도 높음, 범위 좁음).
**영향**: 수백 개 이력 세션이 즉시 분석 대상에 편입. "점이 하나도 없는" UX 이슈 해소.

### ADR-2: Electron 모듈 격리
**맥락**: `SessionMetaStore`가 `claudeSessions`→`appSettings`→`electron`을 전이 import. CLI에서 크래시.
**결정**: CLI의 `readAllSidecars`를 인라인 구현(사이드카 파일 직접 읽기). core 서비스(`FingerprintService`, `SessionAnalyticsService`)는 pure Node.
**영향**: `npm run cli`가 tsx에서 실행 가능. CI에서 테스트 가능.

### ADR-3: 주소 체계에서 M의 의미
**후보**: (a) 필터링된 tool 배열 인덱스, (b) JSONL content 배열 내 원 위치.
**결정**: (b). `ToolCallInfo.blockIndex` = `i + 1` (원 content 배열의 1-based 위치). 필터 On/Off과 무관하게 같은 블록은 같은 주소.
**영향**: `#3.2`가 "3번 엔트리의 content[1]"을 안정적으로 가리킴.

### ADR-4: execa 이행
**맥락**: 3개 call site가 각자 spawn 래퍼 소유 → 에러/타임아웃/PATH/stdin 입력 처리 중복·누락.
**결정**: `runBuffered` / `spawnStreaming` 두 함수로 통일. `shellPath.getSpawnEnv()`를 중앙화.
**영향**: `CliMaintenanceService.executeCommand`가 45줄 → 9줄. macOS ENOENT("spawn claude") 이슈 한 곳에서 해결.

### ADR-5: MCP 3층 해소 (T9 설계, T10-T15 보류)
**레지스트리**: 전역에 선언된 모든 MCP 엔트리 (`~/.claude/mcp-registry.json`).
**정책**: 프로젝트 기본값 (`.claude/mcp-policy.json`) — Registry 부분집합 선택.
**Override**: 실행 시점 `{add: [], remove: []}` — Registry에 있지만 Policy에서 뺀 항목을 add, Policy에 있지만 이번 실행에서 뺄 항목을 remove.
**해소 규칙**: `(Policy.servers ∪ Override.add) \ Override.remove`, 최종 결과를 `.claude/.mcp-generated.json`으로 실체화 후 `--mcp-config`.

---

## 주요 파일 지도

**타입**
- `src/types/prefix-fingerprint.ts` — 핵심 도메인 타입
- `src/types/mcp-policy.ts` — MCP 3층 타입 (설계 완료)
- `src/types/stream-events.ts` — cache_creation 서브필드 포함

**라이브러리 (pure)**
- `src/lib/prefixHashing.ts` — canonical JSON / sha256 유틸
- `src/lib/cacheMetrics.ts` — `emptyCacheMetrics`, `updateCacheMetrics`, `aggregateCacheMetrics`
- `src/lib/observedFingerprint.ts` — system/init → observed fingerprint
- `src/lib/sessionClassifier.ts` — JSONL 엔트리 분류 + blockIndex 주소 체계
- `src/lib/cliRunner.ts` — execa 래퍼 (`runBuffered`, `spawnStreaming`)
- `src/lib/shellPath.ts` — macOS login-shell PATH 증강

**서비스**
- `src/services/FingerprintService.ts` — static fingerprint 계산
- `src/services/SessionAnalyticsService.ts` — JSONL에서 derived meta 도출 (+ mtime 캐시)
- `src/services/SessionMetaStore.ts` — 사이드카 read/write (claudeSessions 의존)
- `src/services/MultiCliExecutionService.ts` — execa 기반, sidecar 기록

**IPC**
- `src/ipc/handlers/sessionsHandlers.ts` — `get-session-meta`, `get-project-session-metas`, `get-project-session-views`

**UI**
- `src/pages/SessionsPage.tsx` — 필터 chip, fingerprint dot + legend, progress 표시
- `src/components/sessions/ClassifiedLogEntry.tsx` — `#N.k` 라벨, raw JSON 토글, `HookSummaryBlock`

**CLI**
- `src/cli/index.ts` — analyze / session / fingerprint / groups / legend
- `src/cli/index.test.ts` — programmatic smoke tests (6)

---

## 테스트 현황

- `npm test` — 189/193 passing
- 모든 테스트 통과 (이전의 `SkillsPage.test.tsx` 4건 실패는 `CliMaintenancePage.test.tsx`로 이동하면서 해소 — 페이지 리팩토링 때 테스트가 함께 옮겨지지 않아 stale 상태였음)
- CLI 스모크: 6/6 — parseArgs, help, unknown, session, analyze, groups --json

---

## 다음 단계 (재개 시)

1. **Phase 2 착수 전제**: execute 경로 정책 재검토 결과 확인
2. **데이터 축적**: Phase 1 observability로 프로젝트별 fingerprint drift 기록을 1~2주 쌓아 "Override 효과" 측정 기준선 확보
3. **T10부터 직렬 진행**: resolution 파이프라인 → Registry UI → Policy UI → Compose 패널 → Presets → session meta 기록
4. **검증 지표**: Compose 적용 전/후 cacheHitRatio 비교, 동일 fingerprint 그룹 수 증가율
