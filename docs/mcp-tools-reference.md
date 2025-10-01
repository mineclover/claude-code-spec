# MCP Tools Reference

## 개요

사용 가능한 모든 MCP 서버와 도구 목록입니다. `--mcp-config`와 `--strict-mcp-config` 옵션으로 필요한 도구만 선택할 수 있습니다.

## 전체 MCP 서버 조회

```bash
# 사용자 설정에서 MCP 서버 목록 확인
jq '.mcpServers | keys' ~/.claude.json
```

## 사용 가능한 MCP 서버

### 1. serena (@agentic-insights/mcp-server-serena)

**설명:** 코드 심볼 분석, 파일 검색, 리팩토링 지원

**도구 목록 (20개):**
- `mcp__serena__list_dir` - 디렉토리 목록 조회
- `mcp__serena__find_file` - 파일 검색
- `mcp__serena__search_for_pattern` - 패턴 검색
- `mcp__serena__get_symbols_overview` - 심볼 개요
- `mcp__serena__find_symbol` - 심볼 찾기
- `mcp__serena__find_referencing_symbols` - 참조 심볼 찾기
- `mcp__serena__replace_symbol_body` - 심볼 본문 교체
- `mcp__serena__insert_after_symbol` - 심볼 뒤에 삽입
- `mcp__serena__insert_before_symbol` - 심볼 앞에 삽입
- `mcp__serena__write_memory` - 메모리 저장
- `mcp__serena__read_memory` - 메모리 읽기
- `mcp__serena__list_memories` - 메모리 목록
- `mcp__serena__delete_memory` - 메모리 삭제
- `mcp__serena__activate_project` - 프로젝트 활성화
- `mcp__serena__get_current_config` - 현재 설정 조회
- `mcp__serena__check_onboarding_performed` - 온보딩 확인
- `mcp__serena__onboarding` - 온보딩 실행
- `mcp__serena__think_about_collected_information` - 수집 정보 분석
- `mcp__serena__think_about_task_adherence` - 작업 준수 확인
- `mcp__serena__think_about_whether_you_are_done` - 완료 여부 판단

**설정:**
```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "serena",
      "args": ["start-mcp-server", "--context", "ide-assistant", "--project", "$(pwd)"],
      "env": {}
    }
  }
}
```

### 2. sequential-thinking (@modelcontextprotocol/server-sequential-thinking)

**설명:** 복잡한 문제를 단계적으로 해결하는 추론 도구

**도구 목록 (1개):**
- `mcp__sequential-thinking__sequentialthinking` - 단계적 사고 프로세스

**설정:**
```json
{
  "mcpServers": {
    "sequential-thinking": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "env": {}
    }
  }
}
```

### 3. context7 (@upstash/context7-mcp)

**설명:** 최신 라이브러리 문서 제공

**도구 목록 (2개):**
- `mcp__context7__resolve-library-id` - 라이브러리 ID 해석
- `mcp__context7__get-library-docs` - 라이브러리 문서 가져오기

**설정:**
```json
{
  "mcpServers": {
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {}
    }
  }
}
```

### 4. magic (@21st-dev/magic)

**설명:** UI 컴포넌트 생성 및 로고 검색

**도구 목록 (4개):**
- `mcp__magic__21st_magic_component_builder` - UI 컴포넌트 빌더
- `mcp__magic__21st_magic_component_inspiration` - UI 영감 검색
- `mcp__magic__21st_magic_component_refiner` - UI 컴포넌트 개선
- `mcp__magic__logo_search` - 로고 검색

**설정:**
```json
{
  "mcpServers": {
    "magic": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@21st-dev/magic"],
      "env": {}
    }
  }
}
```

### 5. playwright (@playwright/mcp)

**설명:** 브라우저 자동화 및 테스트

**도구 목록 (23개):**
- `mcp__playwright__browser_close` - 브라우저 닫기
- `mcp__playwright__browser_resize` - 브라우저 크기 조절
- `mcp__playwright__browser_console_messages` - 콘솔 메시지 조회
- `mcp__playwright__browser_handle_dialog` - 다이얼로그 처리
- `mcp__playwright__browser_evaluate` - JavaScript 실행
- `mcp__playwright__browser_file_upload` - 파일 업로드
- `mcp__playwright__browser_fill_form` - 폼 채우기
- `mcp__playwright__browser_install` - Playwright 설치
- `mcp__playwright__browser_press_key` - 키 입력
- `mcp__playwright__browser_type` - 텍스트 입력
- `mcp__playwright__browser_navigate` - 페이지 이동
- `mcp__playwright__browser_navigate_back` - 뒤로 가기
- `mcp__playwright__browser_network_requests` - 네트워크 요청 조회
- `mcp__playwright__browser_take_screenshot` - 스크린샷
- `mcp__playwright__browser_snapshot` - 접근성 스냅샷
- `mcp__playwright__browser_click` - 클릭
- `mcp__playwright__browser_drag` - 드래그 앤 드롭
- `mcp__playwright__browser_hover` - 호버
- `mcp__playwright__browser_select_option` - 옵션 선택
- `mcp__playwright__browser_tabs` - 탭 관리
- `mcp__playwright__browser_wait_for` - 대기

**설정:**
```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"],
      "env": {}
    }
  }
}
```

## 기본 도구 (MCP 없이 항상 사용 가능)

