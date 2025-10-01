# Hook Patterns and Best Practices

## Design Patterns

### Guard Pattern
Validate before allowing operations.

**Use Case:** Prevent dangerous operations

```bash
#!/bin/bash
# guard-pattern.sh

INPUT="$CLAUDE_HOOK_INPUT"

# Check condition
if is_dangerous "$INPUT"; then
  echo '{"decision":"block","reason":"Dangerous operation"}'
else
  echo '{"decision":"allow"}'
fi
```

**Benefits:**
- Fail-fast validation
- Clear decision logic
- Easy to test

### Enrich Pattern
Add context without blocking.

**Use Case:** Inject dynamic information

```bash
#!/bin/bash
# enrich-pattern.sh

# Gather context
CONTEXT=$(get_dynamic_context)

echo "{
  \"hookSpecificOutput\": {
    \"additionalContext\": \"$CONTEXT\"
  }
}"
```

**Benefits:**
- Non-intrusive
- Flexible context
- Composable

### Pipeline Pattern
Chain multiple validation/transformation steps.

**Use Case:** Multi-stage processing

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {"type": "command", "command": "/hooks/validate.sh"},
          {"type": "command", "command": "/hooks/format.sh"},
          {"type": "command", "command": "/hooks/commit.sh"}
        ]
      }
    ]
  }
}
```

**Benefits:**
- Separation of concerns
- Reusable components
- Easy maintenance

### Audit Pattern
Log all operations without interfering.

**Use Case:** Compliance and monitoring

```bash
#!/bin/bash
# audit-pattern.sh

LOG_FILE="/var/log/claude-audit.log"

# Log operation
echo "$(date): $CLAUDE_HOOK_INPUT" >> "$LOG_FILE"

# Always allow
echo '{}'
```

**Benefits:**
- Transparent logging
- Non-blocking
- Historical record

## Best Practices

### Script Organization

#### Directory Structure
```
~/.claude/
├── settings.json
└── hooks/
    ├── guards/
    │   ├── validate-bash.sh
    │   └── validate-path.sh
    ├── enrichers/
    │   ├── add-git-context.sh
    │   └── add-env-context.sh
    ├── automation/
    │   ├── auto-format.sh
    │   └── auto-commit.sh
    └── utils/
        ├── common.sh
        └── logging.sh
```

#### Shared Utilities
```bash
# ~/.claude/hooks/utils/common.sh

log_info() {
  echo "[INFO] $1" >> "$HOME/.claude/logs/hooks.log"
}

log_error() {
  echo "[ERROR] $1" >> "$HOME/.claude/logs/hooks.log"
}

get_tool_name() {
  echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolName'
}

get_file_path() {
  echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolInput.file_path // empty'
}
```

**Usage:**
```bash
#!/bin/bash
source "$HOME/.claude/hooks/utils/common.sh"

log_info "Validating operation"
TOOL=$(get_tool_name)
log_info "Tool: $TOOL"
```

### Error Handling

#### Graceful Degradation
Always allow on error unless explicitly blocking.

```bash
#!/bin/bash

{
  # Try operation
  result=$(validate_operation)

  if [ $? -ne 0 ]; then
    echo '{"decision":"block","reason":"Validation failed"}'
  else
    echo '{"decision":"allow"}'
  fi
} || {
  # On script error, log and allow
  echo "Hook error: $?" >> /tmp/hook-errors.log
  echo '{}'
}
```

#### Exit Codes
Always exit with 0 to prevent hook failures.

```bash
#!/bin/bash

# Do work
if dangerous_operation; then
  echo '{"decision":"block","reason":"Not allowed"}'
  exit 0  # Always exit 0
fi

echo '{"decision":"allow"}'
exit 0  # Always exit 0
```

### Performance

#### Keep Hooks Fast
Target < 1 second execution time.

**Good:**
```bash
# Fast check
if echo "$COMMAND" | grep -q "dangerous"; then
  echo '{"decision":"block"}'
fi
```

**Avoid:**
```bash
# Slow network call
curl -X POST api.example.com/check --data "$COMMAND"
```

#### Cache Results
Store expensive computations.

```bash
#!/bin/bash

