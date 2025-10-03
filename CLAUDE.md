# Claude CLI Analytics & Control Platform

Claude CLI의 실행을 제어하고 컨텍스트 사용을 최적화하기 위한 분석 플랫폼입니다. Electron 기반으로 Claude CLI를 헤드리스 모드로 실행하며, 상세한 로깅과 프로세스 분석을 통해 효율적인 컨텍스트 관리를 지원합니다.

## 실행 방법

```bash
npm run start
```

## 현재 기능

### 실행 및 모니터링
1. **병렬 실행 관리**: 여러 Claude CLI 프로세스를 동시에 실행하고 모니터링
2. **실시간 스트리밍**: Stream JSON 형식의 실시간 응답을 파싱하여 표시
3. **실행 이력 관리**: 모든 실행 내역을 세션 ID로 추적 및 조회
4. **프로세스 제어**: 실행 중인 프로세스 종료 및 정리 기능

### 프로젝트 관리
5. **Claude 프로젝트 탐색**: 프로젝트별 세션 로그 조회 및 관리
6. **세션 이어가기**: 이전 세션을 선택하여 대화 재개
7. **MCP 설정 관리**: 프로젝트별 MCP 서버 설정 생성 및 편집

### 작업 관리 (Tasks) - Execute 최적화
8. **의존성 분석**: 작업 수행에 필요한 파일 및 문서 의존성 사전 정의
9. **컨텍스트 배정**: Execute 시 자동으로 필요한 컨텍스트 구성
10. **작업 영역 관리**: 계층적 Work Area 시스템으로 작업 분류 및 필터링
11. **작업 영역 할당**: Area 설정으로 불필요한 컨텍스트 차단
12. **Execute 통합**: Task를 선택하여 최적화된 Claude CLI 실행
13. **성공 기준 검증**: 체크리스트 기반 결과 검증
14. **리뷰 시스템**: 리뷰어 지정 및 산출물 검토

### Agent 관리
15. **전문화된 Agent 정의**: 프로젝트 및 사용자 레벨 Agent 관리
16. **도구 그룹 선택**: 7개 도구 그룹으로 투명한 권한 관리
17. **Permission 패턴**: 파일 및 명령어 접근 제어
18. **Agent 컨텍스트**: 프로젝트 아키텍처 및 코딩 규칙 문서 제공

### 문서 및 설정
19. **Memory 편집기**: CLAUDE.md 파일의 참조 및 컨텍스트 관리
20. **문서 탐색**: Claude Code 및 컨트롤러 문서 통합 뷰어
21. **설정 관리**: 애플리케이션 설정 및 프로젝트 경로 관리

## 예정 기능

### 컨텍스트 제어
- **컨텍스트 크기 모니터링**: 실시간 토큰 사용량 추적
- **컨텍스트 최적화 제안**: 불필요한 컨텍스트 자동 감지 및 제거 제안
- **커스텀 컨텍스트 프리셋**: 프로젝트별 최적화된 컨텍스트 설정 저장/로드
- **컨텍스트 윈도우 관리**: 동적 컨텍스트 윈도우 크기 조절

### 로깅 및 분석
- **상세 실행 로그**: 모든 Claude CLI 실행 내역 및 파라미터 기록
- **응답 시간 분석**: 쿼리별 응답 시간 측정 및 통계
- **토큰 사용량 분석**: 입력/출력 토큰 사용 패턴 분석
- **비용 추적**: API 사용 비용 실시간 계산 및 리포트

### 프로세스 분석
- **작업 패턴 분석**: 자주 사용하는 명령 및 쿼리 패턴 식별
- **성능 메트릭**: CPU/메모리 사용량, 네트워크 지연시간 모니터링
- **에러 패턴 분석**: 반복되는 에러 유형 감지 및 해결 방안 제시
- **워크플로우 최적화**: 작업 흐름 분석을 통한 개선점 도출

### 데이터 시각화
- **대시보드**: 주요 메트릭 실시간 시각화
- **트렌드 차트**: 시간대별 사용 패턴 및 성능 추이
- **히트맵**: 컨텍스트 사용 집중도 시각화
- **리포트 생성**: 분석 결과 PDF/Excel 내보내기

## 기술 스택

- **Electron**: 데스크톱 앱 프레임워크
- **React 19**: UI 라이브러리
- **Vite**: 빌드 도구
- **TypeScript**: 타입 안전성
- **IPC 통신**: Main process와 Renderer process 간 통신

## 아키텍처

