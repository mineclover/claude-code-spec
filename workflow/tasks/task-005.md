---
id: task-005
title: Implement AgentTracker for execution monitoring
area: Backend/Process
assigned_agent: claude-sonnet-4
reviewer: claude-opus-4
status: pending
created: 2025-11-24T15:50:00Z
updated: 2025-11-24T15:50:00Z
---

## References
- docs/standards/role-definitions.md (AgentTracker section)
- src/services/ProcessManager.ts
- packages/code-api/src/ProcessManager.ts
- workflow/tasks/task-004.md

## Success Criteria
- [ ] AgentTracker class created in src/services/
- [ ] Agent execution registration implemented
- [ ] Real-time status updates
- [ ] Zombie process detection
- [ ] Automatic health checking (every 5 minutes)
- [ ] Integration with ProcessManager
- [ ] Auto-cleanup of unresponsive processes

## Description

Create a monitoring system to track all running agent executions and detect issues.

**Note**: This task depends on task-004 (CentralDatabase). Start after task-004 is completed.

### Implementation

1. **AgentTracker Class**
   ```typescript
   class AgentTracker {
     constructor(
       private processManager: ProcessManager,
       private database: CentralDatabase
     )

     // Execution tracking
     registerExecution(sessionId: string, metadata: ExecutionMetadata): void
     updateStatus(sessionId: string, status: ExecutionStatus): void
     unregisterExecution(sessionId: string): void

     // Monitoring
     getActiveExecutions(): ExecutionInfo[]
     getZombieProcesses(): ExecutionInfo[]

     // Health checking
     startHealthCheck(interval: number = 300000): void // 5 minutes
     stopHealthCheck(): void
     checkExecution(sessionId: string): HealthStatus
   }
   ```

2. **Tracked Information**
   ```typescript
   interface TrackedExecution {
     sessionId: string;
     pid: number;
     projectPath: string;
     agentName: string;
     taskId?: string;
     startTime: number;
     lastHeartbeat: number;
     status: 'running' | 'zombie' | 'completed' | 'failed';
   }
   ```

3. **Zombie Detection**
   - No heartbeat for > 10 minutes
   - Process exists but not responding
   - Execution marked as running but process dead

4. **Health Check Actions**
   - Verify process is still alive
   - Check for output activity
   - Update lastHeartbeat
   - Mark zombies for cleanup
   - Send notifications for long-running tasks

5. **Integration**
   - Hook into ProcessManager events
   - Report to CentralDatabase
   - Expose IPC endpoints for UI
   - Integrate with WorkflowEngine

This enables proactive monitoring and automatic recovery of stuck executions.
