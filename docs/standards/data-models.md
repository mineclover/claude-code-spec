# Data Model Standards (데이터 모델 표준)

## 데이터 모델 표준화

모든 데이터 구조와 인터페이스를 명확히 정의하여 일관된 데이터 처리를 보장합니다.

---

## 1. Core Data Models (핵심 데이터 모델)

### 1.1 Task

**파일**: `src/types/task.ts`

```typescript
export interface TaskMetadata {
  id: string;                    // task-001, task-002, ...
  title: string;                 // 작업 제목
  area: string;                  // Frontend/Pages, Backend/Process, ...
  assigned_agent: string;        // claude-sonnet-4, custom-agent, ...
  reviewer: string;              // claude-opus-4, human:email@example.com
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created: string;               // ISO 8601: 2025-11-23T22:30:00Z
  updated: string;               // ISO 8601: 2025-11-23T22:30:00Z
  dependencies?: string[];       // ['task-001', 'task-002']
}

export interface Task {
  metadata: TaskMetadata;
  references: string[];          // ['src/services/Foo.ts', 'docs/bar.md']
  successCriteria: string[];     // ['[ ] Feature X implemented', '[ ] Tests pass']
  description: string;           // Markdown content
  reviewNotes?: string;          // Reviewer feedback (Markdown)

  // Computed fields
  filePath?: string;             // workflow/tasks/task-001.md
}
```

**Validation Rules**:
- `id`: Must match pattern `task-\d{3,}` (task-001, task-012)
- `title`: Non-empty, max 200 characters
- `area`: Must be valid Work Area ID (from work-areas.json)
- `assigned_agent`: Non-empty string
- `status`: One of enum values only
- `created`, `updated`: Valid ISO 8601 timestamp
- `references`: All paths must exist (warning if not)
- `successCriteria`: At least one criterion required

**State Transitions**:
```
pending → in_progress (when execution starts)
in_progress → completed (when success criteria met)
in_progress → cancelled (manual cancellation)
pending → cancelled (manual cancellation)
```

---

### 1.2 Agent

**파일**: `src/types/agent.ts`

```typescript
export interface AgentMetadata {
  name: string;                  // task-generator, central-reporter
  description: string;           // Agent purpose
  version?: string;              // Semantic version: 1.0.0
  author?: string;               // Author name or organization
  tags?: string[];               // ['task-management', 'automation']
  outputStyle?: 'concise' | 'explanatory' | 'verbose';
  allowedTools?: string[];       // ['Read', 'Write', 'mcp__serena__*']
  permissions?: {
    allowList?: string[];        // ['read:**', 'write:workflow/tasks/**']
    denyList?: string[];         // ['write:src/**', 'read:.env']
  };
}

export interface Agent {
  metadata: AgentMetadata;
  instructions: string;          // Markdown content with agent role and guidelines

  // Runtime fields
  filePath?: string;             // workflow/agents/task-generator.md
  status?: 'idle' | 'busy';      // Agent execution status
  currentTask?: string;          // task-001 (if busy)
  lastUsed?: string;             // ISO 8601 timestamp
}
```

**Validation Rules**:
- `name`: Kebab-case, no special characters except hyphen
- `description`: Non-empty, max 500 characters
- `version`: Semantic versioning (X.Y.Z) if provided
- `allowedTools`: Valid tool names only
- `permissions.allowList`: Valid glob patterns
- `instructions`: Non-empty markdown

**Status Transitions**:
```
idle → busy (when task execution starts)
busy → idle (when task execution completes/fails)
```

---

### 1.3 Execution

**파일**: `src/services/ProcessManager.ts`

