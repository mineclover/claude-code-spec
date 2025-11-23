# Naming Conventions (명명 규칙)

## 명명 규칙 표준화

모든 코드, 파일, 데이터 구조의 명명 규칙을 통일하여 일관성과 가독성을 보장합니다.

---

## 1. TypeScript/JavaScript Naming (코드 명명)

### 1.1 Classes & Interfaces

**규칙**: PascalCase (대문자로 시작, 단어마다 대문자)

**Classes**:
```typescript
class TaskLifecycleManager { }
class AgentPoolManager { }
class ProcessManager { }
class StreamParser { }
```

**Interfaces**:
```typescript
interface Task { }
interface Agent { }
interface ExecutionInfo { }
interface TaskStatistics { }
interface ReportValidationRule { }
```

**Abstract Classes**:
```typescript
abstract class BaseReport { }
abstract class BaseValidator { }
```

---

### 1.2 Functions & Methods

**규칙**: camelCase (소문자로 시작, 단어마다 대문자)

**Functions**:
```typescript
function parseTaskFile(filePath: string): Task { }
function validateMetadata(task: Task): boolean { }
function calculateProgress(taskId: string): number { }
```

**Methods**:
```typescript
class TaskLifecycleManager {
  async updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<void> { }
  async canExecuteTask(taskId: string): Promise<boolean> { }
  getNextTask(): Task | null { }
}
```

**Private Methods**: Prefix with underscore (optional but recommended)
```typescript
class TaskValidator {
  private _validateReferences(refs: string[]): boolean { }
  private _checkDependencies(taskId: string): boolean { }
}
```

---

### 1.3 Variables & Parameters

**규칙**: camelCase

**Local Variables**:
```typescript
const taskId = 'task-001';
const executionResult = await execute();
let retryCount = 0;
```

**Function Parameters**:
```typescript
function createTask(taskId: string, projectPath: string, metadata: TaskMetadata) { }
async function executeTask(task: Task, agentName: string) { }
```

**Boolean Variables**: Prefix with `is`, `has`, `can`, `should`
```typescript
const isValid = validateTask(task);
const hasErrors = errors.length > 0;
const canExecute = await checkDependencies();
const shouldRetry = retryCount < 3;
```

---

### 1.4 Constants

**규칙**: UPPER_SNAKE_CASE (모두 대문자, 단어 사이 언더스코어)

```typescript
const MAX_CONCURRENT_EXECUTIONS = 5;
const DEFAULT_TIMEOUT_MS = 120000;
const TASK_ID_PATTERN = /^task-\d{3,}$/;
const CENTRAL_DB_PATH = '~/.claude/central-management/';
```

**Enum-like Objects**:
```typescript
const TaskStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
```

---

### 1.5 Enums

**규칙**: PascalCase for enum name, PascalCase for values

```typescript
enum TaskStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

enum AgentStatus {
  Idle = 'idle',
  Busy = 'busy',
}
```

**Usage**:
```typescript
const status = TaskStatus.Pending;
if (agent.status === AgentStatus.Busy) { }
```

---

### 1.6 Type Aliases

**규칙**: PascalCase

```typescript
type ReportType = 'assignment' | 'progress' | 'completion' | 'periodic';
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
type AgentStatus = 'idle' | 'busy';
type HealthStatus = 'healthy' | 'warning' | 'error' | 'unknown';
```

---

### 1.7 Generic Type Parameters

**규칙**: Single uppercase letter or PascalCase

```typescript
// Single letter (for simple generics)
function identity<T>(value: T): T { }
class Container<T> { }

// PascalCase (for complex or multiple generics)
function transform<TInput, TOutput>(input: TInput): TOutput { }
interface Repository<TEntity, TId> { }
```

---

## 2. File & Directory Naming (파일 및 디렉토리 명명)

### 2.1 TypeScript/JavaScript Files

**Services/Managers**: PascalCase.ts
```
TaskLifecycleManager.ts
AgentPoolManager.ts
ProcessManager.ts
SessionManager.ts
```

**Utilities/Helpers**: camelCase.ts
```
taskParser.ts
streamParser.ts
fileUtils.ts
validators.ts
```

