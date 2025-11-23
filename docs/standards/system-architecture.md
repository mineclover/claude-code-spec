# System Architecture Standards

## 시스템 구조 명칭 표준화

### 1. 핵심 레이어 (Core Layers)

```
┌─────────────────────────────────────────────────┐
│  Presentation Layer (프레젠테이션 계층)           │
│  - UI Components                                │
│  - Pages                                        │
│  - User Interactions                            │
└─────────────────────────────────────────────────┘
                      ↓ IPC
┌─────────────────────────────────────────────────┐
│  Application Layer (애플리케이션 계층)            │
│  - Business Logic                               │
│  - Services                                     │
│  - Orchestration                                │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Domain Layer (도메인 계층)                      │
│  - Domain Models                                │
│  - Domain Services                              │
│  - Validators                                   │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  Infrastructure Layer (인프라 계층)              │
│  - File System                                  │
│  - External APIs                                │
│  - Process Management                           │
└─────────────────────────────────────────────────┘
```

---

## 2. 시스템 컴포넌트 명칭

### 2.1 Core Components (핵심 컴포넌트)

| 컴포넌트 명칭 | 표준 이름 | 역할 | 위치 |
|-------------|----------|------|------|
| **Task Manager** | `TaskLifecycleManager` | Task 생명주기 관리 | `src/services/` |
| **Task Validator** | `TaskValidator` | Task 검증 | `src/lib/` |
| **Task Parser** | `taskParser` | Task 파일 파싱/생성 | `src/lib/` |
| **Agent Pool** | `AgentPoolManager` | Agent 인스턴스 관리 | `src/services/` |
| **Agent Loader** | `AgentLoader` | Agent 정의 로드 | `src/services/` |
| **Task Router** | `TaskRouter` | Task→Agent 라우팅 | `src/services/` |
| **Process Manager** | `ProcessManager` | Claude CLI 실행 관리 | `packages/code-api/` |
| **Stream Parser** | `StreamParser` | 실시간 응답 파싱 | `packages/code-api/` |
| **Session Manager** | `SessionManager` | 세션 이력 관리 | `src/services/` |

### 2.2 Central Management Components (중앙 관리 컴포넌트)

| 컴포넌트 명칭 | 표준 이름 | 역할 | 위치 |
|-------------|----------|------|------|
| **Central Database** | `CentralDatabase` | 통합 데이터 저장소 | `src/services/` |
| **Agent Tracker** | `AgentTracker` | Agent 실행 추적 | `src/services/` |
| **Central Reporter** | `CentralReporter` | 중앙 보고 수집 | `src/services/` |
| **Progress Calculator** | `ProgressCalculator` | 진척도 계산 | `src/lib/` |
| **Report Validator** | `ReportValidator` | 보고 검증 | `src/lib/` |
| **Health Checker** | `HealthChecker` | 시스템 상태 체크 | `src/lib/` |

### 2.3 UI Components (UI 컴포넌트)

| 컴포넌트 명칭 | 표준 이름 | 역할 | 위치 |
|-------------|----------|------|------|
| **Tasks Dashboard** | `TasksPage` | Task 관리 UI | `src/pages/` |
| **Central Dashboard** | `CentralDashboardPage` | 중앙 관리 대시보드 | `src/pages/` |
| **Workflow Dashboard** | `WorkflowPage` | 워크플로우 모니터링 | `src/pages/` |
| **Execution Monitor** | `ExecutionDetailPage` | 실행 상세 모니터링 | `src/pages/` |
| **Agent Manager** | `AgentsPage` | Agent 관리 UI | `src/pages/` |

---

## 3. 데이터 엔티티 명칭

### 3.1 Core Entities (핵심 엔티티)

```typescript
// Task 관련
interface Task { }              // 완전한 Task 객체
interface TaskMetadata { }      // Task 메타데이터만
interface TaskListItem { }      // Task 목록용 요약

// Agent 관련
interface AgentDefinition { }   // Agent 정의 (파일에서 로드)
interface AgentContext { }      // Agent 실행 컨텍스트 (런타임)
interface AgentStats { }        // Agent 통계

// Execution 관련
interface ExecutionInfo { }     // 실행 정보
interface SessionInfo { }       // 세션 정보
interface StreamEvent { }       // 스트림 이벤트
```

### 3.2 Central Management Entities (중앙 관리 엔티티)

```typescript
// 프로젝트 관련
interface ProjectStatus { }     // 프로젝트 상태
interface ProjectReport { }     // 프로젝트 보고서

// 보고 관련
interface Report { }            // 일반 보고
interface AssignmentReport { }  // 작업 배정 보고
interface ProgressReport { }    // 진척 보고
interface CompletionReport { }  // 완료 보고

// 실행 추적
interface AgentExecution { }    // Agent 실행 기록
interface ExecutionMetrics { }  // 실행 메트릭

// 시스템 메트릭
interface SystemMetrics { }     // 전체 시스템 메트릭
```

---

## 4. 상태 (States) 표준

