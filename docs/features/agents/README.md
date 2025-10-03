# Agents 기능

## 개요

Agents는 Tasks의 작업을 실제로 수행하는 전문화된 AI 어시스턴트입니다. 각 Agent는 특정 역할에 최적화된 도구 접근 권한과 파일 권한을 가지며, 마크다운 형식으로 정의됩니다.

## 목적

- **작업 분담**: Tasks에서 정의된 작업을 전문화된 Agent에게 할당
- **권한 제어**: Agent별로 허용된 도구와 파일 접근 범위 제한
- **재사용성**: 자주 사용하는 작업 패턴을 Agent로 정의하여 반복 사용
- **역할 명확화**: 각 Agent는 명확한 책임과 제약을 가짐

## Agent 저장 위치

- **프로젝트 레벨**: `.claude/agents/` (프로젝트별 전문 Agent)
- **사용자 레벨**: `~/.claude/agents/` (모든 프로젝트에서 공유)

## Agent 파일 구조

```markdown
---
name: test-generator
description: TypeScript 코드에 대한 단위 테스트 생성 전문 Agent
allowedTools: [Read, Write, Grep, Bash]
permissions:
  allowList:
    - "read:src/**"
    - "write:tests/**"
    - "bash:npm run test"
  denyList:
    - "write:src/**"
    - "read:.env"
---

# Role

당신은 TypeScript 단위 테스트 생성 전문가입니다.

# Process

1. 소스 코드 분석 (src/ 디렉토리)
2. 테스트 케이스 설계
3. Jest 테스트 코드 작성 (tests/ 디렉토리)
4. 테스트 실행 및 검증

# Constraints

- src/ 디렉토리의 코드는 읽기만 가능
- tests/ 디렉토리에만 파일 작성 허용
- 환경 변수 파일 접근 금지

# Output Format

생성된 테스트 파일 경로와 커버리지 정보를 요약하여 보고합니다.
```

## 핵심 필드

### 필수 필드

- **name**: Agent의 고유 식별자 (영문, 하이픈, 언더스코어만 사용)
- **description**: Agent의 목적과 역할 요약

### 선택 필드

- **allowedTools**: 사용 가능한 도구 목록 (예: `Read`, `Write`, `Bash`, `Grep`)
- **permissions**: 파일 및 명령 접근 권한
  - **allowList**: 허용된 작업 패턴 목록
  - **denyList**: 명시적으로 차단된 작업 패턴 목록

## Tool Groups (도구 선택)

Agent 생성 시 `allowedTools`를 투명하게 선택할 수 있도록 도구를 그룹화하여 제공합니다.

### Tool Groups 종류

1. **All tools**: 모든 도구 허용
2. **Read-only tools**: 읽기 전용 (Read, Grep, Glob, WebFetch, WebSearch)
3. **Edit tools**: 편집 도구 (Write, Edit)
4. **Execution tools**: 실행 도구 (Bash)
5. **MCP tools**: MCP 서버 도구 (serena, magic, playwright 등) ⚠️ **MCP config 필요**
6. **Task Management tools**: 작업 관리 (Task, TodoWrite)
7. **Other tools**: 기타 도구 (NotebookEdit, SlashCommand 등)

**중요**: MCP tools를 사용하려면 프로젝트의 `.claude/.mcp-*.json` 파일에서 해당 MCP 서버가 활성화되어 있어야 합니다.

### 장점

- **투명성**: 정확히 어떤 도구가 허용되는지 명확함
- **유연성**: 그룹 단위 빠른 선택 + 개별 도구 세밀 조정
- **안전성**: 불필요한 도구를 실수로 허용하는 것 방지

### 사용 예시

```
☑ Read-only tools  → Read, Grep, Glob, WebFetch, WebSearch
☑ Edit tools       → Write, Edit
☐ Execution tools
  ↓
결과: Read, Grep, Glob, WebFetch, WebSearch, Write, Edit
```

**상세 문서**: [Tool Groups 가이드](./tool-groups.md)

## Agents와 Tasks 통합

### Task에서 Agent 할당