**React Components**: PascalCase.tsx
```
TasksPage.tsx
WorkflowPage.tsx
ExecutionDetailPage.tsx
TaskCard.tsx
```

**React Hooks**: camelCase.ts (prefix with `use`)
```
useProjectContext.ts
useExecutions.ts
useTasks.ts
```

**Types/Interfaces**: PascalCase.ts or camelCase.ts
```
task.ts        // exports Task, TaskMetadata
agent.ts       // exports Agent, AgentMetadata
types.ts       // exports multiple types
```

**Test Files**: Same as source + `.test.ts`
```
TaskLifecycleManager.test.ts
taskParser.test.ts
TasksPage.test.tsx
```

---

### 2.2 Markdown Files

**Documents**: kebab-case.md
```
system-architecture.md
role-definitions.md
data-models.md
naming-conventions.md
```

**Tasks**: task-###.md (zero-padded 3+ digits)
```
task-001.md
task-012.md
task-123.md
```

**Agents**: kebab-case.md
```
task-generator.md
central-reporter.md
workflow-orchestrator.md
```

**Skills**: SKILL.md (uppercase, in skill directory)
```
.claude/skills/skill-creator/SKILL.md
.claude/skills/task-analyzer/SKILL.md
```

**Special Files**: UPPERCASE.md
```
CLAUDE.md
README.md
CHANGELOG.md
LICENSE.md
```

---

### 2.3 JSON Configuration Files

**Project Config**: kebab-case.json or dotfile
```
work-areas.json
bookmarks.json
.mcp-dev.json
.mcp-analysis.json
settings.json
```

**Package Files**: Standard names
```
package.json
tsconfig.json
vite.config.ts
```

---

### 2.4 CSS/Style Files

**CSS Modules**: PascalCase.module.css (matching component name)
```
TasksPage.module.css
WorkflowPage.module.css
TaskCard.module.css
```

**Global Styles**: kebab-case.css
```
global-styles.css
theme-variables.css
```

---

### 2.5 Directories

**Source Directories**: camelCase or kebab-case
```
src/
  components/
  pages/
  services/
  types/
  lib/
  ipc/
    handlers/
    routers/
  preload/
    apis/
```

**Documentation**: kebab-case
```
docs/
  standards/
  architecture/
  guides/
  claude-context/
    usage/
    config/
```

**Workflow**: kebab-case
```
workflow/
  tasks/
  agents/
```

---

## 3. API & IPC Naming (API 및 IPC 명명)

### 3.1 IPC Channels

**규칙**: `{domain}:{action}` (kebab-case)

**Task Domain**:
```typescript
'task:listTasks'
'task:getTask'
'task:createTask'
'task:updateTask'
'task:deleteTask'
'task:validateTask'
'task:updateTaskStatus'
'task:canExecuteTask'
'task:getNextTask'
'task:getTaskStats'
```

**Agent Domain**:
```typescript
'agent:listAgents'
'agent:getAgent'
'agent:createAgent'
'agent:updateAgent'
'agent:deleteAgent'
```

**Claude Execution Domain**:
```typescript
'claude:execute'
'claude:started'
'claude:stream'
'claude:error'
'claude:complete'
'claude:killExecution'
'claude:cleanupExecution'
```

**Central Management Domain**:
```typescript
'central:submitReport'
'central:getProjects'
'central:getProjectStats'
'central:trackAgent'
'central:listActiveAgents'
```

---

### 3.2 Preload APIs

**규칙**: `{domain}API` (camelCase + API suffix)

```typescript
window.taskAPI
window.agentAPI
window.claudeAPI
window.skillAPI
window.claudeSessionsAPI
window.workAreaAPI
window.settingsAPI
window.bookmarksAPI
window.docsAPI
window.fileAPI
window.centralAPI  // Future
```

**API Methods**: camelCase
```typescript
window.taskAPI.listTasks()
window.taskAPI.getTask()
window.taskAPI.createTask()
window.taskAPI.updateTaskStatus()

window.claudeAPI.execute()
window.claudeAPI.onStream()
window.claudeAPI.killExecution()
```

---

### 3.3 REST API Endpoints (if applicable)

**규칙**: kebab-case, plural nouns, HTTP verbs