### 4.1 Task Status

```typescript
type TaskStatus =
  | 'pending'      // 대기 중
  | 'in_progress'  // 진행 중
  | 'completed'    // 완료
  | 'cancelled';   // 취소됨
```

**상태 전이 규칙**:
```
pending → in_progress → completed
pending → cancelled
in_progress → cancelled
completed → in_progress (재작업)
cancelled → pending (재활성화)
```

### 4.2 Agent Status

```typescript
type AgentStatus =
  | 'idle'        // 유휴
  | 'busy';       // 작업 중
```

### 4.3 Execution Status

```typescript
type ExecutionStatus =
  | 'pending'     // 대기 중
  | 'running'     // 실행 중
  | 'completed'   // 완료
  | 'failed';     // 실패
```

### 4.4 Project Health Status

```typescript
type HealthStatus =
  | 'healthy'     // 정상
  | 'warning'     // 경고
  | 'error';      // 오류
```

---

## 5. 이벤트 명칭 표준

### 5.1 Task Events

```typescript
// Task 생명주기
'task:created'      // Task 생성
'task:updated'      // Task 업데이트
'task:deleted'      // Task 삭제
'task:assigned'     // Task 배정
'task:started'      // Task 시작
'task:progressed'   // Task 진척
'task:completed'    // Task 완료
'task:cancelled'    // Task 취소
'task:blocked'      // Task 블로킹
```

### 5.2 Agent Events

```typescript
// Agent 생명주기
'agent:loaded'      // Agent 로드
'agent:allocated'   // Agent 할당
'agent:started'     // Agent 시작
'agent:stopped'     // Agent 종료
'agent:errored'     // Agent 에러
```

### 5.3 Execution Events

```typescript
// 실행 이벤트
'execution:started'    // 실행 시작
'execution:streaming'  // 스트림 중
'execution:completed'  // 실행 완료
'execution:failed'     // 실행 실패
'execution:killed'     // 실행 강제 종료
```

### 5.4 Central Management Events

```typescript
// 중앙 관리 이벤트
'central:report'       // 보고 수신
'central:alert'        // 알림
'central:sync'         // 동기화
'central:health-check' // 헬스 체크
```

---

## 6. API 명칭 표준

### 6.1 IPC Channel 명명 규칙

```
{domain}:{action}
```

**예시**:
```typescript
// Task 관련
'task:listTasks'
'task:getTask'
'task:createTask'
'task:updateTask'
'task:deleteTask'
'task:executeTask'
'task:validateTask'

// Agent 관련
'agent:listAgents'
'agent:getAgent'
'agent:createAgent'
'agent:updateAgent'

// Central 관련
'central:getProjects'
'central:getReports'
'central:submitReport'
'central:getMetrics'
```

### 6.2 Preload API 명칭

```
{domain}API
```

**예시**:
```typescript
window.taskAPI
window.agentAPI
window.skillAPI
window.centralAPI
window.claudeAPI
window.fileAPI
```

---

## 7. 파일 및 디렉토리 구조 표준

### 7.1 프로젝트별 구조

```
{projectPath}/
├── workflow/
│   ├── tasks/              # Task 정의 파일들
│   │   ├── task-001.md
│   │   ├── task-002.md
│   │   └── ...
│   └── agents/             # Agent 정의 파일들
│       ├── task-generator.md
│       ├── code-reviewer.md
│       └── ...
├── .claude/
│   ├── settings.json       # 프로젝트 권한 설정
│   ├── work-areas.json     # Work Area 정의
│   ├── .mcp-dev.json       # 개발용 MCP 설정
│   └── .mcp-analysis.json  # 분석용 MCP 설정
└── CLAUDE.md               # 프로젝트 메모리
```

### 7.2 중앙 관리 구조

```
~/.claude/
├── central-management/
│   ├── database.json       # 중앙 DB
│   ├── config.json         # 중앙 설정
│   └── reports/            # 보고 아카이브
│       ├── 2025-11-23/
│       └── 2025-11-24/
├── agents/                 # 글로벌 Agent 정의
└── skills/                 # 글로벌 Skills
```

### 7.3 소스 코드 구조

```
src/
├── services/              # 비즈니스 로직 서비스
│   ├── TaskLifecycleManager.ts
│   ├── AgentPoolManager.ts
│   ├── TaskRouter.ts
│   ├── CentralDatabase.ts
│   └── ...
├── lib/                   # 유틸리티 및 헬퍼
│   ├── TaskValidator.ts
│   ├── taskParser.ts
│   ├── ProgressCalculator.ts
│   └── ...
├── types/                 # TypeScript 타입 정의
│   ├── task.ts
│   ├── agent.ts
│   ├── central.ts
│   └── ...
├── ipc/                   # IPC 통신
│   └── handlers/
│       ├── taskHandlers.ts
│       ├── agentHandlers.ts
│       ├── centralHandlers.ts
│       └── ...
├── preload/               # Preload 스크립트
│   └── apis/
│       ├── task.ts
│       ├── agent.ts
│       ├── central.ts
│       └── ...
├── pages/                 # React 페이지
│   ├── TasksPage.tsx
│   ├── CentralDashboardPage.tsx
│   └── ...
└── components/            # React 컴포넌트
    ├── task/
    ├── agent/
    ├── central/
    └── ...
```

