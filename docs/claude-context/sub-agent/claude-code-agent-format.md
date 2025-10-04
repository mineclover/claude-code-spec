# Claude Code Agent Format Guide

## Overview

This guide documents the **exact format** required for agents to be recognized by Claude Code. This format differs from custom agent management systems and must be followed precisely for compatibility.

## Critical Requirements

### ✅ Supported Frontmatter Fields

Claude Code supports **only 4 frontmatter fields**:

```yaml
---
name: agent-name              # Required
description: description text # Required
tools: Tool1, Tool2, Tool3   # Optional (comma-separated)
model: sonnet                # Optional (sonnet, opus, haiku)
---
```

**Optional undocumented field:**
```yaml
color: purple  # UI hint (values: purple, blue, green, red, etc.)
```

### ❌ Unsupported Fields

These fields will **prevent agent recognition**:

- ❌ `allowedTools` (YAML array format)
- ❌ `permissions` (any format)
- ❌ Custom metadata fields

## Detailed Field Specifications

### 1. name (Required)

**Format:** Lowercase letters and hyphens only

```yaml
# ✅ Correct
name: code-reviewer
name: task-creator
name: api-designer

# ❌ Incorrect
name: CodeReviewer    # No camelCase
name: code_reviewer   # No underscores
name: code reviewer   # No spaces
```

### 2. description (Required)

**Format:** Natural language description with clear trigger conditions

**Best Practices:**
- Include "Use when" or "Use this agent when" to define triggers
- Use English (Korean or other languages may cause issues)
- Can be multiple lines or include examples
- Be specific about the agent's purpose

```yaml
# ✅ Good - Clear triggers
description: Expert code review specialist. Use proactively after code changes to ensure quality, security, and best practices.

# ✅ Excellent - With examples
description: Use this agent when the user needs help creating or designing new agent configurations, wants to see examples of well-structured agents, needs guidance on agent architecture patterns, or asks for samples/templates for agent creation.

# ⚠️ Acceptable but not ideal
description: 프로젝트 분석 후 구조화된 Task를 생성하는 전문 Agent

# ❌ Too vague
description: Helps with code
```

### 3. tools (Optional)

**Format:** Comma-separated list of tool names

```yaml
# ✅ Correct - Comma-separated
tools: Read, Write, Grep, Bash, Edit

# ✅ Correct - Long list on one line
tools: Glob, Grep, Read, WebFetch, TodoWrite, WebSearch, mcp__serena__list_dir, mcp__serena__find_file

# ❌ Incorrect - YAML array format
tools:
  - Read
  - Write
  - Grep

# ❌ Incorrect - Different field name
allowedTools: [Read, Write]
```

**Available Tools:**
- Built-in: `Bash`, `Read`, `Write`, `Edit`, `Grep`, `Glob`, `WebFetch`, `WebSearch`, `TodoWrite`
- MCP tools: Any tool from configured MCP servers (e.g., `mcp__serena__list_dir`)

**Note:** If `tools` field is omitted, agent inherits all available tools.

### 4. model (Optional)

**Format:** Model alias

```yaml
# ✅ Correct
model: sonnet  # Default and recommended
model: opus    # More powerful but slower
model: haiku   # Faster but less capable

# ❌ Incorrect
model: claude-sonnet-4
model: inherit
```

**Default:** If omitted, defaults to the configured subagent model (typically `sonnet`)

### 5. color (Optional, Undocumented)

**Format:** Color name

```yaml
color: purple
color: blue
color: green
color: red
```

**Purpose:** UI hint for agent identification in Claude Code interface

## Complete Example

### Minimal Agent

```yaml
---
name: code-reviewer
description: Reviews code for quality, security, and best practices. Use after making code changes.
---

You are an expert code reviewer specializing in security and performance.

## Your Role
Review code changes and provide actionable feedback on:
- Security vulnerabilities
- Performance issues
- Code quality and maintainability
- Best practices compliance
```

### Full-Featured Agent

