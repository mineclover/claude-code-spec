# State Machines & Workflows (상태 머신 및 워크플로우)

## 상태 머신 및 워크플로우 표준화

모든 상태 전이와 워크플로우를 명확히 정의하여 예측 가능한 시스템 동작을 보장합니다.

---

## 1. Task State Machine (Task 상태 머신)

### 1.1 States

```
┌─────────┐
│ pending │ ◄──── Initial state
└─────────┘
     │
     │ startTask()
     ▼
┌──────────────┐
│ in_progress  │
└──────────────┘
     │
     ├────────► completeTask() ──────► ┌───────────┐
     │                                  │ completed │
     │                                  └───────────┘
     │
     └────────► cancel() ───────────► ┌───────────┐
                                       │ cancelled │
                                       └───────────┘
```

### 1.2 Transition Rules

| From State | To State | Trigger | Conditions | Side Effects |
|-----------|----------|---------|-----------|--------------|
| `pending` | `in_progress` | `startTask()` | Dependencies resolved, Agent available | Update `updated`, record agent |
| `in_progress` | `completed` | `completeTask()` | Success criteria met | Update `updated`, generate review notes |
| `in_progress` | `cancelled` | `cancel()` | Manual cancellation | Update `updated`, release agent |
| `pending` | `cancelled` | `cancel()` | Manual cancellation | Update `updated` |

### 1.3 Invalid Transitions

**Rejected Transitions** (return error):
- `completed` → `pending`
- `completed` → `in_progress`
- `cancelled` → `pending`
- `cancelled` → `in_progress`
- `pending` → `completed` (must go through in_progress)

**Auto-correction**:
- If agent crashes during `in_progress`, system can reset to `pending` after cleanup

---

## 2. Agent State Machine (Agent 상태 머신)

### 2.1 States

```
┌──────┐
│ idle │ ◄──── Initial state
└──────┘
   │
   │ assignTask()
   ▼
┌──────┐
│ busy │
└──────┘
   │
   │ taskComplete() or taskFailed()
   ▼
┌──────┐
│ idle │
└──────┘
```

### 2.2 Transition Rules

| From State | To State | Trigger | Conditions | Side Effects |
|-----------|----------|---------|-----------|--------------|
| `idle` | `busy` | `assignTask()` | Task available | Record task ID, update lastUsed |
| `busy` | `idle` | `taskComplete()` | Task execution finished | Clear task ID, update stats |
| `busy` | `idle` | `taskFailed()` | Task execution failed | Clear task ID, record error |

### 2.3 Invalid Transitions

**Rejected Transitions**:
- `busy` → `busy` (cannot assign new task while busy)

**Auto-recovery**:
- If process dies, agent automatically transitions to `idle` after cleanup

---

## 3. Execution State Machine (실행 상태 머신)

### 3.1 States

```
┌─────────┐
│ pending │ ◄──── Initial state
└─────────┘
     │
     │ processStart()
     ▼
┌─────────┐
│ running │
└─────────┘
     │
     ├────────► processExit(0) ──────► ┌───────────┐
     │                                  │ completed │
     │                                  └───────────┘
     │
     └────────► processExit(!=0) ────► ┌─────────┐
                or timeout               │ failed  │
                                         └─────────┘
```

### 3.2 Transition Rules

| From State | To State | Trigger | Conditions | Side Effects |
|-----------|----------|---------|-----------|--------------|
| `pending` | `running` | `processStart()` | Process spawned | Record PID, startedAt |
| `running` | `completed` | `processExit(0)` | Exit code 0 | Record completedAt, duration |
| `running` | `failed` | `processExit(!=0)` | Exit code != 0 | Record error, completedAt |
| `running` | `failed` | `timeout` | Execution time > limit | Kill process, record timeout error |

### 3.3 Cleanup Triggers

- On `completed` or `failed`: Release agent, cleanup temp files, archive logs
- On `timeout`: Kill process, notify user, log incident

---

## 4. Project Health State Machine (프로젝트 상태 머신)

### 4.1 States

