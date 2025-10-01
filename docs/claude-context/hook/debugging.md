# Hook Debugging

## Debugging Tools

### Debug Mode
Enable detailed hook execution logging.

**Command:**
```bash
claude --debug
```

**Output Shows:**
- Hook trigger events
- Hook script execution
- Hook responses
- Timing information

### Manual Testing
Test hook scripts independently.

**Test Script:**
```bash
# Set up test input
export CLAUDE_HOOK_INPUT='{
  "toolName": "Write",
  "toolInput": {
    "file_path": "/tmp/test.txt"
  }
}'

export CLAUDE_PROJECT_DIR="$(pwd)"

# Run hook
/path/to/hook-script.sh
```

**Validate Output:**
```bash
# Check if output is valid JSON
/path/to/hook-script.sh | jq .

# Check specific fields
/path/to/hook-script.sh | jq -r '.decision'
/path/to/hook-script.sh | jq -r '.reason'
```

### Log Hook Execution
Add logging to hook scripts.

```bash
#!/bin/bash

LOG_FILE="$HOME/.claude/logs/hooks.log"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "Hook started"
log "Input: $CLAUDE_HOOK_INPUT"

# Your hook logic here
result='{"decision":"allow"}'

log "Output: $result"
echo "$result"
```

## Common Issues

### Hook Not Triggering

**Symptoms:**
- Hook doesn't run when expected
- No output in debug mode

**Causes:**
1. **Matcher doesn't match**
   ```json
   {
     "matcher": "write"  // ❌ Wrong (case-sensitive)
   }
   ```

   **Fix:**
   ```json
   {
     "matcher": "Write"  // ✅ Correct
   }
   ```

2. **Configuration file not loaded**
   - Check file location: `~/.claude/settings.json` or `./.claude/settings.json`
   - Verify JSON syntax: `jq . settings.json`

3. **Hook script not executable**
   ```bash
   chmod +x /path/to/hook-script.sh
   ```

**Debug Steps:**
```bash
# 1. Verify configuration syntax
jq . ~/.claude/settings.json

# 2. Check hook script permissions
ls -l /path/to/hook-script.sh

# 3. Test script manually
/path/to/hook-script.sh

# 4. Run claude with debug
claude --debug
```

### Invalid JSON Output

**Symptoms:**
- Hook seems to run but has no effect
- Claude Code ignores hook response

**Causes:**
1. **Malformed JSON**
   ```bash
   echo '{decision:"allow"}'  # ❌ Missing quotes
   ```

   **Fix:**
   ```bash
   echo '{"decision":"allow"}'  # ✅ Valid JSON
   ```

2. **Unescaped strings**
   ```bash
   echo '{"reason":"Path: /tmp/test"}'  # ✅ OK
   echo "{\"reason\":\"Path: $PATH\"}"  # ❌ Unescaped variable
   ```

   **Fix:**
   ```bash
   jq -n --arg reason "Path: $PATH" '{reason:$reason}'
   ```

3. **Multiline output**
   ```bash
   echo "Debug info"
   echo '{"decision":"allow"}'  # ❌ Extra output
   ```

   **Fix:**
   ```bash
   echo "Debug info" >> /tmp/hook-debug.log  # Log to file
   echo '{"decision":"allow"}'  # Only JSON to stdout
   ```

**Debug Steps:**
```bash
# Validate JSON output
/path/to/hook-script.sh | jq .

# Check for extra output
/path/to/hook-script.sh | wc -l  # Should be 1

# Test with sample input
export CLAUDE_HOOK_INPUT='{...}'
/path/to/hook-script.sh | jq .
```

### Hook Timing Out

**Symptoms:**
- Hook takes too long
- Claude Code waits indefinitely
- Operation seems stuck

**Causes:**
1. **Slow operations**
   ```bash
   # ❌ Slow network call
   curl https://api.example.com/check
   ```

   **Fix:**
   ```bash
   # ✅ Background job
   (curl https://api.example.com/check &)
   echo '{"decision":"allow"}'
   ```

2. **Infinite loops**
   ```bash
   while true; do  # ❌ Never exits
     check_something
   done
   ```

   **Fix:**
   ```bash
   timeout 5 check_something  # ✅ Timeout after 5s
   ```

**Debug Steps:**
```bash
# Time hook execution
time /path/to/hook-script.sh

# Add timeout to script
#!/bin/bash
timeout 2 your_operation || {
  echo '{"decision":"allow"}'
  exit 0
}
```

### Environment Variables Not Set

**Symptoms:**
- `$CLAUDE_HOOK_INPUT` is empty
- `$CLAUDE_PROJECT_DIR` is empty

**Causes:**
1. **Not available in context**
   - Some hook types may have limited context

2. **Shell escaping issues**
   ```bash
   echo $CLAUDE_HOOK_INPUT  # ❌ May expand incorrectly
   ```

   **Fix:**
   ```bash
   echo "$CLAUDE_HOOK_INPUT"  # ✅ Properly quoted
   ```

