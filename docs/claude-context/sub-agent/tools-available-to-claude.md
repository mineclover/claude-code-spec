# Tools Available to Claude

> Reference: https://docs.claude.com/en/docs/claude-code/settings#tools-available-to-claude

## Overview
Claude has access to various tools that enable interaction with the file system, execution of commands, and more. Understanding available tools is crucial for writing effective sub agent prompts.

## Core Tools

### File Operations
- **Read** - Read file contents
- **Write** - Create or overwrite files
- **Edit** - Make targeted edits to existing files
- **Glob** - Find files matching patterns

### Code Navigation
- **Grep** - Search file contents using regex
- **Symbol navigation** - Navigate code structures

### Execution
- **Bash** - Execute shell commands
- **Task** - Launch sub agents for complex tasks

### Web & External
- **WebFetch** - Fetch and process web content
- **WebSearch** - Search the web for information

### Development
- **Git operations** - Version control commands
- **Package managers** - npm, pip, etc.

## Usage in Sub Agent Prompts

When writing sub agent prompts, specify which tools the agent should prioritize:

```markdown
Example: "Use the Grep tool to search for all instances of X, then use Edit to modify them."
```

## Tool Selection Guidelines
- Use specialized tools over bash commands when possible
- Batch independent tool calls for performance
- Consider tool output size and token usage