```
┌─────────┐
│ unknown │ ◄──── Initial state
└─────────┘
     │
     │ healthCheck()
     ▼
┌─────────┐
│ healthy │ ◄──┐
└─────────┘    │
     │         │
     │ warning detected
     ▼         │
┌─────────┐   │
│ warning │ ──┤ warning resolved
└─────────┘   │
     │         │
     │ error detected
     ▼         │
┌─────────┐   │
│  error  │ ──┘ error resolved
└─────────┘
```

### 4.2 Health Check Criteria

**Healthy**:
- No tasks in `in_progress` for > 1 hour
- No zombie agents
- All recent executions successful

**Warning**:
- 1-2 tasks stuck in `in_progress`
- 1 zombie agent detected
- 1-2 recent execution failures

**Error**:
- 3+ tasks stuck in `in_progress`
- 2+ zombie agents detected
- 3+ consecutive execution failures
- Critical file missing (CLAUDE.md, settings.json)

---

## 5. Task Execution Workflow (Task 실행 워크플로우)

### 5.1 Complete Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    Task Execution Workflow                    │
└──────────────────────────────────────────────────────────────┘

[1] User/System Trigger
         │
         ▼
[2] Task Selection (getNextTask)
         │
         ├──► No executable tasks ──► END
         │
         ▼
[3] Dependency Check (canExecuteTask)
         │
         ├──► Dependencies not met ──► WAIT
         │
         ▼
[4] Agent Assignment (getAgent)
         │
         ├──► Agent busy ──► Queue or Error
         │
         ▼
[5] Status Update (pending → in_progress)
         │
         ▼
[6] Context Preparation
    - Load task definition
    - Load agent instructions
    - Prepare references
    - Prepare skill context
         │
         ▼
[7] Execute Claude CLI
    - Spawn process
    - Stream parsing
    - Real-time updates
         │
         ├──► Process Error ──► [Error Handler]
         │
         ▼
[8] Completion Analysis
    - Parse execution results
    - Match success criteria
    - Calculate confidence
         │
         ├──► Low confidence ──► Manual Review Required
         │
         ▼
[9] Status Update (in_progress → completed)
         │
         ▼
[10] Post-completion
     - Generate review notes
     - Release agent
     - Submit completion report
     - Trigger next task
         │
         ▼
    [END]

[Error Handler]
         │
         ├──► Retry count < 3 ──► Back to [5]
         │
         └──► Retry exhausted ──► Mark as failed
                                  Release agent
                                  Submit failure report
                                  END
```

### 5.2 Detailed Steps

**[1] User/System Trigger**:
- Manual: User clicks "Execute Task" button
- Auto: WorkflowEngine selects next task
- Scheduled: CentralReporter triggers periodic tasks

**[2] Task Selection**:
```typescript
const nextTask = await taskLifecycleManager.getNextTask();
if (!nextTask) {
  console.log('No executable tasks');
  return;
}
```

**[3] Dependency Check**:
```typescript
const check = await taskLifecycleManager.canExecuteTask(nextTask.id);
if (!check.canExecute) {
  console.log(`Blocked: ${check.reason}`, check.blockingTasks);
  return;
}
```

**[4] Agent Assignment**:
```typescript
const agent = await agentPoolManager.getAgent(nextTask.metadata.assigned_agent);
if (agent.status === 'busy') {
  // Queue or error
  throw new AgentBusyError();
}
```

**[5] Status Update**:
```typescript
await taskLifecycleManager.startTask(nextTask.id, agent.metadata.name);
// Task status: pending → in_progress
// Agent status: idle → busy
```

**[6] Context Preparation**:
```typescript
const context = {
  taskInstructions: nextTask.description,
  agentInstructions: agent.instructions,
  references: await loadReferences(nextTask.references),
  successCriteria: nextTask.successCriteria,
  skillContext: await loadSkillContext(execution.skillId),
};
```

**[7] Execute Claude CLI**:
```typescript
const sessionId = await processManager.startExecution({
  projectPath,
  query: buildTaskQuery(context),
  agentName: agent.metadata.name,
  taskId: nextTask.id,
});
```

**[8] Completion Analysis**:
```typescript
const analysis = await sessionAnalyzer.analyzeCompletion(sessionId, nextTask);
if (analysis.confidence < 80) {
  // Requires manual review
  await notifyReviewer(nextTask);
}
```

**[9] Status Update**:
```typescript
await taskLifecycleManager.completeTask(
  nextTask.id,
  agent.metadata.name,
  analysis.reviewNotes
);
// Task status: in_progress → completed
// Agent status: busy → idle
```

**[10] Post-completion**:
```typescript
// Generate review notes
await generateReviewNotes(nextTask, analysis);

