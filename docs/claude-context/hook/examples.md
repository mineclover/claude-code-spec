# Hook Examples

## Security Validation

### Block Dangerous Bash Commands

**Hook Script:** `~/.claude/hooks/validate-bash.sh`
```bash
#!/bin/bash

INPUT=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolInput.command')

# Dangerous patterns
DANGEROUS_PATTERNS=(
  'rm\s+.*-[rf]'
  'sudo\s+rm'
  '>\s*/dev/sd'
  'dd\s+.*of='
  'mkfs\.'
  ':(){.*};:'
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$INPUT" | grep -qE "$pattern"; then
    echo "{
      \"decision\": \"block\",
      \"reason\": \"Dangerous command pattern detected: $pattern\"
    }"
    exit 0
  fi
done

echo '{"decision": "allow"}'
```

**Configuration:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/validate-bash.sh"
          }
        ]
      }
    ]
  }
}
```

### Validate File Paths

**Hook Script:** `~/.claude/hooks/validate-path.sh`
```bash
#!/bin/bash

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
FILE_PATH=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolInput.file_path')

# Resolve to absolute path
ABSOLUTE_PATH=$(realpath -m "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")

# Check if path is inside project
if [[ "$ABSOLUTE_PATH" != "$PROJECT_DIR"* ]]; then
  echo "{
    \"decision\": \"block\",
    \"reason\": \"File path must be inside project directory: $PROJECT_DIR\"
  }"
else
  echo '{"decision": "allow"}'
fi
```

**Configuration:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/validate-path.sh"
          }
        ]
      }
    ]
  }
}
```

## Automation

### Auto-Format on Write

**Hook Script:** `~/.claude/hooks/auto-format.sh`
```bash
#!/bin/bash

FILE_PATH=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolInput.file_path')

# Format based on file type
case "$FILE_PATH" in
  *.js|*.jsx|*.ts|*.tsx)
    prettier --write "$FILE_PATH" 2>/dev/null
    ;;
  *.py)
    black "$FILE_PATH" 2>/dev/null
    ;;
  *.go)
    gofmt -w "$FILE_PATH" 2>/dev/null
    ;;
esac

echo "{
  \"hookSpecificOutput\": {
    \"additionalContext\": \"File formatted with appropriate formatter\"
  }
}"
```

**Configuration:**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/auto-format.sh"
          }
        ]
      }
    ]
  }
}
```

### Auto-Commit Changes

**Hook Script:** `~/.claude/hooks/auto-commit.sh`
```bash
#!/bin/bash

FILE_PATH=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolInput.file_path')
TOOL_NAME=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolName')

# Stage the changed file
git add "$FILE_PATH" 2>/dev/null

# Create commit
git commit -m "Auto-commit: ${TOOL_NAME} on $(basename "$FILE_PATH")" 2>/dev/null

echo "{
  \"hookSpecificOutput\": {
    \"additionalContext\": \"Changes committed to git\"
  }
}"
```

**Configuration:**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/auto-commit.sh"
          }
        ]
      }
    ]
  }
}
```

## Context Injection

### Add Git Status to Prompts

**Hook Script:** `~/.claude/hooks/add-git-context.sh`
```bash
#!/bin/bash

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Get git information
BRANCH=$(git branch --show-current 2>/dev/null || echo "not a git repo")
STATUS=$(git status --short 2>/dev/null || echo "")
LAST_COMMIT=$(git log -1 --oneline 2>/dev/null || echo "no commits")

CONTEXT="Current Git Context:
Branch: $BRANCH
Last Commit: $LAST_COMMIT"

if [ -n "$STATUS" ]; then
  CONTEXT="$CONTEXT
Uncommitted Changes:
$STATUS"
fi

echo "{
  \"hookSpecificOutput\": {
    \"hookEventName\": \"UserPromptSubmit\",
    \"additionalContext\": $(echo "$CONTEXT" | jq -Rs .)
  }
}"
```

**Configuration:**
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/add-git-context.sh"
          }
        ]
      }
    ]
  }
}
```

### Add Environment Information

**Hook Script:** `~/.claude/hooks/add-env-context.sh`
```bash
#!/bin/bash

NODE_VERSION=$(node --version 2>/dev/null || echo "not installed")
NPM_VERSION=$(npm --version 2>/dev/null || echo "not installed")
PYTHON_VERSION=$(python --version 2>&1 | cut -d' ' -f2 || echo "not installed")

CONTEXT="Development Environment:
Node: $NODE_VERSION
NPM: $NPM_VERSION
Python: $PYTHON_VERSION
OS: $(uname -s)
Working Directory: $CLAUDE_PROJECT_DIR"

echo "{
  \"hookSpecificOutput\": {
    \"additionalContext\": $(echo "$CONTEXT" | jq -Rs .)
  }
}"
```

**Configuration:**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/add-env-context.sh"
          }
        ]
      }
    ]
  }
}
```

## Validation

### Ensure Tests Pass Before Completion