- `Task` - 서브 에이전트 실행
- `Bash` - 셸 명령 실행
- `Glob` - 파일 패턴 검색
- `Grep` - 파일 내용 검색
- `Read` - 파일 읽기
- `Edit` - 파일 편집
- `Write` - 파일 쓰기
- `WebFetch` - 웹 페이지 가져오기
- `WebSearch` - 웹 검색
- `TodoWrite` - 할 일 목록 작성
- `SlashCommand` - 슬래시 명령 실행
- `ExitPlanMode` - Plan 모드 종료
- `NotebookEdit` - Jupyter 노트북 편집
- `BashOutput` - 백그라운드 셸 출력
- `KillShell` - 셸 프로세스 종료
- `ListMcpResourcesTool` - MCP 리소스 목록
- `ReadMcpResourceTool` - MCP 리소스 읽기

## 실행 예시

### 1. 전체 도구 확인

```bash
# 모든 MCP 로드하고 도구 목록 확인
claude -p "/context" --output-format stream-json --verbose 2>&1 | \
  grep '"type":"system"' | jq -r '.tools[]' | sort
```

### 2. 특정 MCP만 사용

```bash
# serena만 사용
claude -p "코드 분석" \
  --mcp-config .claude/.mcp-analysis.json \
  --strict-mcp-config

# .mcp-analysis.json:
# {
#   "mcpServers": {
#     "serena": { ... }
#   }
# }
```

### 3. 용도별 MCP 조합

#### 분석 전용 (읽기 + 사고)
```json
{
  "mcpServers": {
    "serena": { ... },
    "sequential-thinking": { ... }
  }
}
```

**도구 개수:** 21개 (serena 20 + sequential-thinking 1)

#### 개발 전용 (코드 + 문서)
```json
{
  "mcpServers": {
    "serena": { ... },
    "context7": { ... }
  }
}
```

**도구 개수:** 22개 (serena 20 + context7 2)

#### UI 개발 (코드 + UI)
```json
{
  "mcpServers": {
    "serena": { ... },
    "magic": { ... }
  }
}
```

**도구 개수:** 24개 (serena 20 + magic 4)

#### E2E 테스트 (코드 + 브라우저)
```json
{
  "mcpServers": {
    "serena": { ... },
    "playwright": { ... }
  }
}
```

**도구 개수:** 43개 (serena 20 + playwright 23)

## MCP 설정 파일 위치

### User Level (모든 프로젝트)
```
~/.claude.json
```

### Project Level (프로젝트별)
```
.claude/.mcp-*.json
```

## 도구 조회 명령어

```bash
# 1. 사용자 설정의 MCP 서버 목록
jq '.mcpServers | keys' ~/.claude.json

# 2. 특정 MCP 서버 설정 보기
jq '.mcpServers.serena' ~/.claude.json

# 3. 현재 활성화된 도구 목록 (실행 시)
claude -p "/context" --output-format stream-json --verbose 2>&1 | \
  grep '"type":"system"' | jq -r '.tools[]' | grep '^mcp__'

# 4. MCP 서버별 도구 개수
claude -p "/context" --output-format stream-json --verbose 2>&1 | \
  grep '"type":"system"' | jq -r '.tools[]' | grep '^mcp__' | \
  cut -d_ -f3 | sort | uniq -c

# 5. 특정 MCP만 사용 시 도구 확인
claude -p "test" --output-format stream-json --verbose \
  --mcp-config .claude/.mcp-analysis.json --strict-mcp-config 2>&1 | \
  grep '"type":"system"' | jq -r '.tools[]' | grep '^mcp__'
```

## 도구 이름 형식

```
mcp__<server-name>__<tool-name>
```

**예시:**
- `mcp__serena__find_symbol` → serena 서버의 find_symbol 도구
- `mcp__magic__logo_search` → magic 서버의 logo_search 도구
- `mcp__playwright__browser_click` → playwright 서버의 browser_click 도구

## allowedTools 설정 (실험적)

**참고:** `allowedTools` 설정은 현재 테스트 중이며, 예상대로 작동하지 않을 수 있습니다.

대신 **`--mcp-config`로 필요한 MCP 서버만 선택하는 방식을 권장**합니다.

```json
{
  "mcpServers": {
    "serena": { ... }
  }
}
```

이 방식으로 serena의 20개 도구만 사용할 수 있습니다.

## 성능 비교

### 초기화 시간 (대략적)

| 설정 | MCP 서버 | 도구 개수 | 초기화 시간 |
|------|----------|-----------|-------------|
| 전체 | 6개 | ~70개 | ~5-10초 |
| 분석 | 2개 (serena + thinking) | 21개 | ~3-5초 |
| 개발 | 2개 (serena + context7) | 22개 | ~3-5초 |
| 최소 | 1개 (serena) | 20개 | ~2-3초 |
| 없음 | 0개 | 17개 (기본) | ~1-2초 |

## 추천 설정

### 코드 분석 작업
```bash
claude --mcp-config .claude/.mcp-analysis.json --strict-mcp-config
```

### 일반 개발 작업
```bash
claude --mcp-config .claude/.mcp-dev.json --strict-mcp-config
```

### UI 개발 작업
```bash
claude --mcp-config .claude/.mcp-ui.json --strict-mcp-config
```

### E2E 테스트 작업
```bash
claude --mcp-config .claude/.mcp-e2e.json --strict-mcp-config
```

## 참고 자료

- [MCP Configuration](./claude-context/mcp-config/mcp-configuration.md)
- [Execution Strategy](./claude-context/usage/claude-execution-strategy.md)
- [MCP 공식 문서](https://modelcontextprotocol.io/)
