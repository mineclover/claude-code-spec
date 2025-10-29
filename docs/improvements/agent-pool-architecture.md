# Agent Pool Architecture Design

**목표:** LangGraph 패턴을 적용한 역할 기반 Agent 실행 시스템

---

## 🎯 핵심 개념

### 현재 구조 (잘못됨)
```
User Query → ProcessManager → Claude CLI (단순 병렬 실행)
```

**문제점:**
- 모든 세션이 동일하게 처리됨
- Agent 역할 구분 없음
- Task와 Agent 연결 안됨

### 목표 구조 (LangGraph 패턴)
```
Task → TaskRouter → Agent Pool → Claude CLI
                    ├─ Code Reviewer (opus-4)
                    ├─ Test Writer (sonnet-4)
                    ├─ Refactoring (sonnet-4)
                    └─ Documentation (haiku-4)
```

**특징:**
- Task는 특정 Agent에 할당
- Agent는 독립적인 context, tools, permissions
- Agent는 재사용 가능 (idle ↔ busy)

---

## 📋 데이터 구조

### 1. AgentDefinition (`.claude/agents/*.md`)

**이미 존재하는 구조:**
```markdown
---
name: task-creator
description: 프로젝트 분석 후 구조화된 Task를 생성
allowedTools:
  - Read
  - Grep
  - mcp__serena__*
permissions:
  allowList:
    - "read:**"
    - "write:.claude/tasks/**"
  denyList:
    - "read:.env"
---
## Agent Instructions
[Agent 역할 및 수행 방법]
```

### 2. AgentContext (런타임 상태)

```typescript
interface AgentContext {
  // Identity
  name: string;
  description: string;

  // Capabilities
  allowedTools: string[];
  permissions: {
    allowList: string[];
    denyList: string[];
  };

  // Instructions
  instructions: string; // Markdown content

  // Runtime state
  status: 'idle' | 'busy';
  currentTaskId?: string;
  currentSessionId?: string;

  // History
  completedTasks: string[];
  lastActiveTime: number;
}
```

### 3. Task (`.claude/tasks/*.md`)

**이미 존재하는 구조:**
```markdown
---
id: task-001
title: Task title
area: Backend/Authentication
assigned_agent: claude-sonnet-4  ← Agent 할당
reviewer: claude-opus-4
status: pending | in_progress | completed | cancelled
---
## Description
## References
## Success Criteria
```

---

## 🏗️ 아키텍처 컴포넌트

### 1. AgentPoolManager

**책임:**
- Agent 인스턴스 생성 및 관리
- Agent 상태 추적 (idle/busy)
- Agent 할당 및 회수

```typescript
class AgentPoolManager {
  private agents: Map<string, AgentContext> = new Map();
  private agentDefinitions: Map<string, AgentDefinition> = new Map();

  // Agent 정의 로드
  async loadAgentDefinitions(projectPath: string): Promise<void>;

  // Agent 인스턴스 가져오기 (없으면 생성)
  async getAgent(agentName: string): Promise<AgentContext>;

  // Idle agent 찾기
  findIdleAgent(agentName: string): AgentContext | null;

  // Agent 상태 업데이트
  markAgentBusy(agentName: string, taskId: string, sessionId: string): void;
  markAgentIdle(agentName: string): void;

  // 통계
  getAgentStats(): Map<string, { idle: number; busy: number }>;
}
```

### 2. TaskRouter

**책임:**
- Task를 적절한 Agent에 라우팅
- Task의 assigned_agent 필드 활용

```typescript
class TaskRouter {
  constructor(
    private agentPool: AgentPoolManager,
    private processManager: ProcessManager,
  ) {}

  // Task를 Agent에 할당하고 실행
  async routeTask(task: Task): Promise<string> {
    // 1. Task의 assigned_agent 확인
    const agentName = task.assigned_agent;

    // 2. Agent 가져오기 (또는 생성)
    const agent = await this.agentPool.getAgent(agentName);

    // 3. Agent context로 실행
    return await this.executeWithAgent(agent, task);
  }

  // Agent context를 적용하여 실행
  private async executeWithAgent(
    agent: AgentContext,
    task: Task,
  ): Promise<string> {
    // Agent를 busy로 표시
    this.agentPool.markAgentBusy(agent.name, task.id, '');

    try {
      // Agent의 tools, permissions, instructions를 query에 포함
      const enhancedQuery = this.buildQueryWithAgentContext(agent, task);

      // ProcessManager로 실행
      const sessionId = await this.processManager.startExecution({
        projectPath: task.projectPath,
        query: enhancedQuery,
        mcpConfig: task.mcpConfig,
        model: task.model,
      });

      // Agent에 sessionId 저장
      agent.currentSessionId = sessionId;

      return sessionId;
    } finally {
      // 완료 후 idle로 전환
      this.agentPool.markAgentIdle(agent.name);
    }
  }

  // Agent context를 query에 주입
  private buildQueryWithAgentContext(
    agent: AgentContext,
    task: Task,
  ): string {
    return `
You are ${agent.name}: ${agent.description}

## Your Instructions
${agent.instructions}

## Your Allowed Tools
${agent.allowedTools.join(', ')}

## Permissions
Allowed: ${agent.permissions.allowList.join(', ')}
Denied: ${agent.permissions.denyList.join(', ')}

---

