# Agents Feature - Implementation Status & Tasks

## 현재 구현 상태

### ✅ 구현 완료

#### 1. 기본 인프라 (Phase 1)
- **Agent 타입 정의** (`src/types/agent.ts`)
  - `AgentMetadata`: name, description, allowedTools, permissions
  - `Agent`: 전체 Agent 객체 (content, filePath, source 포함)
  - `AgentListItem`: UI 목록 표시용 간소화된 타입

- **Agent 파서** (`src/lib/agentParser.ts`)
  - `parseAgentMarkdown()`: Markdown frontmatter 파싱 (YAML)
  - `generateAgentMarkdown()`: Agent 객체를 Markdown으로 변환
  - `validateAgent()`: Agent 메타데이터 검증 (name, description, allowedTools, permissions)

- **IPC 핸들러** (`src/ipc/handlers/agentHandlers.ts`)
  - `listAgents`: 프로젝트 및 사용자 레벨 Agent 목록 조회
  - `getAgent`: Agent 상세 정보 조회 (Markdown 원본)
  - `createAgent`: Agent 생성 (.claude/agents/ 또는 ~/.claude/agents/)
  - `updateAgent`: Agent 수정
  - `deleteAgent`: Agent 삭제
  - 프로젝트 레벨과 사용자 레벨 Agent 분리 처리

- **Preload API** (`src/preload/apis/agent.ts`)
  - `AgentAPI` 인터페이스 정의
  - IPC 채널을 통한 안전한 API 노출
  - Main process와 Renderer process 간 통신 구현

- **IPC 등록** (`src/main/ipc-setup.ts`)
  - `registerAgentHandlers()` 호출 확인
  - Agent 관련 IPC 채널 활성화

#### 2. Tool Groups 시스템 (Phase 2)
- **Tool Groups 타입 정의** (`src/types/toolGroups.ts`)
  - `ToolGroup` 인터페이스: id, name, description, tools, requiresMcp
  - `TOOL_GROUPS` 상수: 7개 그룹 정의
    1. All tools (특수 케이스: '*')
    2. Read-only tools (Read, Grep, Glob, WebFetch, WebSearch)
    3. Edit tools (Write, Edit)
    4. Execution tools (Bash)
    5. MCP tools (serena, magic, playwright 등 - 81개 도구)
    6. Task Management tools (Task, TodoWrite)
    7. Other tools (NotebookEdit, SlashCommand, KillShell, BashOutput)

- **유틸리티 함수**
  - `getAllTools()`: 모든 도구 목록 반환
  - `getToolsByGroups(groupIds)`: 그룹 ID들로부터 도구 목록 계산
  - `getGroupsByTools(tools)`: 도구 목록으로부터 그룹 ID들 역산

#### 3. UI 컴포넌트 (Phase 3)
- **AgentsPage** (`src/pages/AgentsPage.tsx`)
  - ✅ Agent 목록 표시 (프로젝트/사용자 레벨 구분)
  - ✅ Agent 상세 정보 표시 (allowedTools, permissions, content)
  - ✅ Agent CRUD 작업 (생성/조회/수정/삭제)
  - ✅ Storage Level 선택 (프로젝트/사용자)
  - ✅ 마크다운 에디터 (name, description, content)
  - ✅ ToolSelector 컴포넌트 통합
  - ✅ PermissionEditor 컴포넌트 통합
  - ✅ 입력 유효성 검증 (validateAgent 사용)
  - ✅ Toast 알림 (성공/실패)

- **ToolSelector** (`src/components/agent/ToolSelector.tsx`)
  - ✅ Quick Select: Tool Groups 체크박스 (7개 그룹)
  - ✅ Individual Tools: 개별 도구 선택
  - ✅ MCP Tools: 별도 섹션, 활성화 상태 표시
  - ✅ 그룹 상태 계산 (checked/indeterminate/unchecked)
  - ✅ MCP 서버 활성화 확인 (TODO로 표시됨)
  - ✅ MCP 도구 사용 시 경고 메시지

- **PermissionEditor** (`src/components/agent/PermissionEditor.tsx`)
  - ✅ Allow List 관리 (패턴 추가/제거)
  - ✅ Deny List 관리 (패턴 추가/제거)
  - ✅ 패턴 예시 제공
  - ✅ 입력 검증 (빈 문자열 방지)
  - ✅ Enter 키로 패턴 추가

