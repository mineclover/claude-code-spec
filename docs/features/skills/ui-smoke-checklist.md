# Skills/CLI Maintenance UI Smoke Checklist

## 목적

Electron 앱에서 다음 기능이 실제 클릭 흐름으로 정상 동작하는지 빠르게 검증한다.

- CLI 버전 조회/업데이트
- 설치된 스킬 조회
- 스킬 활성화/비활성화
- 세션 경로 정합성(`agent-town` 같은 하이픈 경로)

## 범위

- Route: `/skills`, `/sessions`, `/mcp-configs`, `/settings`, `/`
- Tool: `claude`, `codex`, `gemini`

## 사전 조건

1. 앱 실행: `npm run start`
2. 전역 CLI 설치 확인
3. 최소 1개 이상의 스킬 설치 상태(`~/.codex/skills` 등)
4. 세션 데이터 존재(`~/.claude/projects` 또는 `~/.codex/sessions` 등)

## 공통 확인 포인트

1. 콘솔에 IPC 오류가 없는지 확인
2. 버튼 클릭 시 로딩 상태(`Checking...`, `Updating...`, `Refreshing...`)가 표시되는지 확인
3. 완료 후 성공/실패 메시지가 화면에 표시되는지 확인

## 1) Sidebar/Tool Selector

### 절차

1. 좌측 Tool 버튼에서 `Claude`, `Codex`, `Gemini`를 각각 클릭한다.
2. 각 클릭 후 `/sessions`로 이동한다.

### 기대 결과

1. 선택한 Tool 버튼만 active 스타일로 보인다.
2. Sessions 목록이 선택 Tool 기준으로 리로드된다(프로젝트/세션 목록 초기화 후 재조회).

## 2) Skills 페이지 핵심 점검 (`/skills`)

### A. Maintenance Service Registry

#### 절차

1. `Use Example` 클릭
2. `Save Registry` 클릭
3. `Reload` 클릭
4. JSON을 고의로 깨뜨린 뒤 `Save Registry` 클릭

#### 기대 결과

1. 정상 JSON 저장 시 `Registry saved.` 표시
2. 저장 후 도구/스킬 목록이 재조회됨
3. 잘못된 JSON 저장 시 에러 메시지 표시(예: JSON parse error, array 형식 에러)

### B. CLI Version & Update

#### 절차

1. `Check Versions` 클릭
2. 각 카드에서 `Update` 클릭 (`claude`, `codex`, `gemini`, `ralph-tui`, `skills`)

#### 기대 결과

1. 버전이 카드 상태에 표시된다(예: `0.104.0`)
2. 업데이트 성공 시 `<toolId> update completed.` 표시
3. 업데이트 실패 시 stderr/error가 메시지에 포함되어 표시

### C. Installed Skills / Activation

#### 절차

1. `Refresh` 클릭
2. 목록에서 임의의 active 스킬 1개를 `Deactivate`
3. 같은 스킬을 즉시 `Activate`로 롤백

#### 기대 결과

1. install/disabled 경로가 provider별로 출력된다.
2. deactivate 후 상태가 `Inactive`로 바뀐다.
3. activate 후 상태가 `Active`로 복구된다.

## 3) Sessions 페이지 경로 정합성 (`/sessions`)

### 절차

1. Tool을 `Claude`로 선택
2. Projects 목록에서 `agent-town` 프로젝트를 선택
3. Sessions 목록에서 임의 세션 선택 후 로그 로딩 확인
4. Tool을 `Codex`로 바꿔 같은 방식으로 확인

### 기대 결과

1. 프로젝트 표기가 `agent-town`으로 유지된다.
2. `agent/town`처럼 잘못 분해된 경로가 표시되지 않는다.
3. 세션 로그가 빈 배열이 아니면 우측 `Session Log`에 분류 렌더링된다.

## 4) MCP Configs 프로젝트 선택 연동 (`/mcp-configs`)

### 절차

1. 상단 `Project` 버튼 클릭
2. 프로젝트 피커에서 `agent-town` 선택
3. 기존 config 선택 후 `Save`
4. 필요 시 `+ New Configuration`으로 생성 테스트

### 기대 결과

1. 선택한 프로젝트 경로가 피커/헤더에 반영된다.
2. JSON 유효성 실패 시 저장 차단 + 에러 토스트
3. 저장 성공 시 `Saved` 토스트

## 5) Settings 기본 동작 (`/settings`)

### 절차

1. `Claude Projects Path`에서 `Default` -> `Save`
2. `MCP Configuration Resource Paths`에서 `Set Default`
3. 임의 경로 `+ Add Path` 후 `Remove`
4. `Quick Project Select`로 프로젝트 선택

### 기대 결과

1. `Saved!`, `Added!`, `Default path added` 메시지가 적절히 표시
2. Quick Project Select 클릭 시 현재 프로젝트 컨텍스트가 변경됨

## 6) Execute 최소 동작 (`/`)

### 절차

1. Tool `claude` 선택 후 짧은 query 실행
2. Tool `codex` 선택 후 짧은 query 실행
3. Tool `gemini` 선택 후 짧은 query 실행

### 기대 결과

1. 실행 중 `Stop`, 종료 후 `Execute` 버튼으로 복귀
2. 스트림 이벤트가 출력 패널에 렌더링
3. 실행 실패 시 콘솔 에러 로그와 함께 상태가 멈추지 않고 복구

## 합격 기준

아래를 모두 만족하면 Smoke 통과로 판단한다.

1. `/skills`의 버전 체크/업데이트/스킬 토글이 정상 동작
2. `/sessions`, `/mcp-configs`에서 경로 정합성 이슈 미재현(`agent/town` 없음)
3. `/`(Execute)에서 3개 Tool 최소 1회 실행 가능
4. 치명적 런타임 에러(white screen, unhandled exception) 없음

## 실패 시 우선 확인

1. Main 프로세스 로그의 IPC 에러(`tools:*`, `sessions:*`, `settings:*`, `execute:*`)
2. CLI 실행 경로/권한 문제(`ENOENT`, npm/bun 설치 충돌)
3. 스킬 루트 경로 존재 여부 (`~/.codex/skills`, `~/.agents/skills` 등)