---

## 8. 명명 규칙 (Naming Conventions)

### 8.1 TypeScript/JavaScript

```typescript
// Classes: PascalCase
class TaskLifecycleManager { }
class AgentPoolManager { }

// Interfaces/Types: PascalCase
interface Task { }
type TaskStatus = ...

// Functions: camelCase
function parseTaskMarkdown() { }
function validateTask() { }

// Constants: UPPER_SNAKE_CASE
const MAX_CONCURRENT_TASKS = 10;
const DEFAULT_TIMEOUT = 30000;

// Variables: camelCase
const taskManager = new TaskLifecycleManager();
let currentStatus = 'pending';

// Private members: _camelCase (optional)
private _internalState: State;

// File names:
// - Services: PascalCase.ts (TaskLifecycleManager.ts)
// - Utils: camelCase.ts (taskParser.ts)
// - Components: PascalCase.tsx (TasksPage.tsx)
```

### 8.2 Markdown Files

```
// Task files: task-{number}.md
task-001.md
task-042.md

// Agent files: {agent-name}.md
task-generator.md
code-reviewer.md

// Documentation: kebab-case.md
system-architecture.md
naming-conventions.md
```

### 8.3 CSS Classes

```css
/* BEM Naming Convention */
.block { }
.block__element { }
.block--modifier { }

/* Examples */
.task-item { }
.task-item__title { }
.task-item--selected { }
```

---

## 9. 로깅 표준

### 9.1 로그 레벨

```typescript
type LogLevel =
  | 'debug'    // 상세 디버그 정보
  | 'info'     // 일반 정보
  | 'warn'     // 경고
  | 'error';   // 에러
```

### 9.2 로그 형식

```typescript
interface LogEntry {
  timestamp: string;      // ISO 8601
  level: LogLevel;
  module: string;         // 모듈명 (예: 'TaskLifecycleManager')
  message: string;        // 로그 메시지
  context?: {             // 추가 컨텍스트
    taskId?: string;
    agentName?: string;
    sessionId?: string;
    [key: string]: any;
  };
  error?: Error;          // 에러 객체 (level='error'일 때)
}
```

### 9.3 로그 예시

```typescript
appLogger.info('Task status updated', {
  module: 'TaskLifecycleManager',
  taskId: 'task-001',
  oldStatus: 'pending',
  newStatus: 'in_progress',
});

appLogger.error('Failed to execute task', error, {
  module: 'TaskRouter',
  taskId: 'task-001',
  agentName: 'claude-sonnet-4',
});
```

---

## 10. 에러 처리 표준

### 10.1 에러 클래스 계층

```typescript
AppError                     // 최상위 에러
├── ValidationError          // 검증 에러
├── NotFoundError           // 리소스 없음
├── ExecutionError          // 실행 에러
│   ├── TaskExecutionError
│   └── AgentExecutionError
├── StateError              // 상태 전이 에러
└── CentralError            // 중앙 관리 에러
    ├── ReportError
    └── SyncError
```

### 10.2 에러 명명 규칙

```typescript
// Pattern: {Domain}{Reason}Error
class TaskNotFoundError extends NotFoundError { }
class TaskValidationError extends ValidationError { }
class AgentBusyError extends StateError { }
class InvalidStateTransitionError extends StateError { }
```

---

## 11. 문서화 표준

### 11.1 코드 주석

```typescript
/**
 * Task의 생명주기를 관리하는 서비스
 *
 * 담당 기능:
 * - Task 상태 전이 관리
 * - 의존성 확인
 * - 실행 가능 여부 판단
 *
 * @example
 * const manager = new TaskLifecycleManager(projectPath);
 * await manager.startTask('task-001', 'agent-name');
 */
export class TaskLifecycleManager {
  /**
   * Task 상태를 업데이트합니다
   *
   * @param taskId - Task ID
   * @param newStatus - 새로운 상태
   * @param updatedBy - 업데이트 주체 (optional)
   * @returns 성공 여부 및 에러 메시지
   */
  async updateTaskStatus(
    taskId: string,
    newStatus: TaskStatus,
    updatedBy?: string
  ): Promise<{ success: boolean; error?: string }> {
    // ...
  }
}
```

### 11.2 문서 구조

```
docs/
├── standards/              # 표준 문서
│   ├── system-architecture.md
│   ├── naming-conventions.md
│   ├── data-models.md
│   └── state-machines.md
├── guides/                 # 가이드
│   ├── getting-started.md
│   ├── task-management.md
│   └── central-management.md
└── api/                    # API 문서
    ├── task-api.md
    ├── agent-api.md
    └── central-api.md
```

---

이 표준 문서를 기반으로 모든 코드가 작성되어야 합니다.