**Hook Script:** `~/.claude/hooks/verify-tests.sh`
```bash
#!/bin/bash

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Run tests
TEST_OUTPUT=$(npm test 2>&1)
TEST_EXIT=$?

if [ $TEST_EXIT -ne 0 ]; then
  # Tests failed
  FAILED_COUNT=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ failing' | cut -d' ' -f1)

  echo "{
    \"decision\": \"block\",
    \"reason\": \"Tests must pass before completion. $FAILED_COUNT test(s) failed.\",
    \"hookSpecificOutput\": {
      \"testOutput\": $(echo "$TEST_OUTPUT" | tail -20 | jq -Rs .)
    }
  }"
else
  # Tests passed
  echo "{
    \"decision\": \"allow\",
    \"hookSpecificOutput\": {
      \"additionalContext\": \"All tests passed successfully\"
    }
  }"
fi
```

**Configuration:**
```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/verify-tests.sh"
          }
        ]
      }
    ]
  }
}
```

### Validate JSON/YAML Syntax

**Hook Script:** `~/.claude/hooks/validate-syntax.sh`
```bash
#!/bin/bash

FILE_PATH=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolInput.file_path')

case "$FILE_PATH" in
  *.json)
    if ! jq empty "$FILE_PATH" 2>/dev/null; then
      ERROR=$(jq empty "$FILE_PATH" 2>&1)
      echo "{
        \"decision\": \"block\",
        \"reason\": \"Invalid JSON syntax: $ERROR\"
      }"
      exit 0
    fi
    ;;
  *.yaml|*.yml)
    if ! python -c "import yaml; yaml.safe_load(open('$FILE_PATH'))" 2>/dev/null; then
      ERROR=$(python -c "import yaml; yaml.safe_load(open('$FILE_PATH'))" 2>&1)
      echo "{
        \"decision\": \"block\",
        \"reason\": \"Invalid YAML syntax: $ERROR\"
      }"
      exit 0
    fi
    ;;
esac

echo '{"decision": "allow"}'
```

**Configuration:**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/validate-syntax.sh"
          }
        ]
      }
    ]
  }
}
```

## Logging and Monitoring

### Log All Tool Usage

**Hook Script:** `~/.claude/hooks/log-tools.sh`
```bash
#!/bin/bash

LOG_FILE="$HOME/.claude/logs/tool-usage.log"
mkdir -p "$(dirname "$LOG_FILE")"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
TOOL_NAME=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolName')
TOOL_INPUT=$(echo "$CLAUDE_HOOK_INPUT" | jq -c '.toolInput')

echo "[$TIMESTAMP] $TOOL_NAME: $TOOL_INPUT" >> "$LOG_FILE"

echo '{}'
```

**Configuration:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/log-tools.sh"
          }
        ]
      }
    ]
  }
}
```

### Track Session Statistics

**Hook Script:** `~/.claude/hooks/session-stats.sh`
```bash
#!/bin/bash

STATS_FILE="$HOME/.claude/logs/session-stats.json"
mkdir -p "$(dirname "$STATS_FILE")"

# Initialize if doesn't exist
if [ ! -f "$STATS_FILE" ]; then
  echo '{"totalSessions": 0, "totalDuration": 0}' > "$STATS_FILE"
fi

# Increment session count
STATS=$(jq '.totalSessions += 1' "$STATS_FILE")
echo "$STATS" > "$STATS_FILE"

SESSION_COUNT=$(echo "$STATS" | jq -r '.totalSessions')

echo "{
  \"hookSpecificOutput\": {
    \"additionalContext\": \"Session #$SESSION_COUNT\"
  }
}"
```

**Configuration:**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/session-stats.sh"
          }
        ]
      }
    ]
  }
}
```

## Integration

### Notify on Specific Operations

**Hook Script:** `~/.claude/hooks/notify.sh`
```bash
#!/bin/bash

TOOL_NAME=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolName')
FILE_PATH=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolInput.file_path // "unknown"')

# Send notification (macOS example)
osascript -e "display notification \"$TOOL_NAME on $FILE_PATH\" with title \"Claude Code\""

# Or use notify-send on Linux
# notify-send "Claude Code" "$TOOL_NAME on $FILE_PATH"

echo '{}'
```

**Configuration:**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/notify.sh"
          }
        ]
      }
    ]
  }
}
```

### Sync to External Service

**Hook Script:** `~/.claude/hooks/sync-to-service.sh`
```bash
#!/bin/bash

FILE_PATH=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolInput.file_path')
CONTENT=$(cat "$FILE_PATH" 2>/dev/null | base64)

# Send to external service
curl -X POST https://api.example.com/sync \
  -H "Content-Type: application/json" \
  -d "{\"file\": \"$FILE_PATH\", \"content\": \"$CONTENT\"}" \
  2>/dev/null

echo "{
  \"hookSpecificOutput\": {
    \"additionalContext\": \"File synced to external service\"
  }
}"
```

**Configuration:**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/sync-to-service.sh"
          }
        ]
      }
    ]
  }
}
```