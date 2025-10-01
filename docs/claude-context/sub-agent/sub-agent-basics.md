# Sub-Agent Basics

## What are Sub-Agents

Sub-agents are specialized AI assistants defined as Markdown files with YAML frontmatter. Each sub-agent has a focused responsibility, specific tool access, and tailored instructions.

## File Structure

```yaml
---
name: agent-name
description: Brief description of agent purpose
allowedTools: [Bash, Read, Write, Edit, Grep]
permissions:
  allowList:
    - "read:src/**"
    - "write:dist/**"
  denyList:
    - "write:src/critical/**"
---

# Agent Instructions

## Role
[Define the agent's role and expertise]

## Responsibilities
[List specific tasks the agent handles]

## Constraints
[Define what the agent should not do]

## Output Format
[Specify expected output structure]

Your detailed prompt instructions here...
```

## Storage Locations

### User Level
```
~/.claude/agents/
```

Personal agents available across all projects for the current user.

### Project Level
```
.claude/agents/
```

Project-specific agents shared with team via source control.

## Key Components

### Frontmatter Fields

#### Required Fields

**name** (string)
```yaml
name: code-reviewer
```
Unique identifier used to invoke the agent.

**description** (string)
```yaml
description: Reviews code for security, performance, and best practices
```
Brief summary shown in agent listings.

#### Optional Fields

**allowedTools** (array)
```yaml
allowedTools: [Read, Grep, Bash]
```
Whitelist of tools the agent can use. Restricts agent capabilities to only necessary tools.

**permissions** (object)
```yaml
permissions:
  allowList:
    - "read:**/*.ts"
    - "write:docs/**"
  denyList:
    - "write:src/**"
```
Fine-grained file access control with glob patterns.

### Prompt Body

The markdown content after frontmatter defines agent behavior:

```markdown
# Security Reviewer Agent

## Role
Expert security reviewer specializing in vulnerability detection.

## Process
1. Scan code for common vulnerabilities
2. Check authentication and authorization
3. Review data validation
4. Identify injection risks

## Output Format
- **Critical**: Issues requiring immediate attention
- **High**: Important security concerns
- **Medium**: Potential improvements
- **Low**: Minor suggestions
```

## Invoking Sub-Agents

### From CLI
```bash
claude --agent code-reviewer "Review authentication module"
```

### From Interactive Session
```
/agent code-reviewer Review the login handler
```

### Programmatically
```bash
claude -p "Review security" --agent security-auditor --output-format json
```