```typescript
export interface ExecutionParams {
  projectPath: string;           // /Users/user/project
  query: string;                 // User query or task prompt
  model?: string;                // claude-sonnet-4, claude-opus-4
  sessionId?: string;            // Existing session to continue
  mcpConfig?: string;            // Path to MCP config file
  agentName?: string;            // Agent name for routing
  taskId?: string;               // Associated task ID
  skillId?: string;              // Selected skill ID
  skillScope?: 'global' | 'project';
}

export interface ExecutionInfo {
  sessionId: string;             // Unique session identifier
  pid: number | null;            // Process ID (null if not started)
  status: 'pending' | 'running' | 'completed' | 'failed';
  projectPath: string;
  query: string;
  model: string;
  startedAt: string;             // ISO 8601 timestamp
  completedAt?: string;          // ISO 8601 timestamp
  duration?: number;             // Milliseconds
  events: StreamEvent[];         // All stream events
  error?: string;                // Error message if failed

  // Agent routing info
  agentName?: string;
  taskId?: string;

  // Skill info
  skillId?: string;
  skillScope?: 'global' | 'project';
}

export interface StreamEvent {
  type: 'system' | 'message' | 'tool_use' | 'tool_result' | 'result' | 'error';
  subtype?: string;              // init, assistant, user, etc.
  timestamp: string;             // ISO 8601 timestamp
  data: Record<string, any>;     // Event-specific data

  // Parsed fields (from data)
  session_id?: string;
  model?: string;
  message?: {
    role: 'user' | 'assistant';
    content: Array<{
      type: 'text' | 'tool_use' | 'tool_result';
      text?: string;
      name?: string;
      input?: any;
      output?: any;
    }>;
  };
}
```

**Validation Rules**:
- `projectPath`: Must be valid directory path
- `query`: Non-empty string
- `sessionId`: UUID format if provided
- `status`: One of enum values
- `startedAt`, `completedAt`: Valid ISO 8601 timestamps
- `duration`: Non-negative integer

**Status Transitions**:
```
pending → running (when process starts)
running → completed (when process exits successfully)
running → failed (when process exits with error)
```

---

### 1.4 Skill

**파일**: `src/types/skill.ts`

```typescript
export interface SkillMetadata {
  name: string;                  // skill-creator, task-analyzer
  description: string;           // Skill purpose
  version: string;               // Semantic version: 1.0.0
  author?: string;
  tags?: string[];
  category?: string;             // development, analysis, automation
}

export interface Skill {
  metadata: SkillMetadata;
  content: string;               // Markdown content with skill instructions

  // Computed fields
  filePath?: string;             // .claude/skills/skill-creator/SKILL.md
  scope: 'global' | 'project';   // Installation scope
}
```

**Validation Rules**:
- `name`: Kebab-case, alphanumeric + hyphen only
- `version`: Semantic versioning (X.Y.Z)
- `description`: Non-empty, max 500 characters
- `content`: Non-empty markdown

---

## 2. Central Management Models (중앙 관리 모델)

### 2.1 Project Registration

**파일**: `src/services/CentralDatabase.ts`

```typescript
export interface ProjectRegistration {
  projectPath: string;           // Absolute path
  name: string;                  // Project name
  registeredAt: string;          // ISO 8601 timestamp
  lastSeen: string;              // ISO 8601 timestamp
  healthStatus: 'healthy' | 'warning' | 'error' | 'unknown';

  // Statistics
  stats: {
    totalTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    completedTasks: number;
    cancelledTasks: number;
    totalAgents: number;
    activeAgents: number;
  };
}
```

---

### 2.2 Report Types

**파일**: `src/types/report.ts`

```typescript
export type ReportType = 'assignment' | 'progress' | 'completion' | 'periodic';

export interface BaseReport {
  id: string;                    // UUID
  type: ReportType;
  projectPath: string;
  timestamp: string;             // ISO 8601
  reportedBy: string;            // Agent name or 'system'
}

export interface AssignmentReport extends BaseReport {
  type: 'assignment';
  taskId: string;
  agentName: string;
  estimatedDuration?: number;    // Minutes
}

export interface ProgressReport extends BaseReport {
  type: 'progress';
  taskId: string;
  agentName: string;
  progress: {
    percent: number;             // 0-100
    confidence: number;          // 0-100
    method: 'criteria' | 'duration' | 'changes' | 'estimated';
  };
  matchedCriteria?: string[];
  sessionId?: string;
}

export interface CompletionReport extends BaseReport {
  type: 'completion';
  taskId: string;
  agentName: string;
  success: boolean;
  duration: number;              // Minutes
  matchedCriteria: string[];
  sessionId: string;
  reviewNotes?: string;
}

export interface PeriodicReport extends BaseReport {
  type: 'periodic';
  projectStats: {
    totalTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    completedTasks: number;
    cancelledTasks: number;
    executableTasks: number;
  };
  agentStats: {
    totalAgents: number;
    idleAgents: number;
    busyAgents: number;
  };
  recentActivity: {
    taskId: string;
    status: string;
    timestamp: string;
  }[];
}

export type Report = AssignmentReport | ProgressReport | CompletionReport | PeriodicReport;
```