```
GET    /api/tasks
GET    /api/tasks/:id
POST   /api/tasks
PUT    /api/tasks/:id
DELETE /api/tasks/:id

GET    /api/agents
GET    /api/agents/:name
POST   /api/agents
PUT    /api/agents/:name

GET    /api/executions
GET    /api/executions/:sessionId
POST   /api/executions
DELETE /api/executions/:sessionId

GET    /api/central/projects
GET    /api/central/reports
POST   /api/central/reports
```

---

## 4. Database & Storage Naming (데이터베이스 및 저장소 명명)

### 4.1 File Paths

**Project-level Workflow**:
```
{projectPath}/workflow/tasks/task-001.md
{projectPath}/workflow/agents/task-generator.md
{projectPath}/.claude/settings.json
{projectPath}/.claude/work-areas.json
{projectPath}/.claude/skills/{skill-name}/SKILL.md
```

**Central Management**:
```
~/.claude/central-management/projects.json
~/.claude/central-management/reports/{date}/report-{timestamp}.json
~/.claude/central-management/executions/{sessionId}.json
```

**Claude Sessions**:
```
~/.config/claude/logs/sessions/{projectName}/{sessionId}/
```

---

### 4.2 JSON Keys

**규칙**: camelCase

```json
{
  "taskId": "task-001",
  "agentName": "claude-sonnet-4",
  "projectPath": "/Users/user/project",
  "createdAt": "2025-11-23T22:30:00Z",
  "successCriteria": ["criterion 1"],
  "mcpServers": {
    "serena": { "command": "npx" }
  }
}
```

---

## 5. Event & Callback Naming (이벤트 및 콜백 명명)

### 5.1 Event Handlers

**규칙**: `on{Event}` or `handle{Event}` (PascalCase event name)

**React Components**:
```typescript
const handleClick = () => { };
const handleSubmit = (e: FormEvent) => { };
const handleTaskSelect = (taskId: string) => { };
```

**Event Emitters**:
```typescript
processManager.on('started', handleStarted);
processManager.on('stream', handleStream);
processManager.on('complete', handleComplete);
processManager.on('error', handleError);
```

---

### 5.2 Custom Events

**规则**: kebab-case

```typescript
window.dispatchEvent(new CustomEvent('task-updated', { detail: task }));
window.dispatchEvent(new CustomEvent('agent-status-changed', { detail: agent }));
window.dispatchEvent(new CustomEvent('execution-complete', { detail: result }));
```

---

## 6. Field & Property Naming (필드 및 속성 명명)

### 6.1 Object Properties

**Required Fields**: camelCase
```typescript
{
  taskId: string;
  agentName: string;
  projectPath: string;
  status: TaskStatus;
}
```

**Optional Fields**: camelCase with `?`
```typescript
{
  taskId: string;
  description?: string;
  reviewNotes?: string;
  error?: string;
}
```

**Boolean Fields**: Prefix with `is`, `has`, `can`, `should`
```typescript
{
  isValid: boolean;
  hasErrors: boolean;
  canExecute: boolean;
  shouldRetry: boolean;
}
```

**Timestamp Fields**: Suffix with `At`
```typescript
{
  createdAt: string;
  updatedAt: string;
  startedAt: string;
  completedAt: string;
  lastSeenAt: string;
}
```

**Array Fields**: Plural nouns
```typescript
{
  tasks: Task[];
  agents: Agent[];
  errors: ValidationError[];
  warnings: string[];
  references: string[];
}
```

**Count Fields**: Prefix with `total`, `num`, or use plural with `Count` suffix
```typescript
{
  totalTasks: number;
  numAgents: number;
  errorCount: number;
  completedTasksCount: number;
}
```

---

### 6.2 Metadata Fields

**YAML Frontmatter**: snake_case (to match markdown conventions)
```yaml
---
id: task-001
assigned_agent: claude-sonnet-4
created: 2025-11-23T22:30:00Z
updated: 2025-11-23T22:30:00Z
---
```

**When Parsed to TypeScript**: Convert to camelCase
```typescript
// YAML: assigned_agent → TypeScript: assignedAgent
interface TaskMetadata {
  id: string;
  assignedAgent: string;  // Not assigned_agent
  created: string;
  updated: string;
}
```

---

## 7. ID & Identifier Naming (ID 및 식별자 명명)

### 7.1 Task IDs