### Main Process
- **ProcessManager** (`src/services/ProcessManager.ts`): 병렬 실행 프로세스 관리
- **StreamParser** (`src/lib/StreamParser.ts`): Stream JSON 파싱
- **SessionManager** (`src/services/SessionManager.ts`): 실행 이력 관리
- **IPC Router**: 모듈화된 IPC 핸들러 시스템

### Preload APIs
안전한 IPC API를 window 객체에 노출:

- **claudeAPI**: Claude CLI 실행 및 이벤트 구독
- **claudeSessionsAPI**: 프로젝트 세션 조회 및 관리
- **taskAPI**: 작업 생성/조회/수정/삭제
- **agentAPI**: Agent 생성/조회/수정/삭제
- **workAreaAPI**: Work Area 조회 및 관리
- **settingsAPI**: MCP 설정 관리
- **bookmarksAPI**: 북마크 관리
- **docsAPI**: 문서 조회
- **metadataAPI**: 메타데이터 관리
- **fileAPI**: 파일 읽기/쓰기

### Renderer (React)
페이지별 구성:

- **ExecutionsPage**: 실행 목록 및 새 실행 생성
- **ExecutionDetailPage**: 실행 상세 및 실시간 스트림
- **TasksPage**: 작업 정의 및 관리
- **AgentsPage**: Agent 정의 및 관리
- **ClaudeProjectsListPage**: 프로젝트 목록
- **ClaudeSessionsListPage**: 세션 목록
- **ClaudeSessionDetailPage**: 세션 상세
- **MemoryPage**: CLAUDE.md 편집
- **McpConfigsPage**: MCP 설정 편집
- **SettingsPage**: 앱 설정

### 데이터 구조

**Tasks** (`.claude/tasks/*.md`):
```markdown
---
id: task-001
title: Task title
area: Backend/Authentication
assigned_agent: claude-sonnet-4
reviewer: claude-opus-4
status: pending | in_progress | completed | cancelled
---
## References
## Success Criteria
## Description
## Review Notes
```

**Agents** (`.claude/agents/*.md`):
```markdown
---
name: task-creator
description: 프로젝트 분석 후 구조화된 Task를 생성하는 전문 Agent
allowedTools:
  - Read
  - Grep
  - mcp__serena__*
  - Write
permissions:
  allowList:
    - "read:**"
    - "write:.claude/tasks/**"
  denyList:
    - "read:.env"
    - "write:src/**"
---
## Agent Instructions
[Agent 역할 및 수행 방법 설명]
```

**Work Areas** (`.claude/work-areas.json`):
```json
{
  "areas": [
    {
      "id": "frontend-pages",
      "category": "Frontend",
      "subcategory": "Pages",
      "displayName": "Frontend/Pages",
      "description": "페이지 컴포넌트"
    }
  ]
}
```

**Execution Info**:
```typescript
{
  sessionId: string;
  pid: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  projectPath: string;
  query: string;
  events: StreamEvent[];
}
```

## IPC 채널

### Claude 실행
- `claude:execute`: 명령 실행 요청
- `claude:started`: 프로세스 시작 알림
- `claude:stream`: Stream JSON 이벤트 전송
- `claude:error`: 에러 발생
- `claude:complete`: 프로세스 완료
- `claude:killExecution`: 프로세스 종료
- `claude:cleanupExecution`: 실행 정보 정리

### Task 관리
- `task:listTasks`: 작업 목록 조회
- `task:getTask`: 작업 상세 조회
- `task:createTask`: 작업 생성
- `task:updateTask`: 작업 수정
- `task:deleteTask`: 작업 삭제

### Agent 관리
- `agent:listAgents`: Agent 목록 조회
- `agent:getAgent`: Agent 상세 조회
- `agent:createAgent`: Agent 생성
- `agent:updateAgent`: Agent 수정
- `agent:deleteAgent`: Agent 삭제

### Work Area 관리
- `work-area:getWorkAreas`: Work Area 목록 조회
- `work-area:updateWorkAreas`: Work Area 설정 수정

### 기타
- `dialog:selectDirectory`: 디렉토리 선택
- `settings:*`: MCP 설정 관리
- `claude-sessions:*`: 세션 조회
- `bookmarks:*`: 북마크 관리
- `docs:*`: 문서 조회
- `file:*`: 파일 작업

## 프로젝트 비전

이 프로젝트는 단순한 Claude CLI 실행 도구를 넘어, AI 개발 워크플로우의 효율성을 극대화하는 분석 플랫폼을 지향합니다. 컨텍스트 사용을 최적화하고, 상세한 로깅과 분석을 통해 개발자가 더 효과적으로 Claude를 활용할 수 있도록 지원하는 것이 목표입니다.