**Validation Rules**:
- `id`: Valid UUID v4
- `projectPath`: Must exist and be registered
- `timestamp`: Valid ISO 8601
- `percent`, `confidence`: 0-100 range
- `duration`: Non-negative integer

---

### 2.3 Agent Execution Tracking

**파일**: `src/services/AgentTracker.ts`

```typescript
export interface AgentExecution {
  executionId: string;           // UUID
  projectPath: string;
  agentName: string;
  taskId?: string;
  sessionId: string;
  pid: number;
  status: 'running' | 'completed' | 'failed' | 'zombie';
  startedAt: string;             // ISO 8601
  lastHeartbeat: string;         // ISO 8601
  completedAt?: string;          // ISO 8601
  exitCode?: number;
  error?: string;
}
```

**Status Transitions**:
```
running → completed (normal exit, code 0)
running → failed (error exit, code != 0)
running → zombie (no heartbeat for 5 minutes)
zombie → completed/failed (after cleanup)
```

---

## 3. UI Data Models (UI 데이터 모델)

### 3.1 Work Area

**파일**: `.claude/work-areas.json`

```typescript
export interface WorkArea {
  id: string;                    // frontend-pages, backend-process
  category: string;              // Frontend, Backend, Infra, Docs, Test
  subcategory: string;           // Pages, Components, Process, etc.
  displayName: string;           // Frontend/Pages
  description: string;           // 페이지 컴포넌트
}

export interface WorkAreasConfig {
  areas: WorkArea[];
}
```

**Validation Rules**:
- `id`: Kebab-case, must match `${category}-${subcategory}` pattern (lowercase)
- `category`: One of predefined categories
- `displayName`: Format `${category}/${subcategory}`

---

### 3.2 MCP Configuration

**파일**: `.claude/.mcp-*.json`

```typescript
export interface MCPServerConfig {
  command: string;               // node, python, etc.
  args?: string[];               // Command arguments
  env?: Record<string, string>;  // Environment variables
}

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}
```

**Example**:
```json
{
  "mcpServers": {
    "serena": {
      "command": "npx",
      "args": ["-y", "@serenaapp/mcp"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@context7/mcp-server"]
    }
  }
}
```

---

### 3.3 Session Analysis

**파일**: `src/services/SessionAnalyzer.ts`

```typescript
export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;             // ISO 8601
  isToolResult: boolean;         // True if this is auto-generated from tool
  toolName?: string;             // Tool name if isToolResult
}

export interface SessionAnalysis {
  sessionId: string;
  projectPath: string;
  totalMessages: number;
  userQuestions: SessionMessage[];      // Pure user inputs
  autoGeneratedRequests: SessionMessage[]; // Claude's internal requests
  statistics: {
    userQuestionCount: number;
    autoGeneratedCount: number;
    toolUseCount: number;
    averageResponseTime: number; // Milliseconds
  };
}
```

---

## 4. Configuration Models (설정 모델)

### 4.1 Permissions

**파일**: `.claude/settings.json`

```typescript
export interface PermissionRule {
  allow?: string[];              // Glob patterns: ['read:**', 'write:workflow/**']
  deny?: string[];               // Glob patterns: ['write:src/**']
}

export interface Settings {
  permissions?: PermissionRule;
  mcpConfig?: string;            // Path to MCP config file
  defaultModel?: string;         // claude-sonnet-4
}
```

---

### 4.2 Bookmarks

**파일**: `.claude/bookmarks.json`

```typescript
export interface Bookmark {
  id: string;                    // UUID
  title: string;
  projectPath?: string;          // Project-specific bookmark
  path: string;                  // File or directory path
  type: 'file' | 'directory';
  description?: string;
  tags?: string[];
  createdAt: string;             // ISO 8601
}

export interface BookmarksConfig {
  bookmarks: Bookmark[];
}
```

---

## 5. Validation Schemas (검증 스키마)

### 5.1 Task Validation

```typescript
export interface ValidationError {
  field: string;                 // metadata.id, references[0]
  message: string;               // Error description
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}
```

---

### 5.2 Report Validation

```typescript
export interface ReportValidationRule {
  field: string;
  type: 'required' | 'format' | 'range' | 'reference';
  validator: (value: any) => boolean;
  message: string;
}
```

---

## 6. API Response Models (API 응답 모델)

### 6.1 Success Response

```typescript
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;             // ISO 8601
}
```

---

### 6.2 Error Response

```typescript
export interface ErrorResponse {
  success: false;
  error: {
    code: string;                // TASK_NOT_FOUND, AGENT_BUSY, etc.
    message: string;
    details?: any;
  };
  timestamp: string;             // ISO 8601
}
```

