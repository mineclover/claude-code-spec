---
id: task-004
title: Implement CentralDatabase for unified data storage
area: Backend/Process
assigned_agent: claude-sonnet-4
reviewer: claude-opus-4
status: completed
created: 2025-11-24T15:50:00Z
updated: 2025-11-24T16:30:00Z
---

## References
- docs/standards/role-definitions.md (CentralDatabase section)
- docs/standards/data-models.md
- src/services/TaskLifecycleManager.ts

## Success Criteria
- [x] CentralDatabase class created in src/services/
- [x] Project state storage/retrieval implemented
- [x] Report archiving system implemented
- [x] Agent execution history management
- [x] System metrics aggregation
- [x] Data stored in ~/.claude/central-management/
- [x] Transaction safety with file locking
- [x] Daily report archiving functionality

## Description

Create a unified data storage system for managing all project data centrally.

### Implementation

1. **CentralDatabase Class**
   ```typescript
   class CentralDatabase {
     constructor(baseDir: string = '~/.claude/central-management')

     // Project management
     saveProjectState(projectPath: string, state: ProjectState): Promise<void>
     getProjectState(projectPath: string): Promise<ProjectState | null>
     listProjects(): Promise<ProjectInfo[]>

     // Report management
     saveReport(report: Report): Promise<void>
     getReports(filters: ReportFilter): Promise<Report[]>
     archiveOldReports(beforeDate: Date): Promise<void>

     // Execution history
     saveExecution(execution: ExecutionRecord): Promise<void>
     getExecutionHistory(projectPath: string): Promise<ExecutionRecord[]>

     // Metrics
     aggregateMetrics(timeRange: TimeRange): Promise<SystemMetrics>
   }
   ```

2. **Data Structure**
   ```
   ~/.claude/central-management/
   ├── projects/
   │   ├── {project-hash}/
   │   │   ├── state.json
   │   │   ├── tasks.json
   │   │   └── agents.json
   ├── reports/
   │   ├── 2025-11-24.json
   │   └── archives/
   │       └── 2025-11.json.gz
   ├── executions/
   │   └── {project-hash}/
   │       └── {session-id}.json
   └── metrics/
       └── aggregated.json
   ```

3. **Safety Features**
   - File locking for concurrent access
   - Atomic writes with temp files
   - Error recovery
   - Data validation

4. **Integration Points**
   - TaskLifecycleManager reports task changes
   - AgentPoolManager reports agent activity
   - WorkflowEngine reports execution results

This provides a central source of truth for all project data across the system.