### 핵심 가치
- **효율성**: 컨텍스트 최적화를 통한 비용 절감
- **가시성**: 모든 프로세스의 투명한 모니터링
- **인사이트**: 데이터 기반 의사결정 지원
- **자동화**: 반복 작업 및 최적화 자동화

## Claude Code 실행 설정

### 권한 관리
프로젝트는 `.claude/settings.json`을 통해 세밀한 권한 제어를 사용합니다.
`--dangerously-skip-permissions` 대신 필요한 권한만 명시적으로 허용하여 안전하게 자동화합니다.

**설정 파일:** `.claude/settings.json` (팀 공유, git 커밋됨)

**자세한 내용:** [SETUP.md](./docs/SETUP.md) | [실행 전략](./docs/claude-context/usage/claude-execution-strategy.md) | [권한 설정](./docs/claude-context/config/permissions-configuration.md)

### MCP 서버 선택
- **분석용:** `.claude/.mcp-analysis.json` (serena + sequential-thinking)
- **개발용:** `.claude/.mcp-dev.json` (serena + context7)
- **최소:** `.claude/.mcp-empty.json` (MCP 없음)

## 테스트용 쿼리 템플릿

### UI 입력 → CLI 명령어 변환
UI의 Query 입력란에 입력한 내용은 다음과 같이 변환됩니다:
```
UI 입력: "/context"
↓
CLI 실행: claude -p "/context" --output-format stream-json --verbose \
  --mcp-config .claude/.mcp-dev.json --strict-mcp-config
```

**특징:**
- `settings.json`의 권한 규칙 자동 적용 (안전)
- 개발용 MCP 서버만 로드 (빠른 초기화)
- 안전하면서도 자동화된 실행

### 빠른 테스트용 명령어 (터미널에서 직접 실행)

```bash
# 프로젝트 디렉토리로 이동
cd /Users/junwoobang/project/claude-code-spec

# 1. 읽기 전용 분석 (Plan 모드)
claude --permission-mode plan \
  --mcp-config .claude/.mcp-analysis.json --strict-mcp-config \
  -p "프로젝트 아키텍처 분석"

# 2. /context 명령어 (settings.json 권한 사용)
claude -p "/context" --output-format stream-json --verbose \
  --mcp-config .claude/.mcp-dev.json --strict-mcp-config

# 3. 간단한 질문 (최소 MCP)
claude --mcp-config .claude/.mcp-empty.json --strict-mcp-config \
  -p "What files are in this directory?"

# 4. 코드 분석
claude --mcp-config .claude/.mcp-analysis.json --strict-mcp-config \
  -p "Explain the StreamParser class in src/lib/StreamParser.ts"

# 5. 파일 수정 (settings.json 권한 사용)
claude --mcp-config .claude/.mcp-dev.json --strict-mcp-config \
  -p "Add a comment to the processChunk method explaining what it does"

# 6. 실시간 모니터링
claude --output-format stream-json --verbose \
  --mcp-config .claude/.mcp-dev.json --strict-mcp-config \
  -p "/context" 2>&1 | tee test-output.log
```

### UI에서 테스트하기

1. **프로젝트 경로**: `/Users/junwoobang/project/claude-code-spec`
2. **테스트 쿼리**:
   - `/context` - 현재 컨텍스트 정보 확인
   - `/help` - 도움말 확인
   - `List all files in src/components` - 파일 목록
   - `What is the purpose of this project?` - 프로젝트 설명

### 출력 형식 확인

Stream JSON 출력은 JSONL 형식 (JSON Lines):
```jsonl
{"type":"system","subtype":"init","session_id":"...","model":"...","cwd":"..."}
{"type":"message","subtype":"assistant","message":{"role":"assistant","content":[...]}}
{"type":"result","result":{"status":"success","duration_ms":1234}}
```

각 줄은 완전한 JSON 객체여야 하며, 줄바꿈(`\n`)으로 구분됩니다.

---

## Memory 관리 영역

아래 영역들은 Memory Editor를 통해 관리됩니다.

<!-- MEMORY_START: references -->
## References
@context/memory/index.md
@context/config/permissions-configuration.md
<!-- MEMORY_END: references -->

<!-- MEMORY_START: tools -->
## Development Tools


`@context/usage/claude-execution-strategy.md` 

- 실행 전략 문서입니다. 필요 시 참조하세요.
- 실행
<!-- MEMORY_END: tools -->