**Debug Steps:**
```bash
#!/bin/bash
# Debug environment variables
{
  echo "CLAUDE_HOOK_INPUT: $CLAUDE_HOOK_INPUT"
  echo "CLAUDE_PROJECT_DIR: $CLAUDE_PROJECT_DIR"
  echo "CLAUDE_TOOL_NAME: $CLAUDE_TOOL_NAME"
} >> /tmp/hook-env.log

# Then check input
if [ -z "$CLAUDE_HOOK_INPUT" ]; then
  echo '{}' # Empty input, allow by default
  exit 0
fi
```

### Permission Denied

**Symptoms:**
- Hook script can't execute
- "Permission denied" error

**Causes:**
1. **Script not executable**
   ```bash
   -rw-r--r-- hook-script.sh  # ❌ Not executable
   ```

   **Fix:**
   ```bash
   chmod +x hook-script.sh
   -rwxr-xr-x hook-script.sh  # ✅ Executable
   ```

2. **Path not accessible**
   ```bash
   command: "~/hooks/script.sh"  # ❌ Tilde may not expand
   ```

   **Fix:**
   ```bash
   command: "/home/user/hooks/script.sh"  # ✅ Absolute path
   ```

**Debug Steps:**
```bash
# Check permissions
ls -l /path/to/hook-script.sh

# Fix permissions
chmod +x /path/to/hook-script.sh

# Test execution
/path/to/hook-script.sh

# Check parent directory permissions
ls -ld /path/to
```

## Debugging Strategies

### Incremental Development

**Step 1: Minimal Hook**
```bash
#!/bin/bash
echo '{"decision":"allow"}'
```

**Step 2: Add Logging**
```bash
#!/bin/bash
echo "[$(date)] Hook triggered" >> /tmp/hook.log
echo '{"decision":"allow"}'
```

**Step 3: Add Input Parsing**
```bash
#!/bin/bash
TOOL_NAME=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolName')
echo "[$(date)] Tool: $TOOL_NAME" >> /tmp/hook.log
echo '{"decision":"allow"}'
```

**Step 4: Add Logic**
```bash
#!/bin/bash
TOOL_NAME=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolName')
if [ "$TOOL_NAME" = "Bash" ]; then
  echo '{"decision":"block","reason":"Testing"}'
else
  echo '{"decision":"allow"}'
fi
```

### Verbose Logging

```bash
#!/bin/bash

LOG="/tmp/hook-debug.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"
}

log "=== Hook Execution Started ==="
log "Input: $CLAUDE_HOOK_INPUT"
log "Project Dir: $CLAUDE_PROJECT_DIR"

# Parse input
TOOL_NAME=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolName')
log "Tool Name: $TOOL_NAME"

FILE_PATH=$(echo "$CLAUDE_HOOK_INPUT" | jq -r '.toolInput.file_path // empty')
log "File Path: $FILE_PATH"

# Your logic
if [ "$TOOL_NAME" = "Write" ]; then
  log "Processing Write tool"

  if [ -z "$FILE_PATH" ]; then
    log "ERROR: File path is empty"
    echo '{"decision":"block","reason":"File path required"}'
    exit 0
  fi

  log "File path validated: $FILE_PATH"
fi

log "Decision: allow"
echo '{"decision":"allow"}'
```

### Test Suite

```bash
#!/bin/bash
# test-hooks.sh

TESTS_PASSED=0
TESTS_FAILED=0

test_hook() {
  local name="$1"
  local input="$2"
  local expected_decision="$3"

  export CLAUDE_HOOK_INPUT="$input"
  result=$(./hook-script.sh)
  decision=$(echo "$result" | jq -r '.decision // "allow"')

  if [ "$decision" = "$expected_decision" ]; then
    echo "✓ $name"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo "✗ $name (expected: $expected_decision, got: $decision)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

# Test cases
test_hook "Allow safe command" \
  '{"toolName":"Bash","toolInput":{"command":"ls"}}' \
  "allow"

test_hook "Block dangerous command" \
  '{"toolName":"Bash","toolInput":{"command":"rm -rf /"}}' \
  "block"

test_hook "Allow write in project" \
  '{"toolName":"Write","toolInput":{"file_path":"./test.txt"}}' \
  "allow"

# Summary
echo ""
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $TESTS_FAILED"

[ $TESTS_FAILED -eq 0 ]
```

## Troubleshooting Checklist

### Configuration
- [ ] `settings.json` exists in correct location
- [ ] JSON syntax is valid (`jq . settings.json`)
- [ ] Hook matcher pattern is correct
- [ ] Hook type matches event name

### Script
- [ ] Script file exists
- [ ] Script is executable (`chmod +x`)
- [ ] Script has shebang (`#!/bin/bash`)
- [ ] Script uses absolute paths
- [ ] Script outputs valid JSON

### Execution
- [ ] Hook triggers in debug mode (`claude --debug`)
- [ ] Environment variables are set
- [ ] Script completes quickly (< 5s)
- [ ] Script exits with code 0
- [ ] No extraneous output to stdout

### Output
- [ ] Output is valid JSON (`| jq .`)
- [ ] `decision` field is "allow", "block", or omitted
- [ ] `reason` field explains decision
- [ ] No debug output mixed with JSON

### Testing
- [ ] Hook tested manually with sample input
- [ ] Hook tested in isolation
- [ ] Hook tested in hook chain
- [ ] Edge cases covered