---

## 7. Statistics Models (통계 모델)

### 7.1 Task Statistics

```typescript
export interface TaskStatistics {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  executable: number;            // Tasks ready to execute

  // Time-based stats
  averageCompletionTime?: number; // Minutes
  oldestPendingTask?: {
    taskId: string;
    age: number;                 // Days
  };
}
```

---

### 7.2 Agent Statistics

```typescript
export interface AgentStatistics {
  totalAgents: number;
  idleAgents: number;
  busyAgents: number;

  // Usage stats
  mostUsedAgent?: {
    name: string;
    usageCount: number;
  };
  averageExecutionTime?: Record<string, number>; // Agent name → minutes
}
```

---

### 7.3 System Metrics

```typescript
export interface SystemMetrics {
  uptime: number;                // Seconds
  totalExecutions: number;
  activeExecutions: number;
  completedExecutions: number;
  failedExecutions: number;

  // Resource usage
  memoryUsage: {
    heapUsed: number;            // Bytes
    heapTotal: number;           // Bytes
    external: number;            // Bytes
  };

  // Performance
  averageExecutionTime: number;  // Milliseconds
  averageResponseTime: number;   // Milliseconds
}
```

---

## 8. Naming Conventions (명명 규칙)

### 8.1 TypeScript Types

- **Interfaces**: PascalCase with descriptive nouns
  - `Task`, `Agent`, `ExecutionInfo`, `TaskStatistics`
- **Type Aliases**: PascalCase
  - `ReportType`, `TaskStatus`, `AgentStatus`
- **Enums**: PascalCase
  - `enum TaskStatus { Pending, InProgress, Completed }`
- **Enum Values**: PascalCase
  - `TaskStatus.Pending`, `TaskStatus.InProgress`

### 8.2 Field Names

- **Required fields**: camelCase
  - `taskId`, `agentName`, `projectPath`
- **Optional fields**: camelCase with `?`
  - `reviewNotes?`, `error?`, `duration?`
- **Boolean fields**: Prefix with `is`, `has`, `can`
  - `isToolResult`, `hasError`, `canExecute`
- **Timestamps**: Suffix with `At`
  - `createdAt`, `startedAt`, `completedAt`
- **Arrays**: Plural nouns
  - `tasks`, `agents`, `events`, `errors`

### 8.3 Constants

- **Enum-like constants**: UPPER_SNAKE_CASE
  ```typescript
  const MAX_CONCURRENT_EXECUTIONS = 5;
  const DEFAULT_TIMEOUT_MS = 120000;
  ```

---

## 9. Data Transformation Rules (데이터 변환 규칙)

### 9.1 Markdown to Object

**Task Parsing**:
```
Markdown File → TaskParser.parse() → Task object
- Extract YAML frontmatter → metadata
- Parse ## References → references[]
- Parse ## Success Criteria → successCriteria[]
- Parse ## Description → description
- Parse ## Review Notes → reviewNotes
```

**Agent Parsing**:
```
Markdown File → AgentParser.parse() → Agent object
- Extract YAML frontmatter → metadata
- Parse body → instructions
```

### 9.2 Object to Markdown

**Task Serialization**:
```
Task object → TaskParser.serialize() → Markdown string
- metadata → YAML frontmatter (---...---)
- references → ## References\n- item1\n- item2
- successCriteria → ## Success Criteria\n- [ ] item1
- description → ## Description\n{content}
- reviewNotes → ## Review Notes\n{content}
```

---

## 10. Data Integrity Rules (데이터 무결성 규칙)

### 10.1 Referential Integrity

- **Task → Agent**: `assigned_agent` must reference existing agent
- **Task → Task**: `dependencies[]` must reference existing task IDs
- **Execution → Task**: `taskId` should reference existing task (optional)
- **Report → Project**: `projectPath` must be registered project

### 10.2 Temporal Integrity

- `created` must be <= `updated`
- `startedAt` must be <= `completedAt`
- `updated` timestamp must increase on each update

### 10.3 State Consistency

- If `Task.status = 'in_progress'`, there must be an active `AgentExecution`
- If `Agent.status = 'busy'`, `currentTask` must be set
- If `Execution.status = 'running'`, `pid` must be non-null

---

모든 데이터 모델은 이 표준을 따라야 하며, 새로운 모델 추가 시 이 문서를 업데이트해야 합니다.
