---
id: task-003
title: Add Task completion auto-detection from execution sessions
area: Backend/Process
assigned_agent: claude-sonnet-4
reviewer: claude-opus-4
status: completed
created: 2025-11-23T22:30:00Z
updated: 2025-11-24T15:45:00Z
---

## References
- src/services/TaskLifecycleManager.ts
- src/services/SessionManager.ts
- src/lib/StreamParser.ts
- packages/code-api/src/parser/types.ts

## Success Criteria
- [x] SessionAnalyzer class created
- [x] Success criteria parser implemented
- [x] Execution result analyzer implemented
- [x] Auto-completion logic integrated
- [x] Task status auto-update on success
- [x] Review notes auto-generation
- [ ] Unit tests for analyzer

## Description

Implement automatic task completion detection by analyzing execution session results.

### Implementation

1. **SessionAnalyzer**
   ```typescript
   class SessionAnalyzer {
     analyzeCompletion(sessionId: string, task: Task): {
       completed: boolean;
       matchedCriteria: string[];
       failedCriteria: string[];
       confidence: number;
     }
   }
   ```

2. **Success Criteria Matching**
   - Parse task success criteria checkboxes
   - Analyze session tool calls and outputs
   - Match criteria patterns in execution results
   - Calculate completion confidence score

3. **Auto-Completion Flow**
   - On execution complete event
   - Load associated task
   - Analyze session against success criteria
   - If confidence > 80%, mark task as completed
   - Generate review notes with matched criteria
   - Trigger next task selection

4. **Review Notes Generation**
   ```markdown
   ## Auto-Completion Analysis
   - Matched: [criterion 1, criterion 2]
   - Confidence: 85%
   - Execution time: 5m 32s
   - Session: session-abc123
   ```

This enables truly autonomous task execution where completed work is automatically detected and the loop continues.