// Submit report
await centralAPI.submitReport({
  type: 'completion',
  taskId: nextTask.id,
  agentName: agent.metadata.name,
  success: true,
  matchedCriteria: analysis.matchedCriteria,
});

// Trigger next task
workflowEngine.selectAndExecuteNext();
```

---

## 6. Central Reporting Workflow (중앙 보고 워크플로우)

### 6.1 Periodic Collection Flow

```
┌─────────────────────────────────────────────────────────┐
│              Periodic Reporting Workflow                 │
└─────────────────────────────────────────────────────────┘

[Timer Trigger: Every 1 hour]
         │
         ▼
[1] CentralReporter Agent Activation
         │
         ▼
[2] Scan Registered Projects
    - Load project list from CentralDatabase
    - Filter active projects
         │
         ▼
[3] For Each Project:
    ├──► Collect Task Statistics
    │    - Count by status
    │    - Identify executable tasks
    │    - Find blocked tasks
    │
    ├──► Collect Agent Statistics
    │    - Count by status
    │    - Check for zombies
    │    - Record usage stats
    │
    └──► Collect Recent Activity
         - Last 10 task updates
         - Last 5 executions
         │
         ▼
[4] Generate Periodic Report
    - Aggregate statistics
    - Calculate health score
    - Identify issues
         │
         ▼
[5] Validate Report
    - Check required fields
    - Validate data types
    - Verify references
         │
         ├──► Invalid ──► Log error, Skip project
         │
         ▼
[6] Submit to CentralDatabase
    - Save report
    - Update project lastSeen
    - Archive old reports
         │
         ▼
[7] Update Dashboard
    - Broadcast update event
    - Refresh UI
         │
         ▼
[8] Check for Alerts
    - Health degradation
    - Zombie processes
    - Stuck tasks
         │
         └──► Trigger alert if needed
                │
                ▼
              [END]
```

---

## 7. Workflow Engine Loop (워크플로우 엔진 루프)

### 7.1 Automated Task Execution Loop

```
┌─────────────────────────────────────────────────────────┐
│            Workflow Engine Main Loop                     │
└─────────────────────────────────────────────────────────┘

[START: User clicks "Start Workflow"]
         │
         ▼
[1] Initialize Workflow
    - Load all tasks
    - Build dependency graph
    - Check project health
         │
         ├──► Project unhealthy ──► Show warning, Allow proceed?
         │                                   │
         │                                   ├─ No ──► END
         │                                   │
         │                                   └─ Yes ──► Continue
         ▼
[2] LOOP: While (executable tasks exist AND not stopped)
         │
         ▼
    [2.1] Select Next Task
          - Priority: Manual priority > Creation order
          - Filter: Only executable tasks
          - Limit: Respect maxConcurrent
         │
         ├──► No tasks available ──► Wait 30s ──► Continue loop
         │
         ▼
    [2.2] Execute Task (see Task Execution Workflow)
         │
         ├──► Success ──► Continue loop
         │
         ├──► Failure ──► Retry or Mark failed ──► Continue loop
         │
         └──► Fatal Error ──► Log, Notify ──► PAUSE workflow
                                                    │
                                                    ▼
                                              [Manual intervention]
                                                    │
                                                    ├─ Resume ──► Continue loop
                                                    │
                                                    └─ Stop ──► END
         ▼
[3] All Tasks Completed
    - Generate summary report
    - Calculate statistics
    - Submit completion report
         │
         ▼
    [END]

