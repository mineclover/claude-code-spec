# Hook Overview

## What Are Hooks?

Hooks execute custom shell commands at specific points during Claude Code operations, enabling event-driven automation and deterministic control over AI workflows.

## How Hooks Work

### Execution Flow
```
User Action → Hook Trigger → Shell Command → Hook Response → Claude Processing
```

### Hook Lifecycle
1. **Trigger**: Event occurs (tool use, prompt submit, etc.)
2. **Match**: Hook matcher evaluates if hook should run
3. **Execute**: Shell command runs with context input
4. **Response**: Hook returns JSON with decision/context
5. **Action**: Claude respects hook decision (allow/block/modify)

## Key Capabilities

### Deterministic Control
Hooks provide programmatic governance independent of AI reasoning.

**Example:**
```json
{
  "decision": "block",
  "reason": "Command contains destructive rm -rf pattern"
}
```

### Context Modification
Add information to Claude's context dynamically.

**Example:**
```json
{
  "hookSpecificOutput": {
    "additionalContext": "Current git branch: main"
  }
}
```

### Validation and Filtering
Inspect and validate operations before execution.

**Use Cases:**
- Block dangerous commands
- Validate file paths
- Check test results
- Enforce coding standards

## Hook Benefits

### Security
- Block dangerous operations
- Validate inputs before execution
- Filter sensitive data
- Enforce security policies

### Automation
- Automatic git operations
- File system synchronization
- Notification triggers
- Logging and auditing

### Workflow Integration
- CI/CD pipeline hooks
- Database migrations
- Deployment automation
- Testing workflows

## Configuration Location

Hooks are configured in settings files:

**User-level:**
```
~/.claude/settings.json
```

**Project-level:**
```
./.claude/settings.json
```

**Precedence:** Project settings override user settings.

## Security Considerations

### Important Warnings
⚠️ Hooks execute arbitrary shell commands with your user permissions
⚠️ Validate and sanitize all inputs in hook scripts
⚠️ Use absolute paths to prevent command injection
⚠️ Review hook configurations regularly

### Best Practices
- Use dedicated hook scripts, not inline commands
- Implement proper error handling
- Log hook executions for audit trails
- Test hooks thoroughly before deployment
- Limit hook command permissions

## Environment Variables

Hooks receive context through environment variables:

**Available Variables:**
- `CLAUDE_PROJECT_DIR` - Current project directory
- `CLAUDE_TOOL_NAME` - Tool being executed (for tool hooks)
- `CLAUDE_HOOK_INPUT` - JSON input with tool/prompt context

## Use Cases

### Development
- Auto-format code on Write/Edit
- Run linters before commits
- Update dependencies automatically
- Generate documentation

### Testing
- Run tests after code changes
- Validate test coverage
- Check for breaking changes
- Verify build success

### Git Operations
- Auto-commit on file changes
- Create feature branches
- Push to remote automatically
- Generate commit messages

### Monitoring
- Log all tool usage
- Track token consumption
- Monitor command execution
- Alert on errors

### Validation
- Check file permissions
- Validate JSON/YAML syntax
- Enforce naming conventions
- Verify API endpoints