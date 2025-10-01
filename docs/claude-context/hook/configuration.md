# Hook Configuration

## Configuration File Structure

### Basic Format
Hooks are defined in `settings.json`:

```json
{
  "hooks": {
    "HookEventName": [
      {
        "matcher": "pattern",
        "hooks": [
          {
            "type": "command",
            "command": "shell command or script path"
          }
        ]
      }
    ]
  }
}
```

### Configuration Locations

**User-level (global):**
```
~/.claude/settings.json
```

**Project-level (repository):**
```
./.claude/settings.json
./claude/settings.json
```

**Precedence:** Project settings override user settings.

## Matcher Patterns

### Tool Name Matching
Match specific tools by name.

**Single Tool:**
```json
{
  "matcher": "Write"
}
```

**Multiple Tools (OR):**
```json
{
  "matcher": "Write|Edit|Bash"
}
```

### Regex Patterns
Use regular expressions for complex matching.

**All Tools:**
```json
{
  "matcher": ".*"
}
```

**File Operations:**
```json
{
  "matcher": "^(Write|Edit|Read)$"
}
```

**Starts With:**
```json
{
  "matcher": "^Bash.*"
}
```

### Matcher Examples

**Match all write operations:**
```json
{
  "matcher": "Write"
}
```

**Match all file operations:**
```json
{
  "matcher": "Write|Edit|Read"
}
```

**Match everything:**
```json
{
  "matcher": ".*"
}
```

**Match nothing (disable):**
```json
{
  "matcher": "^$"
}
```

## Hook Command Types

### Inline Commands
Simple shell commands directly in configuration.

```json
{
  "type": "command",
  "command": "echo 'Tool executed'"
}
```

**Best For:**
- Simple operations
- Single commands
- Quick prototyping

**Limitations:**
- No complex logic
- Hard to maintain
- Limited error handling

### Script Files
External scripts for complex logic.

```json
{
  "type": "command",
  "command": "/absolute/path/to/hook-script.sh"
}
```

**Best For:**
- Complex validation
- Multi-step operations
- Reusable logic
- Proper error handling

**Best Practices:**
- Use absolute paths
- Make scripts executable: `chmod +x script.sh`
- Include shebang: `#!/bin/bash`
- Implement error handling

## Multiple Hooks Per Event

### Sequential Execution
Hooks run in order defined in configuration.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "/scripts/validate.sh"
          },
          {
            "type": "command",
            "command": "/scripts/format.sh"
          },
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

**Execution Order:**
1. validate.sh
2. format.sh
3. git add

### Multiple Matchers
Different hooks for different tools.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "/scripts/validate-write.sh"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/scripts/validate-bash.sh"
          }
        ]
      }
    ]
  }
}
```

## Complete Configuration Example

### Full settings.json
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/session-start.sh"
          }
        ]
      }
    ],
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
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/validate-file-path.sh"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/validate-bash-command.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/auto-format.sh"
          },
          {
            "type": "command",
            "command": "git add ."
          }
        ]
      }
    ],
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
    ],
    "SessionEnd": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/.claude/hooks/cleanup.sh"
          }
        ]
      }
    ]
  }
}
```

## Configuration Best Practices

### Organization
- Keep hook scripts in dedicated directory: `~/.claude/hooks/`
- Use descriptive script names
- Group related hooks together
- Comment complex configurations

### Paths
- Always use absolute paths
- Avoid relative paths (unreliable)
- Set execute permissions on scripts
- Verify paths exist before configuring

### Testing
- Test hooks in isolation first
- Use `claude --debug` to see hook execution
- Start with simple hooks
- Gradually add complexity

### Security
- Review hook scripts regularly
- Validate user inputs
- Limit hook permissions
- Avoid storing secrets in hooks
- Use environment variables for sensitive data

### Performance
- Keep hooks fast (< 1 second)
- Avoid network calls if possible
- Cache results when appropriate
- Use background jobs for slow operations

## Environment-Specific Configuration

### Development vs Production
Use different configurations per environment.

**Development (~/.claude/settings.json):**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Dev: file written'"
          }
        ]
      }
    ]
  }
}
```

**Production (project/.claude/settings.json):**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "/scripts/validate-and-deploy.sh"
          }
        ]
      }
    ]
  }
}
```

### Conditional Execution
Use environment variables in scripts.

```bash
#!/bin/bash
if [ "$ENVIRONMENT" = "production" ]; then
  # Production logic
  /scripts/deploy.sh
else
  # Development logic
  echo "Dev mode: skipping deployment"
fi
```