[STOP Button Pressed]
         │
         ▼
    [Graceful Shutdown]
    - Wait for current task to complete
    - Mark workflow as paused
    - Save state
         │
         ▼
    [END]
```

### 7.2 Concurrency Control

```typescript
class WorkflowEngine {
  private maxConcurrent = 3;
  private runningTasks: Set<string> = new Set();

  async executeNext(): Promise<void> {
    if (this.runningTasks.size >= this.maxConcurrent) {
      // Wait for a slot
      await this.waitForSlot();
    }

    const nextTask = await this.selectNextTask();
    if (!nextTask) {
      return;
    }

    this.runningTasks.add(nextTask.id);

    // Execute asynchronously
    this.executeTask(nextTask)
      .finally(() => {
        this.runningTasks.delete(nextTask.id);
        this.executeNext(); // Try to fill the slot
      });
  }
}
```

---

## 8. Error Recovery Workflows (에러 복구 워크플로우)

### 8.1 Agent Crash Recovery

```
[Agent Process Crash Detected]
         │
         ▼
[1] Identify Affected Task
    - Find task with status=in_progress and agent=crashed agent
         │
         ▼
[2] Analyze Task State
    - Check execution logs
    - Check success criteria
    - Calculate progress
         │
         ├──► Progress >= 80% ──► Mark as completed with notes
         │
         ├──► Progress 20-80% ──► Reset to pending, Allow retry
         │
         └──► Progress < 20% ──► Reset to pending, Full retry
         ▼
[3] Release Agent
    - Set agent status to idle
    - Clear currentTask
         │
         ▼
[4] Submit Incident Report
    - Log crash details
    - Attach logs
    - Notify admin
         │
         ▼
[5] Resume Workflow
    - Re-add task to queue if retry
    - Continue with next task
         │
         ▼
    [END]
```

### 8.2 Zombie Process Cleanup

```
[Zombie Process Detected]
(No heartbeat for 5 minutes)
         │
         ▼
[1] Verify Process Status
    - Check PID existence
    - Check CPU/Memory usage
         │
         ├──► Process dead ──► [Skip to 4]
         │
         ▼
[2] Attempt Graceful Shutdown
    - Send SIGTERM
    - Wait 30s
         │
         ├──► Process exited ──► [Continue to 4]
         │
         ▼
[3] Force Kill
    - Send SIGKILL
    - Wait 10s
         │
         ▼
[4] Cleanup Resources
    - Release agent
    - Update task status
    - Clean temp files
         │
         ▼
[5] Submit Zombie Report
    - Record incident
    - Attach diagnostics
         │
         ▼
[6] Resume Normal Operation
         │
         ▼
    [END]
```

### 8.3 Dependency Deadlock Resolution

```
[Deadlock Detected]
(Circular dependencies)
         │
         ▼
[1] Identify Cycle
    - Build dependency graph
    - Find strongly connected components
         │
         ▼
[2] Analyze Tasks in Cycle
    - Check if any can be broken
    - Look for optional dependencies
         │
         ├──► Can break ──► Remove weakest dependency
         │                        │
         │                        ▼
         │                   Resume execution
         │
         └──► Cannot break ──► [Continue]
         ▼
[3] Manual Intervention Required
    - Notify admin
    - Show dependency cycle
    - Suggest resolution
         │
         ▼
[Admin Action]
    ├──► Modify task dependencies
    ├──► Mark one task as completed manually
    └──► Cancel one task
         │
         ▼
    Resume workflow
         │
         ▼
    [END]
```

---

## 9. State Persistence (상태 영속화)

### 9.1 State Save Points

**When to Save**:
- After every task status change
- After every agent assignment/release
- After every execution start/complete
- Every 5 minutes (auto-save)
- On workflow pause/stop

**What to Save**:
```typescript
interface WorkflowState {
  projectPath: string;
  status: 'idle' | 'running' | 'paused' | 'completed';
  startedAt: string;
  lastSavedAt: string;

