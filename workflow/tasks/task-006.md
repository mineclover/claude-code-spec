---
id: task-006
title: Create Central Dashboard UI for multi-project monitoring
area: Frontend/Pages
assigned_agent: claude-sonnet-4
reviewer: human:dev@example.com
status: completed
created: 2025-11-24T15:50:00Z
updated: 2025-11-24T17:30:00Z
---

## References
- docs/standards/role-definitions.md
- src/pages/WorkflowPage.tsx
- workflow/tasks/task-004.md
- workflow/tasks/task-005.md

## Success Criteria
- [x] CentralDashboardPage component created
- [x] Display all registered projects
- [x] Show aggregate statistics (tasks, agents, executions)
- [x] Real-time active execution monitoring
- [x] Project health indicators
- [x] Quick navigation to project-specific views
- [x] Responsive grid layout
- [x] Auto-refresh functionality

## Description

Create a central dashboard that provides an overview of all projects managed by the system.

**Note**: This task depends on task-004 (CentralDatabase) and task-005 (AgentTracker). Start after both are completed.

### Features

1. **Projects Overview**
   - Card-based grid layout
   - Project name, path, status
   - Task statistics (pending/in_progress/completed)
   - Active agents count
   - Last activity timestamp
   - Health indicator (green/yellow/red)

2. **System-Wide Statistics**
   - Total projects
   - Total tasks across all projects
   - Active executions
   - Today's completed tasks
   - System resource usage
   - Average task completion time

3. **Active Executions Panel**
   - Live list of running agents
   - Project name, task name, agent name
   - Execution duration
   - Quick actions (view details, kill process)

4. **Project Health**
   ```typescript
   interface ProjectHealth {
     status: 'healthy' | 'warning' | 'error';
     issues: string[];
     recommendations: string[];
   }
   ```

   Health factors:
   - Zombie processes
   - Failed tasks ratio
   - Long-running executions
   - Disk space usage

5. **Navigation**
   - Click project card → Project-specific workflow page
   - Click active execution → Execution detail page
   - Quick filters (all/healthy/issues)

6. **Real-time Updates**
   - Subscribe to CentralDatabase events
   - Update stats every 10 seconds
   - Toast notifications for critical issues

### Layout

```
┌─────────────────────────────────────────────┐
│  Central Dashboard                          │
├─────────────────────────────────────────────┤
│  System Stats Bar                           │
│  [Projects: 5] [Tasks: 32] [Active: 2]     │
├─────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │Project 1│ │Project 2│ │Project 3│      │
│  │● Healthy│ │⚠Warning│ │✗ Error  │      │
│  │15 tasks │ │8 tasks  │ │9 tasks  │      │
│  └─────────┘ └─────────┘ └─────────┘      │
├─────────────────────────────────────────────┤
│  Active Executions                          │
│  • Project 1 - Task ABC - Agent sonnet-4   │
│  • Project 3 - Task XYZ - Agent opus-4     │
└─────────────────────────────────────────────┘
```

This provides a bird's-eye view of all development activity across projects.
