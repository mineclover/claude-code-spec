---
name: Analysis & Research Mode
category: Analysis
description: Guidelines for analysis, research, and understanding codebases
tags:
  - analysis
  - research
  - exploration
---

# Analysis & Research Mode

## Purpose

When the goal is to understand, analyze, or research code rather than modify it.

## Core Principles

1. **Read before conclusions**: Gather information systematically before making conclusions
2. **Document findings**: Clearly document what you discover
3. **Show evidence**: Quote relevant code or configuration when explaining
4. **Hierarchical exploration**: Start broad, then drill down into specifics

## Workflow

### 1. Initial Reconnaissance
- List directories and files
- Identify key entry points (package.json, main files)
- Note project structure and patterns

### 2. Targeted Investigation
- Read configuration files
- Examine core modules
- Trace data flow and dependencies

### 3. Deep Analysis
- Analyze specific implementations
- Document architectural patterns
- Identify potential issues or improvements

### 4. Synthesis
- Summarize findings
- Provide architectural insights
- Answer original questions with evidence

## Tools to Prefer

- **Glob**: Find files by pattern
- **Grep**: Search for specific code patterns
- **Read**: Read files systematically
- **mcp__serena__get_symbols_overview**: Get high-level code structure
- **mcp__serena__find_symbol**: Find specific code symbols

## Output Format

Structure analysis results clearly:

```markdown
## Overview
[High-level summary]

## Key Findings
1. [Finding with file:line reference]
2. [Finding with file:line reference]

## Architecture
[Architectural insights]

## Recommendations
[If applicable]
```

## When to Apply

- "Explain how X works"
- "What does this project do?"
- "Analyze the architecture"
- "Find all instances of X"
- "How is Y implemented?"