```markdown
---
id: task-001
title: 사용자 인증 테스트 작성
area: src/auth
assigned_agent: test-generator  # Agent 할당
reviewer: code-reviewer         # 리뷰 Agent 할당
status: pending
---

## References
- /src/auth/login.ts
- /src/auth/jwt.ts

## Success Criteria
- [ ] 단위 테스트 커버리지 85% 이상
- [ ] 모든 테스트 통과
```

### Execute 실행 플로우

```
1. Task 선택
   ↓
2. assigned_agent 확인 (test-generator)
   ↓
3. Agent 정보 로드
   - allowedTools: [Read, Write, Grep, Bash]
   - permissions: allowList, denyList
   ↓
4. Execute 명령 구성
   claude --agent test-generator \
     --mcp-config .claude/.mcp-dev.json \
     -p "Execute Task: task-001"
   ↓
5. Agent가 Task의 References와 Success Criteria를 참고하여 작업 수행
   ↓
6. 결과를 reviewer Agent에게 전달하여 검토
```

## 아키텍처 설계

### 1. 타입 정의 (`src/types/agent.ts`)

```typescript
export interface AgentMetadata {
  name: string;
  description: string;
  allowedTools?: string[];
  permissions?: {
    allowList?: string[];
    denyList?: string[];
  };
}

export interface Agent extends AgentMetadata {
  content: string; // Markdown body (Role, Process, Constraints, Output Format)
  filePath: string; // 파일 전체 경로
  source: 'project' | 'user'; // 프로젝트 레벨 또는 사용자 레벨
}

export interface AgentListItem {
  name: string;
  description: string;
  source: 'project' | 'user';
  filePath: string;
}
```

### 2. Agent 파서 (`src/lib/agentParser.ts`)

```typescript
/**
 * Agent 마크다운 파일을 파싱하여 Agent 객체로 변환
 */
export function parseAgentMarkdown(content: string, filePath: string, source: 'project' | 'user'): Agent;

/**
 * Agent 객체를 마크다운 형식으로 변환
 */
export function generateAgentMarkdown(agent: Agent): string;

/**
 * Agent 메타데이터 검증
 */
export function validateAgent(agent: Agent): { valid: boolean; errors: string[] };
```

### 3. IPC 핸들러 (`src/ipc/handlers/agentHandlers.ts`)

```typescript
// 프로젝트와 사용자 레벨 Agent 목록 조회
ipcMain.handle('agent:list', async (event, projectPath: string) => {
  const projectAgents = await listProjectAgents(projectPath);
  const userAgents = await listUserAgents();
  return [...projectAgents, ...userAgents];
});

// Agent 상세 정보 조회
ipcMain.handle('agent:get', async (event, source: 'project' | 'user', agentName: string, projectPath?: string) => {
  // Agent 파일 읽기 및 파싱
});

// Agent 생성
ipcMain.handle('agent:create', async (event, source: 'project' | 'user', agentName: string, content: string, projectPath?: string) => {
  // Agent 파일 생성
});

// Agent 수정
ipcMain.handle('agent:update', async (event, source: 'project' | 'user', agentName: string, content: string, projectPath?: string) => {
  // Agent 파일 수정
});

// Agent 삭제
ipcMain.handle('agent:delete', async (event, source: 'project' | 'user', agentName: string, projectPath?: string) => {
  // Agent 파일 삭제
});
```

### 4. Preload API (`src/preload/apis/agent.ts`)

```typescript
export interface AgentAPI {
  listAgents: (projectPath: string) => Promise<AgentListItem[]>;
  getAgent: (source: 'project' | 'user', agentName: string, projectPath?: string) => Promise<string | null>;
  createAgent: (source: 'project' | 'user', agentName: string, content: string, projectPath?: string) => Promise<{success: boolean; error?: string}>;
  updateAgent: (source: 'project' | 'user', agentName: string, content: string, projectPath?: string) => Promise<{success: boolean; error?: string}>;
  deleteAgent: (source: 'project' | 'user', agentName: string, projectPath?: string) => Promise<{success: boolean; error?: string}>;
}
```

### 5. UI 컴포넌트

#### AgentsPage (`src/pages/AgentsPage.tsx`)

Agent 목록 및 관리 전용 페이지

