---
id: task-example-with-deps
title: Example Task with Dependencies
area: Test/Demo
assigned_agent: claude-sonnet-4
reviewer: claude-opus-4
status: pending
created: 2025-11-24T12:50:00Z
updated: 2025-11-24T12:50:00Z
dependencies: [task-001, task-002]
---

## References
- workflow/tasks/task-001.md
- workflow/tasks/task-002.md
- docs/LANGGRAPH_ARCHITECTURE.md

## Success Criteria
- [ ] Task can only execute after task-001 and task-002 are completed
- [ ] Dependencies are validated before execution
- [ ] LangGraph correctly builds execution order

## Description

This is an example task demonstrating the dependencies feature.

**Dependencies Format:**
```yaml
dependencies: [task-001, task-002]
```

**How it works:**
1. Task system checks if all dependencies are completed
2. LangGraph builds execution graph based on dependencies
3. Task executes only when all dependencies are satisfied

**Benefits:**
- Sequential task execution
- Automatic dependency resolution
- Parallel execution of independent tasks
- Clear task relationships

## Review Notes
Example task for testing dependencies feature.