**Format**: `task-###` (lowercase, hyphen, zero-padded 3+ digits)

```
task-001
task-012
task-123
task-1234
```

**Pattern**: `/^task-\d{3,}$/`

---

### 7.2 Agent Names

**Format**: kebab-case

```
task-generator
central-reporter
workflow-orchestrator
claude-sonnet-4
custom-agent-name
```

**Pattern**: `/^[a-z0-9]+(-[a-z0-9]+)*$/`

---

### 7.3 Session IDs

**Format**: UUID v4 or custom format

```
550e8400-e29b-41d4-a716-446655440000  // UUID v4
session-20251123-223000-abc123        // Custom with timestamp
```

---

### 7.4 Execution IDs

**Format**: Same as Session IDs (UUID v4 or custom)

```
execution-20251123-223000-def456
```

---

### 7.5 Report IDs

**Format**: UUID v4

```
report-20251123-223000-ghi789
```

---

## 8. Comment & Documentation Naming (주석 및 문서 명명)

### 8.1 JSDoc Comments

```typescript
/**
 * Updates the task status and validates state transition.
 *
 * @param taskId - The task identifier (e.g., 'task-001')
 * @param newStatus - The new status to transition to
 * @param updatedBy - Optional agent name performing the update
 * @returns Promise resolving to success/error result
 * @throws {Error} If task not found or invalid transition
 */
async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  updatedBy?: string
): Promise<{ success: boolean; error?: string }> {
  // Implementation
}
```

---

### 8.2 Inline Comments

**TODO Comments**: Include assignee or date
```typescript
// TODO(junwoo): Implement retry logic
// TODO: Add validation for agent name format
// FIXME: Memory leak in stream parser
// NOTE: This is a temporary workaround
```

**Section Comments**: Use descriptive headers
```typescript
// ============================================================
// Task Status Validation
// ============================================================

// --- Dependency Checking ---
const dependencies = task.dependencies || [];

// >>> Temporary Debug Code <<<
console.log('Debug:', task);
```

---

## 9. Error & Exception Naming (에러 및 예외 명명)

### 9.1 Error Classes

**규칙**: PascalCase, suffix with `Error`

```typescript
class TaskNotFoundError extends Error { }
class AgentBusyError extends Error { }
class InvalidStatusTransitionError extends Error { }
class ValidationError extends Error { }
class ExecutionTimeoutError extends Error { }
```

---

### 9.2 Error Codes

**규칙**: UPPER_SNAKE_CASE

```typescript
const ErrorCode = {
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  AGENT_BUSY: 'AGENT_BUSY',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  EXECUTION_TIMEOUT: 'EXECUTION_TIMEOUT',
  DEPENDENCY_UNRESOLVED: 'DEPENDENCY_UNRESOLVED',
} as const;
```

---

## 10. Test Naming (테스트 명명)

### 10.1 Test Files

**규칙**: Same as source file + `.test.ts`

```
TaskLifecycleManager.test.ts
taskParser.test.ts
TasksPage.test.tsx
```

---

### 10.2 Test Suites & Cases

**Suites**: `describe('ComponentName', ...)`
**Cases**: `it('should do something', ...)` or `test('does something', ...)`

```typescript
describe('TaskLifecycleManager', () => {
  describe('updateTaskStatus', () => {
    it('should update status when transition is valid', async () => {
      // Test implementation
    });

    it('should reject invalid status transitions', async () => {
      // Test implementation
    });

    it('should update timestamp on status change', async () => {
      // Test implementation
    });
  });

  describe('canExecuteTask', () => {
    test('returns true when all dependencies are completed', async () => {
      // Test implementation
    });

    test('returns false when dependencies are pending', async () => {
      // Test implementation
    });
  });
});
```

---

## 11. Git Commit Message Naming (커밋 메시지 명명)

### 11.1 Commit Message Format

**규칙**: `<type>(<scope>): <subject>`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, missing semicolons)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples**:
```
feat(tasks): implement task lifecycle manager
fix(parser): handle incomplete JSON in stream parser
docs(standards): add naming conventions document
refactor(agent): simplify agent pool management
test(lifecycle): add tests for status transitions
chore(deps): update dependencies
```

---

## 12. Branch Naming (브랜치 명명)