**기능**:
- 프로젝트 레벨과 사용자 레벨 Agent 구분 표시
- Agent 목록 (name, description, source)
- Agent 선택 시 상세 정보 표시 (allowedTools, permissions)
- Agent 생성/수정/삭제
- 마크다운 에디터

**레이아웃**:
```
┌─────────────────────────────────────────┐
│  Agents                                 │
├──────────────┬──────────────────────────┤
│              │                          │
│  Agent List  │   Agent Editor           │
│              │                          │
│ [P] test-gen │   ---                    │
│ [P] deployer │   name: test-generator   │
│ [U] reviewer │   description: ...       │
│              │   allowedTools: [...]    │
│              │   ---                    │
│              │                          │
│              │   # Role                 │
│              │   ...                    │
│              │                          │
│  [+ New]     │   [Save] [Delete]        │
└──────────────┴──────────────────────────┘

[P] = Project-level
[U] = User-level
```

#### AgentSelector (`src/components/task/AgentSelector.tsx`)

Tasks에서 사용할 Agent 선택 컴포넌트

**Props**:
```typescript
interface AgentSelectorProps {
  projectPath: string;
  selectedAgent: string | null;
  onAgentSelect: (agentName: string | null) => void;
}
```

**UI**:
```
┌─────────────────────────────────────────┐
│ Assigned Agent                          │
│ ┌─────────────────────────────────────┐ │
│ │ test-generator              [Clear] │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Available Agents:                       │
│ ┌─────────────────────────────────────┐ │
│ │ ○ test-generator    (Project)       │ │
│ │   TypeScript 테스트 생성 전문       │ │
│ │                                     │ │
│ │ ○ code-reviewer     (User)          │ │
│ │   코드 리뷰 및 개선 제안            │ │
│ │                                     │ │
│ │ ○ doc-writer        (Project)       │ │
│ │   기술 문서 작성 전문               │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

#### TasksPage 통합

`TasksPage.tsx`에 AgentSelector 통합:

```tsx
<AgentSelector
  projectPath={currentProject}
  selectedAgent={currentTask.assigned_agent}
  onAgentSelect={(agent) => updateTaskField('assigned_agent', agent)}
/>

<AgentSelector
  projectPath={currentProject}
  selectedAgent={currentTask.reviewer}
  onAgentSelect={(agent) => updateTaskField('reviewer', agent)}
/>
```

## Execute 통합

### Task 기반 Execute 명령 생성

```typescript
function buildExecuteCommand(task: Task, projectPath: string): string {
  const args = [
    'claude',
    '--agent', task.assigned_agent,
    '--mcp-config', '.claude/.mcp-dev.json',
    '--strict-mcp-config',
    '-p', `"Execute Task: ${task.id}"`,
  ];

  return args.join(' ');
}
```

### Agent에게 전달될 컨텍스트

Agent가 Execute 될 때 자동으로 제공되는 정보:

1. **Task 정의** (`.claude/tasks/${task.id}.md` 내용)
2. **References** (Task에 명시된 파일들)
3. **Area** (작업 범위 제한)
4. **Success Criteria** (검증 기준)

Agent는 이 정보를 바탕으로 작업을 수행하고, 결과를 생성합니다.

## 구현 단계

### Phase 1: 기본 인프라
- [ ] Agent 타입 정의 (`src/types/agent.ts`)
- [ ] Agent 파서 구현 (`src/lib/agentParser.ts`)
- [ ] Agent IPC 핸들러 구현 (`src/ipc/handlers/agentHandlers.ts`)
- [ ] Agent API 노출 (`src/preload/apis/agent.ts`)

### Phase 2: Tool Groups 시스템
- [ ] Tool Groups 타입 정의 (`src/types/toolGroups.ts`)
- [ ] Tool Groups 상수 및 유틸리티 함수
- [ ] ToolSelector 컴포넌트 (그룹 + 개별 도구 선택)

### Phase 3: UI 컴포넌트
- [ ] AgentsPage 구현 (Agent 관리 페이지, ToolSelector 포함)
- [ ] PermissionEditor 컴포넌트 (allowList/denyList 관리)
- [ ] AgentSelector 컴포넌트 (Tasks에서 사용)
- [ ] TasksPage에 AgentSelector 통합

### Phase 4: Execute 통합
- [ ] Task 기반 Execute 명령 생성 로직
- [ ] Agent와 Task 정보를 Execute에 전달
- [ ] Execute 결과를 Reviewer Agent에게 전달하는 워크플로우

### Phase 5: 문서 및 예제
- [ ] 샘플 Agent 파일 생성 (`.claude/agents/` 예제)
- [ ] Agent 작성 가이드 문서
- [ ] Task + Agent 워크플로우 예제

## 파일 구조

```
src/
├── types/
│   └── agent.ts              # Agent 타입 정의
├── lib/
│   └── agentParser.ts        # Agent 마크다운 파서
├── ipc/
│   └── handlers/
│       └── agentHandlers.ts  # Agent IPC 핸들러
├── preload/
│   └── apis/
│       └── agent.ts          # Agent API
├── pages/
│   ├── AgentsPage.tsx        # Agent 관리 페이지
│   └── TasksPage.tsx         # (AgentSelector 통합)
└── components/
    └── task/
        └── AgentSelector.tsx # Agent 선택 컴포넌트