CACHE_FILE="/tmp/hook-cache-$$"
CACHE_TTL=300  # 5 minutes

if [ -f "$CACHE_FILE" ]; then
  CACHE_AGE=$(($(date +%s) - $(stat -f %m "$CACHE_FILE")))
  if [ $CACHE_AGE -lt $CACHE_TTL ]; then
    cat "$CACHE_FILE"
    exit 0
  fi
fi

# Compute result
RESULT=$(expensive_operation)
echo "$RESULT" | tee "$CACHE_FILE"
```

#### Background Processing
For non-critical slow operations.

```bash
#!/bin/bash

# Immediate response
echo '{"decision":"allow"}'

# Background work
{
  sleep 10
  send_notification
} &
```

### Security

#### Input Validation
Never trust hook input directly.

```bash
#!/bin/bash

FILE_PATH=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolInput.file_path')

# Validate path
if [[ "$FILE_PATH" =~ \.\. ]]; then
  echo '{"decision":"block","reason":"Path traversal detected"}'
  exit 0
fi

# Validate characters
if [[ ! "$FILE_PATH" =~ ^[a-zA-Z0-9/_.-]+$ ]]; then
  echo '{"decision":"block","reason":"Invalid characters in path"}'
  exit 0
fi
```

#### Sanitize Inputs
Clean user-provided data.

```bash
#!/bin/bash

# Remove dangerous characters
sanitize() {
  echo "$1" | tr -d ';&|`$()<>'
}

COMMAND=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolInput.command')
SAFE_COMMAND=$(sanitize "$COMMAND")
```

#### Least Privilege
Run hooks with minimum necessary permissions.

```bash
#!/bin/bash

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo '{"decision":"block","reason":"Hooks should not run as root"}'
  exit 0
fi
```

### Testing

#### Unit Test Hooks
Test hooks independently.

```bash
# test-validate-bash.sh

export CLAUDE_HOOK_INPUT='{
  "toolName": "Bash",
  "toolInput": {
    "command": "rm -rf /"
  }
}'

result=$(./validate-bash.sh)
decision=$(echo "$result" | jq -r '.decision')

if [ "$decision" != "block" ]; then
  echo "FAIL: Should block dangerous command"
  exit 1
fi

echo "PASS"
```

#### Integration Testing
Test hook chains.

```bash
# test-write-pipeline.sh

# Create test file
echo "test" > /tmp/test-file.txt

# Simulate Write tool
export CLAUDE_HOOK_INPUT='{
  "toolName": "Write",
  "toolInput": {
    "file_path": "/tmp/test-file.txt"
  }
}

# Run hooks in order
./validate-path.sh && \
./auto-format.sh && \
./auto-commit.sh

echo "Pipeline test completed"
```

## Advanced Patterns

### Conditional Execution
Execute different logic based on context.

```bash
#!/bin/bash

TOOL_NAME=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolName')
FILE_PATH=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolInput.file_path // empty')

case "$TOOL_NAME" in
  Write)
    # Write-specific logic
    validate_write "$FILE_PATH"
    ;;
  Edit)
    # Edit-specific logic
    validate_edit "$FILE_PATH"
    ;;
  Bash)
    # Bash-specific logic
    validate_bash
    ;;
  *)
    echo '{"decision":"allow"}'
    ;;
esac
```

### State Management
Maintain state across hooks.

```bash
#!/bin/bash

STATE_FILE="/tmp/claude-hook-state.json"

# Read state
STATE=$(cat "$STATE_FILE" 2>/dev/null || echo '{}')

# Update state
OPERATION_COUNT=$(echo "$STATE" | jq -r '.operations // 0')
OPERATION_COUNT=$((OPERATION_COUNT + 1))

NEW_STATE=$(echo "$STATE" | jq ".operations = $OPERATION_COUNT")
echo "$NEW_STATE" > "$STATE_FILE"

# Use state in decision
if [ $OPERATION_COUNT -gt 100 ]; then
  echo '{"decision":"block","reason":"Operation limit reached"}'
else
  echo '{"decision":"allow"}'
