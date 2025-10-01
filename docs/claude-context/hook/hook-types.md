# Hook Types

## Tool Lifecycle Hooks

### PreToolUse
Runs before a tool executes.

**Purpose:**
- Validate tool parameters
- Block dangerous operations
- Add context before execution

**Input Context:**
```json
{
  "toolName": "Write",
  "toolInput": {
    "file_path": "/path/to/file.txt",
    "content": "file content"
  }
}
```

**Response Options:**
```json
{
  "decision": "block",
  "reason": "File path not allowed"
}
```

**Use Cases:**
- Security validation
- Parameter checking
- Permission verification
- Path whitelisting

**Example Configuration:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/validate-write.sh"
          }
        ]
      }
    ]
  }
}
```

### PostToolUse
Runs after a tool completes successfully.

**Purpose:**
- Process tool results
- Trigger follow-up actions
- Validate outcomes
- Update external systems

**Input Context:**
```json
{
  "toolName": "Write",
  "toolInput": { /* original input */ },
  "toolOutput": { /* tool result */ }
}
```

**Response Options:**
```json
{
  "hookSpecificOutput": {
    "additionalContext": "File written and indexed"
  }
}
```

**Use Cases:**
- Auto-commit file changes
- Run formatters/linters
- Update indexes
- Sync with external services

**Example Configuration:**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "git add ."
          }
        ]
      }
    ]
  }
}
```

### Notification
Triggered for tool permission requests or idle periods.

**Purpose:**
- Handle permission dialogs
- Idle timeout actions
- User notifications

**Input Context:**
```json
{
  "notificationType": "permission_request",
  "toolName": "Bash",
  "message": "Claude wants to run a bash command"
}
```

**Use Cases:**
- Auto-approve safe tools
- Send alerts for specific operations
- Log permission requests
- Implement custom permission logic

## Prompt Lifecycle Hooks

### UserPromptSubmit
Runs when user submits a prompt, before Claude processes it.

**Purpose:**
- Add contextual information
- Validate prompts
- Block certain queries
- Inject dynamic context

**Input Context:**
```json
{
  "prompt": "user's submitted prompt",
  "conversationHistory": [ /* previous messages */ ]
}
```

**Response Options:**
```json
{
  "decision": "block",
  "reason": "Prompt violates policy",
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "Current timestamp: 2025-01-15"
  }
}
```

**Use Cases:**
- Add git status to context
- Inject environment info
- Filter inappropriate prompts
- Add project metadata

**Example:**
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "git status --short | jq -Rs '{additionalContext: .}'"
          }
        ]
      }
    ]
  }
}
```

## Completion Hooks

### Stop
Runs when the main agent finishes responding to a user prompt.

**Purpose:**
- Validate completion state
- Require verification steps
- Block if criteria not met
- Trigger post-completion actions

**Input Context:**
```json
{
  "responseComplete": true,
  "conversationState": { /* current state */ }
}
```

**Response Options:**
```json
{
  "decision": "block",
  "reason": "Tests must pass before completion"
}
```

**Use Cases:**
- Ensure tests pass
- Verify build success
- Check code quality
- Require documentation updates

**Example:**
```bash
#!/bin/bash
# stop-hook.sh
npm test > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo '{"decision":"block","reason":"Tests are failing"}'
else
  echo '{"decision":"allow"}'
fi
```

### SubagentStop
Runs when a subagent completes its task.

**Purpose:**
- Validate subagent results
- Process subagent output
- Chain subagent tasks
- Log subagent activity

**Input Context:**
```json
{
  "subagentName": "code-reviewer",
  "subagentOutput": { /* result from subagent */ }
}
```

**Use Cases:**
- Verify subagent completion
- Aggregate subagent results
- Trigger dependent subagents
- Validate quality gates

## Session Lifecycle Hooks

### SessionStart
Runs when a Claude Code session initializes.

**Purpose:**
- Initialize session context
- Set up environment
- Load configuration
- Validate prerequisites

**Input Context:**
```json
{
  "sessionId": "uuid",
  "projectDir": "/path/to/project"
}
```

**Response Options:**
```json
{
  "hookSpecificOutput": {
    "additionalContext": "Session initialized with node v20.0.0"
  }
}
```

**Use Cases:**
- Check environment setup
- Load project metadata
- Verify dependencies
- Initialize logging

**Example:**
```bash
#!/bin/bash
# session-start.sh
node --version > /tmp/node-version
git branch --show-current > /tmp/current-branch
echo '{"additionalContext":"Session started"}'
```

### SessionEnd
Runs when a session terminates.

**Purpose:**
- Clean up resources
- Save session state
- Generate reports
- Archive logs

**Input Context:**
```json
{
  "sessionId": "uuid",
  "sessionDuration": 3600
}
```

**Use Cases:**
- Archive session logs
- Clean temporary files
- Generate usage reports
- Update project metadata

## Context Management Hooks

### PreCompact
Runs before Claude compacts conversation context.

**Purpose:**
- Save important context
- Log conversation state
- Backup before compression
- Inject pre-compaction metadata

**Input Context:**
```json
{
  "contextSize": 150000,
  "compactionReason": "approaching token limit"
}
```

**Use Cases:**
- Archive full conversation
- Save critical decisions
- Log before context loss
- Preserve key information

**Example:**
```bash
#!/bin/bash
# pre-compact.sh
# Save current context to file
cat "$CLAUDE_HOOK_INPUT" > "/tmp/context-backup-$(date +%s).json"
echo '{"additionalContext":"Context backed up before compaction"}'
```

## Hook Type Summary

| Hook Type | When It Runs | Can Block | Primary Use Case |
|-----------|--------------|-----------|------------------|
| PreToolUse | Before tool execution | Yes | Validation, security |
| PostToolUse | After tool success | No | Automation, follow-up |
| Notification | Permission/idle events | No | Alerts, logging |
| UserPromptSubmit | Before prompt processing | Yes | Context injection |
| Stop | Agent response complete | Yes | Completion validation |
| SubagentStop | Subagent task done | Yes | Subagent orchestration |
| SessionStart | Session initialization | No | Setup, initialization |
| SessionEnd | Session termination | No | Cleanup, reporting |
| PreCompact | Before context compaction | No | Context preservation |