```yaml
---
name: task-creator
description: Expert task creation specialist. Analyzes projects to create structured tasks in .claude/tasks. Use when user requests task creation or project analysis documentation.
tools: Read, Grep, Glob, mcp__serena__list_dir, mcp__serena__find_file, mcp__serena__search_for_pattern, mcp__serena__get_symbols_overview, mcp__serena__find_symbol, Write
model: sonnet
color: blue
---

# Task Creator Agent

You are a project analysis expert specializing in creating structured task documentation.

## Capabilities
- Analyze project structure and architecture
- Identify implementation requirements
- Create well-defined tasks with clear objectives
- Document dependencies and acceptance criteria

## Process
1. Explore codebase using serena tools
2. Identify architectural patterns
3. Define task scope and requirements
4. Create task file in .claude/tasks/

## Output Format
Generate tasks as Markdown files with:
- Clear title and description
- Work area assignment
- Success criteria
- Implementation notes
```

## File Location

### Project-Level Agents
```
.claude/agents/agent-name.md
```

Shared with team via Git. Automatically detected by Claude Code when in project directory.

### User-Level Agents
```
~/.claude/agents/agent-name.md
```

Personal agents available across all projects.

## Agent Discovery

**Important:** Claude Code caches agent configurations. After creating or modifying agents:

1. **Reload:** Restart Claude Code or reload the window
2. **Verify:** Run `claude -p "/agents"` to list available agents
3. **Test:** Try invoking the agent with a relevant query

## Common Issues

### Agent Not Recognized

**Symptoms:** Agent doesn't appear in `/agents` list

**Causes:**
- ✅ Check: Using `tools:` instead of `allowedTools:`
- ✅ Check: No `permissions:` field in frontmatter
- ✅ Check: Description is in English
- ✅ Check: `name` uses lowercase and hyphens only
- ✅ Check: File is in `.claude/agents/` directory
- ✅ Check: Restart Claude Code after changes

**Solution:** Follow the exact format above and restart Claude Code

### Agent Triggers Incorrectly

**Cause:** Vague or missing trigger conditions in description

**Solution:** Add explicit "Use when" conditions in description:
```yaml
description: Use this agent when the user requests X, asks about Y, or needs help with Z.
```

## Migration from Custom Format

If you have agents with custom fields, convert them:

### Before (Custom Format)
```yaml
---
name: code-reviewer
description: Reviews code
allowedTools:
  - Read
  - Grep
permissions:
  allowList:
    - "read:**"
  denyList:
    - "read:.env"
---
```

### After (Claude Code Compatible)
```yaml
---
name: code-reviewer
description: Expert code reviewer. Use after making code changes to ensure quality and security.
tools: Read, Grep
model: sonnet
---

## Permissions Guidelines
This agent should:
- ✅ Read all project files except .env and credentials
- ❌ Not write to source files
```

**Key Changes:**
1. `allowedTools:` YAML array → `tools:` comma-separated
2. `permissions:` → Move to body as documentation
3. Add `model:` field
4. Enhance `description` with trigger conditions

## Best Practices

### 1. Clear Naming
- Use descriptive, action-oriented names
- Example: `code-reviewer`, `task-creator`, `api-designer`

### 2. Detailed Descriptions
- Include "Use when" triggers
- Be specific about agent capabilities
- Consider adding examples in description

### 3. Tool Restriction
- Only include necessary tools
- Improves security and focus
- Example: Documentation agent doesn't need `Bash`

### 4. Model Selection
- `sonnet`: Default, good balance
- `opus`: Complex reasoning tasks
- `haiku`: Fast, simple tasks

### 5. Structured Prompts
- Define clear role and responsibilities
- Specify process/workflow
- Include output format expectations
- Add constraints and guidelines

## Reference

Official Documentation:
- https://docs.claude.com/en/docs/claude-code/sub-agents

Community Examples:
- https://github.com/wshobson/agents
- https://github.com/VoltAgent/awesome-claude-code-subagents
