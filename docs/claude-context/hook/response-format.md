# Hook Response Format

## Response Structure

### Basic JSON Format
Hooks return JSON to communicate with Claude Code.

```json
{
  "decision": "block" | "allow" | undefined,
  "reason": "Human-readable explanation",
  "hookSpecificOutput": {
    "key": "value"
  }
}
```

### Response Fields

#### decision (optional)
Controls whether the operation proceeds.

**Values:**
- `"allow"` - Explicitly allow operation (default if omitted)
- `"block"` - Prevent operation from executing
- `undefined` - No decision (allow by default)

**Applicable To:**
- PreToolUse
- UserPromptSubmit
- Stop
- SubagentStop

**Example:**
```json
{
  "decision": "block"
}
```

#### reason (optional)
Explanation for the decision, shown to user.

**Purpose:**
- Inform user why operation was blocked
- Provide guidance on how to proceed
- Log decision rationale

**Example:**
```json
{
  "decision": "block",
  "reason": "Command contains dangerous rm -rf pattern"
}
```

**Best Practices:**
- Be specific and actionable
- Include what to fix
- Avoid technical jargon for user-facing messages
- Include context for debugging

#### hookSpecificOutput (optional)
Hook-specific data structure for context injection.

**Purpose:**
- Add information to Claude's context
- Pass data between hooks
- Provide additional context for decisions

**Structure:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "Dynamic context to inject",
    "metadata": {
      "key": "value"
    }
  }
}
```

## Decision Behavior

### Allow Operations

**Explicit Allow:**
```json
{
  "decision": "allow"
}
```

**Implicit Allow (empty response):**
```json
{}
```

**Allow with Context:**
```json
{
  "decision": "allow",
  "hookSpecificOutput": {
    "additionalContext": "Operation validated successfully"
  }
}
```

### Block Operations

**Block with Reason:**
```json
{
  "decision": "block",
  "reason": "File path outside project directory"
}
```

**Block with Details:**
```json
{
  "decision": "block",
  "reason": "Security validation failed: command includes sudo",
  "hookSpecificOutput": {
    "violationType": "dangerous_command",
    "pattern": "sudo",
    "suggestion": "Remove sudo and retry"
  }
}
```

**Important:** When blocking, the operation is canceled and the reason is shown to the user.

## Context Injection

### UserPromptSubmit Context
Add context before Claude processes prompt.

```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "Current git branch: feature/auth\nUnstaged files: 3"
  }
}
```

**Use Cases:**
- Git status
- Environment info
- Project metadata
- Current timestamp

### PostToolUse Context
Add context after tool execution.

```json
{
  "hookSpecificOutput": {
    "additionalContext": "File written and indexed in database"
  }
}
```

**Use Cases:**
- Confirmation messages
- Result summaries
- Follow-up actions taken
- State changes

### SessionStart Context
Initialize session with context.

```json
{
  "hookSpecificOutput": {
    "additionalContext": "Project: MyApp\nNode version: v20.0.0\nBranch: main"
  }
}
```

**Use Cases:**
- Environment versions
- Project configuration
- Active services
- Prerequisites status

## Response Examples

### Security Validation

**Block dangerous command:**
```json
{
  "decision": "block",
  "reason": "Command contains 'rm -rf' which could delete important files"
}
```

### Path Validation

**Block invalid path:**
```json
{
  "decision": "block",
  "reason": "File path '/etc/passwd' is outside project directory",
  "hookSpecificOutput": {
    "allowedPath": "/home/user/project",
    "requestedPath": "/etc/passwd"
  }
}
```

### Test Validation

**Block on test failure:**
```json
{
  "decision": "block",
  "reason": "Tests must pass before completing. 3 tests failed.",
  "hookSpecificOutput": {
    "testResults": {
      "passed": 45,
      "failed": 3,
      "failedTests": ["auth.test.js", "api.test.js"]
    }
  }
}
```

### Success with Context

**Allow with metadata:**
```json
{
  "decision": "allow",
  "hookSpecificOutput": {
    "additionalContext": "Code formatted with Prettier",
    "filesFormatted": 5
  }
}
```

## Hook Script Examples

### Bash Script Response

```bash
#!/bin/bash
# validate-bash.sh

COMMAND=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolInput.command')

# Check for dangerous patterns
if echo "$COMMAND" | grep -qE "rm .* -(r|f)"; then
  echo '{
    "decision": "block",
    "reason": "Dangerous rm command detected"
  }'
  exit 0
fi

# Allow command
echo '{
  "decision": "allow"
}'
```

### Python Script Response

```python
#!/usr/bin/env python3
# validate-write.py

import json
import sys
import os

# Read hook input
hook_input = json.loads(os.environ.get('CLAUDE_HOOK_INPUT', '{}'))
file_path = hook_input.get('toolInput', {}).get('file_path', '')

# Validate path
project_dir = os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())
if not file_path.startswith(project_dir):
    response = {
        "decision": "block",
        "reason": f"File path must be inside project directory: {project_dir}"
    }
else:
    response = {
        "decision": "allow",
        "hookSpecificOutput": {
            "additionalContext": "File path validated"
        }
    }

print(json.dumps(response))
```

### Node.js Script Response

```javascript
#!/usr/bin/env node
// add-git-context.js

const { execSync } = require('child_process');

try {
  const gitStatus = execSync('git status --short', { encoding: 'utf8' });
  const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();

  const response = {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: `Git Branch: ${branch}\nGit Status:\n${gitStatus}`
    }
  };

  console.log(JSON.stringify(response));
} catch (error) {
  // If git commands fail, allow without context
  console.log('{}');
}
```

## Error Handling

### Script Errors
If a hook script errors, Claude Code logs the error and continues.

**Best Practice:**
- Always exit with code 0
- Return valid JSON or empty object
- Handle errors gracefully
- Log errors to separate file

**Example Error Handling:**
```bash
#!/bin/bash
set -e

{
  # Try operation
  result=$(do_something)
  echo '{"decision":"allow"}'
} || {
  # On error, log and allow
  echo "Hook error: $?" >> /tmp/hook-errors.log
  echo '{}'
}
```

### Invalid JSON
If hook returns invalid JSON, Claude Code treats it as empty response (allow).

**Debugging:**
```bash
# Test hook script directly
/path/to/hook-script.sh | jq .
```

### Timeout
Hooks should complete quickly (< 5 seconds recommended).

**For slow operations:**
- Run in background
- Return immediately
- Store results for next hook