  tasks: {
    [taskId: string]: {
      status: TaskStatus;
      assignedAgent?: string;
      startedAt?: string;
      progress?: number;
    };
  };

  agents: {
    [agentName: string]: {
      status: AgentStatus;
      currentTask?: string;
      lastUsed?: string;
    };
  };

  executions: {
    [sessionId: string]: {
      taskId: string;
      status: ExecutionStatus;
      startedAt: string;
    };
  };
}
```

### 9.2 State Recovery

```
[Application Start]
         │
         ▼
[Check for Saved State]
         │
         ├──► No saved state ──► Normal initialization
         │
         ▼
[Load Saved State]
         │
         ▼
[Verify State Integrity]
    - Check process PIDs
    - Verify file existence
    - Validate timestamps
         │
         ├──► Invalid ──► Discard, Normal init
         │
         ▼
[Recover Tasks]
    ├──► in_progress tasks ──► Check if process alive
    │                                   │
    │                                   ├─ Alive ──► Continue monitoring
    │                                   │
    │                                   └─ Dead ──► Reset to pending
    │
    └──► pending tasks ──► Keep as-is
         │
         ▼
[Recover Agents]
    - Reset all to idle (conservative approach)
         │
         ▼
[Resume Workflow]
    - Prompt user: "Resume previous workflow?"
         │
         ├─ Yes ──► Continue from last state
         │
         └─ No ──► Reset to initial state
         │
         ▼
    [END]
```

---

## 10. Event Flow Diagrams (이벤트 흐름도)

### 10.1 Task Status Change Event Flow

```
┌──────────────────────────────────────────────────────────┐
│                Task Status Change Event                   │
└──────────────────────────────────────────────────────────┘

[TaskLifecycleManager.updateTaskStatus()]
         │
         ├──► Validate transition
         │    │
         │    ├─ Invalid ──► Throw error
         │    │
         │    └─ Valid ──► Continue
         │
         ├──► Update task file
         │
         ├──► Update metadata.updated
         │
         ├──► Emit IPC event: 'task:statusChanged'
         │         │
         │         ├──► UI Renderer receives event
         │         │    - Update TasksPage display
         │         │    - Update WorkflowPage display
         │         │
         │         └──► WorkflowEngine receives event
         │              - Check if triggers next task
         │
         └──► Submit status report to Central
              - Type: progress or completion
              - Include task details
                   │
                   ├──► CentralDatabase saves report
                   │
                   └──► CentralDashboard updates
                        - Refresh project stats
                        - Update timeline
```

### 10.2 Execution Stream Event Flow

```
┌──────────────────────────────────────────────────────────┐
│              Execution Stream Event Flow                  │
└──────────────────────────────────────────────────────────┘

[Claude CLI Process stdout]
         │
         ▼
[StreamParser.processChunk()]
    - Parse JSONL
    - Validate JSON
    - Extract event type
         │
         ├──► type: 'system', subtype: 'init'
         │    - Record session metadata
         │    - Emit: 'claude:started'
         │
         ├──► type: 'message'
         │    - Parse assistant message
         │    - Emit: 'claude:stream'
         │         │
         │         └──► UI updates in real-time
         │              - Append to execution log
         │              - Show typing indicator
         │
         ├──► type: 'tool_use'
         │    - Record tool call
         │    - Emit: 'claude:stream'
         │         │
         │         └──► UI shows tool execution
         │
         ├──► type: 'result'
         │    - Record completion
         │    - Emit: 'claude:complete'
         │         │
         │         ├──► ExecutionInfo updated
         │         │
         │         ├──► Agent released
         │         │
         │         └──► Task status checked
         │              - If success criteria met
         │                → completeTask()
         │
         └──► type: 'error'
              - Record error
              - Emit: 'claude:error'
                   │
                   ├──► UI shows error
                   │
                   ├──► Task marked as failed
                   │
                   └──► Error report submitted
```

---

모든 상태 머신과 워크플로우는 이 표준을 따라야 하며, 새로운 상태나 워크플로우 추가 시 이 문서를 업데이트해야 합니다.