**규칙**: `<type>/<description>` (kebab-case)

```
feature/task-lifecycle-manager
feature/central-management-system
bugfix/stream-parser-incomplete-json
hotfix/agent-pool-memory-leak
docs/role-definitions
refactor/simplify-ipc-handlers
```

---

## 13. Environment Variables (환경 변수)

**규칙**: UPPER_SNAKE_CASE

```
CLAUDE_API_KEY
PROJECT_ROOT_PATH
MAX_CONCURRENT_EXECUTIONS
DEFAULT_TIMEOUT_MS
CENTRAL_DB_PATH
NODE_ENV
```

---

## 14. CSS Class Naming (CSS 클래스 명명)

### 14.1 CSS Modules

**규칙**: camelCase (CSS Modules converts to camelCase in JS)

```css
/* TasksPage.module.css */
.container { }
.taskList { }
.taskCard { }
.activeTask { }
.taskStats { }
.generateButton { }
```

**Usage**:
```typescript
import styles from './TasksPage.module.css';

<div className={styles.container}>
  <div className={styles.taskList}>
    <div className={styles.taskCard}>
```

---

### 14.2 BEM Naming (if not using CSS Modules)

**규칙**: `block__element--modifier`

```css
.task-card { }
.task-card__title { }
.task-card__status { }
.task-card__status--completed { }
.task-card__status--in-progress { }
```

---

## 15. Package & Module Naming (패키지 및 모듈 명명)

### 15.1 NPM Package Names

**규칙**: kebab-case, scoped with `@`

```
@code-api/core
@code-api/parser
@anthropic/claude-sdk
```

---

### 15.2 Module Exports

**Named Exports**: PascalCase for classes, camelCase for functions
```typescript
// TaskLifecycleManager.ts
export class TaskLifecycleManager { }
export function createTaskManager() { }
export const DEFAULT_CONFIG = { };
```

**Default Exports**: Match file name
```typescript
// TasksPage.tsx
export default function TasksPage() { }

// Or
export default TasksPage;
```

---

## Summary Table (요약 표)

| Category | Convention | Examples |
|----------|-----------|----------|
| Classes/Interfaces | PascalCase | `TaskLifecycleManager`, `Agent` |
| Functions/Methods | camelCase | `updateTaskStatus`, `parseTask` |
| Variables | camelCase | `taskId`, `executionResult` |
| Constants | UPPER_SNAKE_CASE | `MAX_CONCURRENT`, `DEFAULT_TIMEOUT_MS` |
| Type Aliases | PascalCase | `TaskStatus`, `ReportType` |
| Files (Service) | PascalCase.ts | `TaskLifecycleManager.ts` |
| Files (Util) | camelCase.ts | `taskParser.ts`, `fileUtils.ts` |
| Files (Component) | PascalCase.tsx | `TasksPage.tsx`, `TaskCard.tsx` |
| Files (Markdown) | kebab-case.md | `system-architecture.md` |
| Files (Task) | task-###.md | `task-001.md`, `task-123.md` |
| Directories | camelCase/kebab-case | `src/services/`, `docs/standards/` |
| IPC Channels | domain:action | `task:createTask`, `agent:listAgents` |
| Preload APIs | domainAPI | `taskAPI`, `claudeAPI`, `centralAPI` |
| Event Handlers | handle{Event} | `handleClick`, `handleTaskSelect` |
| Boolean Fields | is/has/can/should | `isValid`, `hasErrors`, `canExecute` |
| Timestamp Fields | {name}At | `createdAt`, `startedAt`, `completedAt` |
| Array Fields | Plural | `tasks`, `agents`, `errors` |
| Error Classes | {Name}Error | `TaskNotFoundError`, `ValidationError` |
| Error Codes | UPPER_SNAKE_CASE | `TASK_NOT_FOUND`, `AGENT_BUSY` |
| Test Files | {name}.test.ts | `TaskLifecycleManager.test.ts` |
| Git Commits | type(scope): subject | `feat(tasks): add lifecycle` |
| Git Branches | type/description | `feature/task-lifecycle` |

---

모든 코드와 문서는 이 명명 규칙을 따라야 하며, 새로운 패턴 추가 시 이 문서를 업데이트해야 합니다.