- **AgentSelector** (`src/components/task/AgentSelector.tsx`)
  - ✅ TasksPage에서 사용할 Agent 선택 컴포넌트
  - ✅ 프로젝트/사용자 Agent 구분 표시 (optgroup)
  - ✅ 기본 모델 선택 (claude-sonnet-4, opus-4, haiku-4)
  - ✅ Agent 정보 표시 (description, tools count, permissions)
  - ✅ 로딩 상태 처리

- **MCP 설정 헬퍼** (`src/lib/mcpConfigHelper.ts`)
  - ✅ `getActiveMcpServers()`: 프로젝트의 활성 MCP 서버 목록 조회
  - ✅ `isMcpToolAvailable()`: MCP 도구 사용 가능 여부 확인
  - ✅ `groupMcpToolsByServer()`: MCP 도구를 서버별로 그룹화

#### 4. 샘플 Agent
- **task-creator.md** (`.claude/agents/task-creator.md`)
  - ✅ 프로젝트 분석 후 Task 생성하는 전문 Agent
  - ✅ allowedTools 설정 (Read, Grep, Glob, serena MCP tools, Write)
  - ✅ permissions 설정 (read:**, write:.claude/tasks/**)
  - ✅ 상세한 역할 및 프로세스 문서화

### ⚠️ 부분 구현

#### 1. MCP 서버 통합
- **현재 상태**: `ToolSelector`에서 MCP 서버 활성화 확인 로직이 TODO로 남아있음
  ```typescript
  // TODO: mcpConfigHelper.getActiveMcpServers() 호출
  // 현재는 임시로 빈 배열 반환
  setActiveMcpServers([]);
  ```
- **영향**: MCP 도구 선택 시 실제 활성화 여부 확인 불가
- **필요 작업**: `mcpConfigHelper.getActiveMcpServers()`를 IPC를 통해 호출하거나 클라이언트 측에서 직접 파일 읽기

#### 2. Tool Groups Quick Select 상호작용
- **구현됨**: 그룹 체크박스 클릭 시 해당 그룹의 모든 도구 선택/해제
- **미구현**: Indeterminate 상태에서의 클릭 동작 (현재는 단순히 토글)
- **개선 가능**: All tools 선택 시 다른 그룹 체크박스도 자동으로 체크 표시

## 검증 결과

### ✅ 정상 작동 확인
1. **Agent CRUD**
   - ✅ listAgents: 프로젝트 및 사용자 Agent 목록 조회
   - ✅ getAgent: Agent 상세 정보 로드
   - ✅ createAgent: 새 Agent 파일 생성
   - ✅ updateAgent: 기존 Agent 수정
   - ✅ deleteAgent: Agent 삭제 (확인 다이얼로그 포함)

2. **UI 컴포넌트**
   - ✅ AgentsPage: 좌측 목록, 우측 상세/편집 레이아웃
   - ✅ ToolSelector: 그룹 선택 및 개별 도구 선택 동작
   - ✅ PermissionEditor: 패턴 추가/제거 동작
   - ✅ 입력 유효성 검증: name, description 필수 체크

3. **파일 시스템**
   - ✅ 프로젝트 레벨 Agent: `.claude/agents/*.md`
   - ✅ 사용자 레벨 Agent: `~/.claude/agents/*.md`
   - ✅ 디렉토리 자동 생성 (ensureAgentsDirectory)

4. **Tool Groups**
   - ✅ 7개 그룹 정의 완료
   - ✅ getAllTools(): 94개 도구 반환 (MCP 도구 포함)
   - ✅ getToolsByGroups(): 그룹에서 도구 목록 추출
   - ✅ getGroupsByTools(): 도구 목록에서 그룹 역산

### ⚠️ 제한 사항
1. **MCP 도구 활성화 확인**
   - 현재 `activeMcpServers`가 항상 빈 배열
   - MCP 도구 선택 시 경고 메시지는 작동하지만 실제 확인은 안 됨

2. **Agent 실행 통합**
   - Agent 정의만 되어 있고, Execute와의 통합은 미구현
   - `--agent` 플래그로 Agent를 지정하는 CLI 실행은 아직 지원 안 됨

3. **TasksPage 통합**
   - AgentSelector 컴포넌트는 있지만 TasksPage에 통합되지 않음
   - Task에 assigned_agent 필드 할당하는 UI 없음

## 누락된 기능

### Phase 3: UI 컴포넌트 (미완성)
- [ ] TasksPage에 AgentSelector 통합
  - Task 생성/수정 시 Agent 할당 UI
  - assigned_agent, reviewer 필드 지원

### Phase 4: Execute 통합 (미구현)
- [ ] Task 기반 Execute 명령 생성 로직
  ```typescript
  function buildExecuteCommand(task: Task, projectPath: string): string {
    const args = [
      'claude',
      '--agent', task.assigned_agent,
      '--mcp-config', '.claude/.mcp-dev.json',
      '-p', `"Execute Task: ${task.id}"`,
    ];
    return args.join(' ');
  }
  ```

- [ ] Agent와 Task 정보를 Execute에 전달
  - Task 정의 (.claude/tasks/${task.id}.md) 자동 로드
  - References 파일 자동 컨텍스트 추가
  - Success Criteria 전달

- [ ] Execute 결과를 Reviewer Agent에게 전달하는 워크플로우

### Phase 5: 문서 및 예제 (부분 구현)
- [x] 샘플 Agent 파일 (task-creator.md)
- [x] Agent 작성 가이드 (README.md)
- [ ] 더 많은 샘플 Agent (test-generator, code-reviewer, doc-writer 등)
- [ ] Task + Agent 워크플로우 예제

## 개선점

### 1. UI/UX 개선
- [ ] **Tool Groups 시각화**
  - 그룹 선택 시 몇 개의 도구가 포함되는지 표시
  - 예: "Read-only tools (5 tools)"

- [ ] **MCP 도구 상태 표시 개선**
  - 현재 활성화된 MCP 서버를 상단에 명확히 표시
  - 비활성화된 MCP 도구는 흐리게 (disabled) 표시

- [ ] **Agent 미리보기**
  - Agent 목록에서 마우스 오버 시 간략한 정보 툴팁
  - allowedTools, permissions 요약 정보

- [ ] **Markdown 에디터 개선**
  - Syntax highlighting
  - Preview 모드 (렌더링된 Markdown 표시)
  - 템플릿 제공 (Role, Process, Constraints, Output Format)

- [ ] **검색 및 필터링**
  - Agent 목록 검색 (이름, 설명)
  - 도구별 필터링 (특정 도구를 사용하는 Agent만 표시)

### 2. 기능 강화
- [ ] **MCP 서버 활성화 실시간 확인**
  - `ToolSelector`에서 `mcpConfigHelper.getActiveMcpServers()` 호출
  - IPC 핸들러 추가 또는 클라이언트 측 파일 읽기 구현

- [ ] **Agent 템플릿**
  - 자주 사용하는 Agent 패턴을 템플릿으로 제공
  - Quick start: "Code Reviewer", "Test Generator", "Doc Writer"

- [ ] **Tool Groups 프리셋 저장**
  - 사용자가 자주 사용하는 도구 조합을 프리셋으로 저장
  - 예: "My Dev Tools", "Analysis Only"

- [ ] **Permission 패턴 자동 완성**
  - 자주 사용하는 패턴 제안
  - 프로젝트 구조 기반 패턴 제안 (src/, tests/, docs/)

- [ ] **Agent 복제 기능**
  - 기존 Agent를 복제하여 새 Agent 생성
  - 약간의 수정만으로 유사한 Agent 생성

### 3. 검증 강화
- [ ] **Agent 검증 개선**
  - Permission 패턴 문법 검증
  - Tool과 Permission 조합 검증 (예: Bash 도구 없이 bash:* 패턴 허용 경고)
  - 순환 참조 방지 (reviewer가 자기 자신인 경우)

- [ ] **중복 검증**
  - Agent 이름 중복 체크 (프로젝트/사용자 레벨 간)
  - Permission 패턴 중복 체크

- [ ] **보안 경고**
  - 위험한 권한 조합 경고 (write:**, bash:rm 등)
  - .env 파일 접근 허용 시 경고

### 4. Execute 통합 (우선순위 높음)
- [ ] **Execute 명령 생성**
  - Task에 할당된 Agent로 Execute 실행
  - Agent의 allowedTools, permissions를 Claude CLI에 전달

- [ ] **ExecutePage에서 Agent 사용**
  - Agent 선택 드롭다운
  - Agent 정보 표시
  - Agent 권한에 따른 실행 가능 여부 미리 확인

- [ ] **Agent 실행 이력**
  - 어떤 Agent가 어떤 Task를 수행했는지 기록
  - Agent 성능 메트릭 (성공률, 평균 실행 시간)

## 버그 및 이슈

### 🐛 확인된 버그
1. **MCP 서버 활성화 확인 미구현**
   - `ToolSelector.tsx` 30-40줄: TODO 주석으로 표시됨
   - 모든 MCP 도구가 항상 비활성화로 표시됨

2. **Tool Groups indeterminate 상태 클릭 동작**
   - 일부 도구만 선택된 상태에서 그룹 체크박스 클릭 시 동작이 명확하지 않음
   - 현재: 단순 토글 (선택 → 해제)
   - 제안: 부분 선택 → 전체 선택 → 전체 해제

3. **Agent 이름 중복 허용**
   - 프로젝트 레벨과 사용자 레벨에서 같은 이름의 Agent 허용됨
   - Agent 선택 시 혼란 가능성

### ⚠️ 잠재적 이슈
1. **대용량 Agent 목록**
   - Agent가 많을 경우 목록 렌더링 성능 문제 가능
   - 가상 스크롤 또는 페이지네이션 필요

2. **Markdown 파싱 오류 처리**
   - 잘못된 frontmatter 형식 시 에러 처리 미흡
   - 사용자에게 명확한 오류 메시지 필요

3. **파일 시스템 권한**
   - `~/.claude/agents/` 디렉토리 생성 실패 시 처리
   - 읽기 전용 파일 시스템에서 Agent 생성 불가

4. **동시성 문제**
   - 여러 창에서 동시에 Agent 수정 시 충돌 가능
   - 파일 잠금 또는 버전 관리 필요

## 다음 단계 (우선순위별)

### 🔴 High Priority
1. **MCP 서버 활성화 확인 구현**
   - `ToolSelector`에서 실제 MCP config 파일 읽기
   - IPC 핸들러 추가 또는 클라이언트 측 구현
   - 예상 시간: 2-4시간

2. **TasksPage에 AgentSelector 통합**
   - Task 생성/수정 UI에 Agent 선택 추가
   - assigned_agent, reviewer 필드 지원
   - 예상 시간: 4-6시간

3. **Execute와 Agent 통합**
   - Task 기반 Execute 명령 생성
   - Agent의 allowedTools, permissions를 CLI에 전달
   - 예상 시간: 8-12시간

### 🟡 Medium Priority
4. **Agent 템플릿 제공**
   - 샘플 Agent 추가 (test-generator, code-reviewer, doc-writer)
   - Quick start 템플릿
   - 예상 시간: 4-6시간

5. **Agent 복제 기능**
   - 기존 Agent를 복제하여 새 Agent 생성
   - UI에 "Duplicate" 버튼 추가
   - 예상 시간: 2-3시간

6. **검증 강화**
   - Permission 패턴 문법 검증
   - 위험한 권한 조합 경고
   - 예상 시간: 4-6시간

### 🟢 Low Priority
7. **Markdown 에디터 개선**
   - Syntax highlighting
   - Preview 모드
   - 예상 시간: 6-8시간

8. **Agent 실행 이력 추적**
   - Agent 성능 메트릭
   - 실행 로그
   - 예상 시간: 8-12시간

9. **검색 및 필터링**
   - Agent 목록 검색
   - 도구별 필터링
   - 예상 시간: 4-6시간

## 참고 문서
- [Agents 기능 개요](./README.md)
- [Tool Groups 가이드](./tool-groups.md)
- [Agent Presets (Deprecated)](./presets.md)
- [Sub-Agent 기본 개념](/docs/claude-context/sub-agent/sub-agent-basics.md)
- [Sub-Agent 설계 원칙](/docs/claude-context/sub-agent/sub-agent-design.md)

## 구현 진행률

| Phase | 항목 | 상태 | 완료도 |
|-------|------|------|--------|
| Phase 1 | 기본 인프라 | ✅ 완료 | 100% |
| Phase 2 | Tool Groups 시스템 | ✅ 완료 | 100% |
| Phase 3 | UI 컴포넌트 | ⚠️ 부분 완료 | 80% |
| Phase 4 | Execute 통합 | ❌ 미구현 | 0% |
| Phase 5 | 문서 및 예제 | ⚠️ 부분 완료 | 40% |

**전체 진행률: ~64%**

## 결론

Agents 기능의 핵심 인프라와 UI는 대부분 구현되었습니다. Tool Groups 시스템(7개 그룹, 94개 도구)이 완전히 작동하며, CRUD 작업이 정상적으로 동작합니다.

주요 남은 작업:
1. **MCP 서버 활성화 확인** (2-4시간)
2. **TasksPage 통합** (4-6시간)
3. **Execute 통합** (8-12시간) ← 가장 중요

Execute 통합이 완료되면 Agent를 실제로 실행할 수 있어 기능이 완전히 작동하게 됩니다.