.claude/
├── agents/                   # 프로젝트 Agent 저장소
│   ├── test-generator.md
│   ├── code-reviewer.md
│   └── doc-writer.md
└── tasks/                    # Task 정의
    └── task-001.md

~/.claude/
└── agents/                   # 사용자 Agent 저장소
    ├── global-reviewer.md
    └── deployer.md
```

## 예제 Agent

### test-generator.md

```markdown
---
name: test-generator
description: TypeScript 단위 테스트 생성 전문 Agent
allowedTools: [Read, Write, Grep, Bash]
permissions:
  allowList:
    - "read:src/**"
    - "write:tests/**"
    - "bash:npm run test"
  denyList:
    - "write:src/**"
---

# Role

당신은 TypeScript 단위 테스트 생성 전문가입니다.

# Process

1. src/ 디렉토리의 소스 코드 분석
2. 각 함수/클래스에 대한 테스트 케이스 설계
3. Jest를 사용한 단위 테스트 코드 작성
4. 테스트 실행 및 결과 검증

# Constraints

- src/ 디렉토리는 읽기만 허용
- tests/ 디렉토리에만 파일 작성
- 테스트 커버리지는 최소 80% 이상

# Output Format

- 생성된 테스트 파일 경로
- 커버리지 정보
- 실행 결과 요약
```

### code-reviewer.md

```markdown
---
name: code-reviewer
description: 코드 리뷰 및 개선 제안 전문 Agent
allowedTools: [Read, Grep]
permissions:
  allowList:
    - "read:src/**"
    - "read:tests/**"
---

# Role

당신은 코드 품질 검토 전문가입니다.

# Process

1. 변경된 코드 분석
2. 코드 스타일 및 베스트 프랙티스 검토
3. 잠재적 버그 및 성능 이슈 식별
4. 개선 제안 작성

# Constraints

- 읽기 전용 (파일 수정 불가)
- 구체적이고 실행 가능한 피드백 제공

# Output Format

- 발견된 이슈 목록 (우선순위별)
- 각 이슈에 대한 개선 제안
- 종합 평가 및 권장사항
```

## 향후 확장

1. **Agent 템플릿**: 자주 사용하는 Agent 패턴을 템플릿으로 제공
2. **Agent 실행 이력**: Agent가 수행한 작업 기록 및 분석
3. **Agent 성능 메트릭**: 각 Agent의 성공률, 평균 실행 시간 등 추적
4. **Agent 체이닝**: 여러 Agent를 순차 또는 병렬로 실행하는 워크플로우
5. **Agent 마켓플레이스**: 커뮤니티에서 공유된 Agent 다운로드

## 참고 문서

- [Sub-Agent 기본 개념](/docs/claude-context/sub-agent/sub-agent-basics.md)
- [Sub-Agent 설계 원칙](/docs/claude-context/sub-agent/sub-agent-design.md)
- [Sub-Agent 레퍼런스](/docs/claude-context/sub-agent/reference.md)
- [Tasks 기능 문서](/docs/features/tasks/README.md)
