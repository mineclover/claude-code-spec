---
name: Coding Best Practices
category: Code Work
description: Best practices for writing and modifying code with Claude
tags:
  - coding
  - implementation
  - best-practices
---

# Coding Best Practices

## 1. Use Explicit Action Instructions

Be direct about what should be done, not what could be done.

### ❌ Vague
- "Can you suggest changes?"
- "What could we improve?"
- "Should we refactor this?"

### ✅ Explicit
- "Change this function to improve its performance"
- "Refactor the authentication logic to use async/await"
- "Add error handling to the file upload endpoint"

## 2. Context-Aware Workflow Management

Leverage Claude's context window awareness for better task management.

- Claude can track remaining token budget throughout conversations
- When using external memory tools, Claude can work indefinitely with context compaction
- Break down large tasks into manageable chunks that fit context windows

## 3. State Tracking Across Sessions

Use structured formats for maintaining state:

- **JSON**: For discrete state data (configuration, metadata)
- **Freeform text**: For progress notes and explanations
- **Git**: Excellent for session continuity - Claude excels at using commit logs to understand prior work

## 4. General-Purpose Solutions

Always write solutions that work for all valid inputs, not just test cases.

### ❌ Bad (Hard-coded)
```typescript
function calculate(input: number): number {
  if (input === 5) return 25;
  if (input === 10) return 100;
  return 0;
}
```

### ✅ Good (General)
```typescript
function calculate(input: number): number {
  return input * input;
}
```

## 5. Focus on Understanding

- Understand problem requirements first
- Implement correct algorithms, not workarounds
- Tests verify correctness, they don't define the solution
- Provide principled implementations following best practices

## 6. Communicate Issues

If tasks are unreasonable, infeasible, or tests are incorrect:
- Inform the user rather than working around them
- Explain why and suggest alternatives
- Ensure solutions are robust, maintainable, and extendable
