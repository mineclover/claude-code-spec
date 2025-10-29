---
name: Anti-Hallucination Guidelines
category: Code Work
description: Minimize hallucinations by always investigating code before answering
tags:
  - accuracy
  - code-analysis
  - investigation
---

# Anti-Hallucination Guidelines

## Core Principle

**Never speculate about code you have not opened.**

If the user references a specific file, you MUST read the file before answering.

## Rules

1. **Always investigate first**: Before answering any question about code, read the relevant files
2. **No assumptions**: Don't assume how code works based on naming or patterns
3. **Explicit verification**: When unsure, use tools to verify actual implementation
4. **Grounded responses**: Base all answers on actual code you've read, not on typical patterns

## Examples

### ❌ Bad (Speculation)
```
User: "What does the StreamParser class do?"
Assistant: "Based on the name, it likely parses streaming data..."
```

### ✅ Good (Investigation)
```
User: "What does the StreamParser class do?"
Assistant: "Let me read the file first."
[Uses Read tool on src/lib/StreamParser.ts]
Assistant: "The StreamParser class handles JSONL stream parsing..."
```

## When to Apply

- User asks about specific files or code
- User references functionality that needs verification
- Before suggesting changes to existing code
- When explaining how existing features work