fi
```

### Circuit Breaker
Stop operations after repeated failures.

```bash
#!/bin/bash

CIRCUIT_FILE="/tmp/hook-circuit-$$"
FAILURE_THRESHOLD=3

# Check circuit state
FAILURES=$(cat "$CIRCUIT_FILE" 2>/dev/null || echo "0")

if [ $FAILURES -ge $FAILURE_THRESHOLD ]; then
  echo '{"decision":"block","reason":"Circuit breaker open: too many failures"}'
  exit 0
fi

# Try operation
if ! operation_succeeds; then
  echo $((FAILURES + 1)) > "$CIRCUIT_FILE"
  echo '{"decision":"block","reason":"Operation failed"}'
else
  # Reset on success
  echo "0" > "$CIRCUIT_FILE"
  echo '{"decision":"allow"}'
fi
```

### Rate Limiting
Limit operations per time window.

```bash
#!/bin/bash

RATE_FILE="/tmp/hook-rate-$$"
WINDOW=60  # 1 minute
LIMIT=10

# Clean old entries
if [ -f "$RATE_FILE" ]; then
  NOW=$(date +%s)
  grep -v "^$((NOW - WINDOW))" "$RATE_FILE" > "$RATE_FILE.tmp"
  mv "$RATE_FILE.tmp" "$RATE_FILE"
fi

# Count operations in window
COUNT=$(wc -l < "$RATE_FILE" 2>/dev/null || echo "0")

if [ $COUNT -ge $LIMIT ]; then
  echo '{"decision":"block","reason":"Rate limit exceeded"}'
else
  # Record operation
  echo "$(date +%s)" >> "$RATE_FILE"
  echo '{"decision":"allow"}'
fi
```

### Retry Logic
Retry failed operations.

```bash
#!/bin/bash

MAX_RETRIES=3
RETRY_DELAY=1

for i in $(seq 1 $MAX_RETRIES); do
  if operation_succeeds; then
    echo '{"decision":"allow"}'
    exit 0
  fi

  if [ $i -lt $MAX_RETRIES ]; then
    sleep $RETRY_DELAY
  fi
done

echo '{"decision":"block","reason":"Operation failed after $MAX_RETRIES retries"}'
```

## Configuration Patterns

### Environment-Based
Different behavior per environment.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "if [ \"$ENV\" = \"prod\" ]; then /hooks/strict-validate.sh; else /hooks/lenient-validate.sh; fi"
          }
        ]
      }
    ]
  }
}
```

### Progressive Enhancement
Add hooks incrementally.

**Phase 1: Logging Only**
```json
{
  "hooks": {
    "PreToolUse": [
      {"matcher": ".*", "hooks": [{"type": "command", "command": "/hooks/log.sh"}]}
    ]
  }
}
```

**Phase 2: Add Validation**
```json
{
  "hooks": {
    "PreToolUse": [
      {"matcher": ".*", "hooks": [{"type": "command", "command": "/hooks/log.sh"}]},
      {"matcher": "Bash", "hooks": [{"type": "command", "command": "/hooks/validate.sh"}]}
    ]
  }
}
```

**Phase 3: Add Automation**
```json
{
  "hooks": {
    "PreToolUse": [
      {"matcher": ".*", "hooks": [{"type": "command", "command": "/hooks/log.sh"}]},
      {"matcher": "Bash", "hooks": [{"type": "command", "command": "/hooks/validate.sh"}]}
    ],
    "PostToolUse": [
      {"matcher": "Write", "hooks": [{"type": "command", "command": "/hooks/auto-format.sh"}]}
    ]
  }
}
```

### Feature Flags
Enable/disable hooks dynamically.

```bash
#!/bin/bash

FEATURE_FLAGS="/tmp/hook-features.json"

# Check if feature enabled
ENABLED=$(cat "$FEATURE_FLAGS" | jq -r '.autoFormat // false')

if [ "$ENABLED" = "true" ]; then
  # Run formatting
  format_code
  echo '{"hookSpecificOutput":{"additionalContext":"Formatted"}}'
else
  # Skip
  echo '{}'
fi
```