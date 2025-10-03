# Parallel Execution Design

## Overview

Execute 기능을 단일 실행에서 병렬 실행으로 고도화하여 여러 Claude CLI 세션을 동시에 실행하고 독립적으로 관리할 수 있도록 합니다.

## Current Architecture Issues

### 1. ClaudeClient.ts
- **Problem**: 단일 프로세스만 관리, `execute()` 재호출 시 에러
- **Limitation**: 하나의 클라이언트 = 하나의 프로세스

### 2. claudeHandlers.ts
- **Problem**: `activeClients: Map<number, ClaudeClient>` - PID 기반이지만 실질적으로 단일 클라이언트
- **Limitation**: IPC 이벤트가 모든 렌더러에게 브로드캐스트 (`sender.send()`)

### 3. ExecutePage.tsx
- **Problem**: `isRunning` boolean, `currentPid` 단일 값으로 하나의 실행만 추적
- **Limitation**: 병렬 실행 UI 없음

## Target Architecture

### 1. ProcessManager Service (신규)

**Location**: `src/services/ProcessManager.ts`

**Responsibilities**:
- 여러 ClaudeClient 인스턴스 관리
- 각 실행에 고유 Execution ID 부여 (UUID)
- 실행 상태 추적 (pending, running, completed, failed, killed)
- 세션별 이벤트 라우팅

**Interface**:
```typescript
interface ExecutionInfo {
  executionId: string;
  sessionId: string | null;
  projectPath: string;
  query: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'killed';
  pid: number | null;
  client: ClaudeClient;
  events: StreamEvent[];
  errors: string[];
  startTime: number;
  endTime: number | null;
  mcpConfig?: string;
  model?: 'sonnet' | 'opus';
}

class ProcessManager {
  private executions: Map<string, ExecutionInfo>;

  // Start new execution
  startExecution(params: {
    projectPath: string;
    query: string;
    sessionId?: string;
    mcpConfig?: string;
    model?: 'sonnet' | 'opus';
  }): string; // Returns executionId

  // Get execution info
  getExecution(executionId: string): ExecutionInfo | undefined;

  // Get all executions
  getAllExecutions(): ExecutionInfo[];

  // Get active executions
  getActiveExecutions(): ExecutionInfo[];

  // Kill execution
  killExecution(executionId: string): void;

  // Clean up completed executions
  cleanupExecution(executionId: string): void;
}
```

### 2. IPC Protocol Enhancement

**Event Naming Convention**:
모든 이벤트에 `executionId` 포함하여 구독 방식으로 변경

**Channels**:
```typescript
// Request
'claude:execute' -> returns { executionId: string }

// Events (executionId 포함)
'claude:stream' -> { executionId: string, data: StreamEvent }
'claude:error' -> { executionId: string, error: string }
'claude:complete' -> { executionId: string, code: number }
'claude:started' -> { executionId: string, pid: number }

// Queries
'claude:get-execution' -> (executionId) => ExecutionInfo
'claude:get-all-executions' -> () => ExecutionInfo[]
'claude:get-active-executions' -> () => ExecutionInfo[]
'claude:kill-execution' -> (executionId) => void
```

### 3. UI Refactoring

**ExecutePage.tsx Changes**:

```typescript
interface ExecutionState {
  executionId: string;
  projectPath: string;
  query: string;
  events: StreamEvent[];
  errors: string[];
  status: 'running' | 'completed' | 'failed' | 'killed';
  startTime: number;
  endTime: number | null;
}

// State
const [executions, setExecutions] = useState<Map<string, ExecutionState>>(new Map());
const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);

// Execute
const handleExecute = async () => {
  const result = await window.claudeAPI.executeClaudeCommand(
    projectPath,
    query,
    selectedSessionId || undefined,
    selectedMcpConfig || undefined,
    selectedModel
  );

  const executionId = result.executionId;
  setSelectedExecutionId(executionId);

  // Subscribe to events for this execution
  subscribeToExecution(executionId);
};
```

**UI Layout**:
```
┌─────────────────────────────────────────────────┐
│ Execute                                         │
├─────────────────────────────────────────────────┤
│ [Project Path] [Query] [Execute] [Execute All] │
├─────────────────────────────────────────────────┤
│ Executions:                                     │
│ ┌─ Execution 1 (Running) ────────────── [Kill] │
│ │  Query: "Analyze src/..."                    │
│ │  Duration: 00:15                             │
│ ├─ Execution 2 (Completed) ──────────── [View] │
│ │  Query: "Create tests..."                    │
│ │  Duration: 02:34                             │
│ └─ Execution 3 (Running) ────────────── [Kill] │
│    Query: "Refactor..."                        │
│    Duration: 00:42                             │
└─────────────────────────────────────────────────┘
│ Selected Execution Output:                     │
│ [StreamOutput Component]                       │
└─────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: ProcessManager Implementation
1. Create `src/services/ProcessManager.ts`
2. Implement execution management
3. Add unit tests

### Phase 2: IPC Refactoring
1. Update `src/ipc/handlers/claudeHandlers.ts`
2. Add executionId to all events
3. Update preload API types

### Phase 3: UI Refactoring
1. Update ExecutePage to manage multiple executions
2. Add execution list component
3. Add execution subscription mechanism

### Phase 4: Testing
1. Test single execution (regression)
2. Test parallel execution (2-3 simultaneous)
3. Test execution management (kill, cleanup)

## Benefits

1. **병렬 처리**: 여러 작업을 동시에 실행 (예: 분석 + 구현)
2. **자동화**: 여러 쿼리를 자동으로 순차/병렬 실행
3. **독립성**: 각 실행이 독립적으로 관리됨
4. **확장성**: Task 기반 자동 실행으로 확장 가능

## Future Enhancements

1. **Queue System**: 실행 대기열 관리
2. **Batch Execution**: 여러 쿼리 일괄 실행
3. **Execution Templates**: 자주 쓰는 실행 패턴 저장
4. **Resource Management**: CPU/메모리 제한 설정
5. **Execution History**: 과거 실행 기록 조회