## Task: ${task.title}

${task.description}

## References
${task.references}

## Success Criteria
${task.successCriteria}
`;
  }
}
```

### 3. AgentLoader

**책임:**
- `.claude/agents/*.md` 파일 읽기
- YAML frontmatter + Markdown 파싱
- AgentDefinition 객체 생성

```typescript
interface AgentDefinition {
  name: string;
  description: string;
  allowedTools: string[];
  permissions: {
    allowList: string[];
    denyList: string[];
  };
  instructions: string; // Markdown body
  filePath: string;
}

class AgentLoader {
  // 프로젝트의 agents 디렉토리 스캔
  async loadAgents(projectPath: string): Promise<AgentDefinition[]> {
    const agentsDir = path.join(projectPath, '.claude', 'agents');
    const files = await fs.readdir(agentsDir);

    const agents: AgentDefinition[] = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        const content = await fs.readFile(path.join(agentsDir, file), 'utf-8');
        const agent = this.parseAgentFile(content, file);
        agents.push(agent);
      }
    }

    return agents;
  }

  // YAML frontmatter + Markdown 파싱
  private parseAgentFile(content: string, filename: string): AgentDefinition {
    const matter = require('gray-matter');
    const parsed = matter(content);

    return {
      name: parsed.data.name,
      description: parsed.data.description,
      allowedTools: parsed.data.allowedTools || [],
      permissions: {
        allowList: parsed.data.permissions?.allowList || [],
        denyList: parsed.data.permissions?.denyList || [],
      },
      instructions: parsed.content,
      filePath: filename,
    };
  }
}
```

---

## 🔄 실행 흐름

### 시나리오 1: Task 실행

```typescript
// 1. Task 로드
const task = await taskAPI.getTask('task-001');

// 2. TaskRouter로 라우팅
const sessionId = await taskRouter.routeTask(task);

// 3. TaskRouter 내부:
//    a. assigned_agent 확인 ('code-reviewer')
//    b. AgentPoolManager에서 Agent 가져오기
//    c. Agent context를 query에 주입
//    d. ProcessManager로 실행
//    e. Agent를 busy로 표시

// 4. 실행 완료 후:
//    a. Agent를 idle로 전환
//    b. Task 상태 업데이트
```

### 시나리오 2: 직접 실행 (UI에서)

```typescript
// UI에서 직접 실행하는 경우
// → 기본 Agent 사용 또는 Agent 선택

const sessionId = await processManager.startExecution({
  projectPath: '/path',
  query: 'Fix the bug in authentication',
  agentName: 'code-reviewer', // Optional
});
```

---

## 📊 API 변경 사항

### ProcessManager

```typescript
interface StartExecutionParams {
  projectPath: string;
  query: string;
  sessionId?: string;
  mcpConfig?: string;
  model?: 'sonnet' | 'opus' | 'heroku';
  agentName?: string; // NEW: Agent 지정
  agentContext?: AgentContext; // NEW: Agent context 직접 전달
  skillId?: string;
  skillScope?: 'global' | 'project';
  onStream?: (sessionId: string, event: StreamEvent) => void;
  onError?: (sessionId: string, error: string) => void;
  onComplete?: (sessionId: string, code: number) => void;
}
```

### TaskAPI

```typescript
// Task 실행 API 추가
interface TaskAPI {
  executeTask(taskId: string): Promise<string>; // NEW
  // ... 기존 메서드
}
```

---

## 🎨 UI 변경 사항

### TasksPage

**추가 기능:**
- "Execute Task" 버튼
- Task 실행 시 자동으로 Agent 적용
- 실행 상태 표시

### ExecutionsPage

**추가 정보:**
- Agent 이름 표시
- Task ID 표시 (Task 실행인 경우)

---

## 🚀 구현 단계

### Step 1: 기본 구조
1. `AgentDefinition` 타입 정의
2. `AgentContext` 타입 정의
3. `AgentLoader` 구현

### Step 2: Agent Pool
1. `AgentPoolManager` 구현
2. Agent 상태 관리
3. Agent 통계

### Step 3: Task Router
1. `TaskRouter` 구현
2. Agent context 주입 로직
3. Task → Agent 매핑

### Step 4: ProcessManager 통합
1. `agentName` 파라미터 추가
2. Agent context 적용 로직
3. 기존 API 호환성 유지

### Step 5: IPC & UI
1. `task:executeTask` IPC 핸들러
2. TasksPage "Execute" 버튼
3. ExecutionsPage Agent 정보 표시

---

## ✅ 성공 기준

1. ✅ Task 실행 시 Agent가 자동 적용됨
2. ✅ Agent의 tools, permissions, instructions가 적용됨
3. ✅ Agent 상태 추적 (idle/busy)
4. ✅ 기존 직접 실행 방식도 동작
5. ✅ UI에서 Agent 정보 확인 가능

---

## 📝 추후 확장 가능성

### 1. Agent Chaining
```
Task 1 (code-reviewer) → Task 2 (test-writer) → Task 3 (documentation)
```

### 2. Agent Communication
- Agent 간 메시지 전달
- 공유 컨텍스트

### 3. Agent Learning
- 성공/실패 패턴 학습
- Agent별 성능 메트릭

### 4. Dynamic Agent Allocation
- 부하 기반 Agent 할당
- Agent pool auto-scaling
