# Settings Features

## Authentication and API

### API Key Helper
Dynamic API key generation for secure authentication.

```json
{
  "apiKeyHelper": "/bin/generate_temp_api_key.sh"
}
```

**Script Requirements:**
- Must output API key to stdout
- Should handle refresh logic
- Exit code 0 for success

**Example Script:**
```bash
#!/bin/bash
# Fetch temporary API key from secure store
aws secretsmanager get-secret-value \
  --secret-id claude-api-key \
  --query SecretString \
  --output text
```

### Force Login Method
Restrict login to specific account types.

```json
{
  "forceLoginMethod": "email"
}
```

**Options:**
- `"email"`: Email/password authentication
- `"google"`: Google OAuth
- `"github"`: GitHub OAuth

### Organization Selection
Automatically select organization during login.

```json
{
  "forceLoginOrgUUID": "org-uuid-here"
}
```

## Permissions

### Allow List
Explicitly permit specific tool operations.

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run lint)",
      "Bash(npm run test:*)",
      "Read(~/.zshrc)"
    ]
  }
}
```

**Pattern Syntax:**
- Exact match: `"Bash(npm run lint)"`
- Wildcard: `"Bash(npm run test:*)"`
- Tool-level: `"Read(~/.zshrc)"`

### Deny List
Block specific operations and file access.

```json
{
  "permissions": {
    "deny": [
      "WebFetch",
      "Bash(curl:*)",
      "Read(./.env)",
      "Read(./secrets/**)"
    ]
  }
}
```

**Common Patterns:**
- Block tool: `"WebFetch"`
- Block command: `"Bash(rm:*)"`
- Block file: `"Read(./.env)"`
- Block directory: `"Read(./secrets/**)"`

### Ask Confirmation
Require user approval for specific actions.

```json
{
  "permissions": {
    "ask": [
      "Bash(git push:*)",
      "Write(./src/**)",
      "Edit(./package.json)"
    ]
  }
}
```

### Additional Directories
Extend file access beyond working directory.

```json
{
  "permissions": {
    "additionalDirectories": ["../docs/", "../shared-libs/"]
  }
}
```

### Default Permission Mode
Set default behavior for tool permissions.

```json
{
  "permissions": {
    "defaultMode": "acceptEdits"
  }
}
```

**Options:**
- `"acceptEdits"`: Auto-approve edits, ask for destructive operations
- `"acceptAll"`: Auto-approve all operations
- `"denyAll"`: Require approval for everything

### Disable Bypass Permissions
Control permission bypass capability.

```json
{
  "permissions": {
    "disableBypassPermissionsMode": "disable"
  }
}
```

## Environment Variables

### Global Environment
Set environment variables for all Claude Code operations.

```json
{
  "env": {
    "NODE_ENV": "production",
    "DEBUG": "false",
    "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}"
  }
}
```

### Custom Headers
Add custom HTTP headers to API requests.

```json
{
  "env": {
    "ANTHROPIC_CUSTOM_HEADERS": "X-Custom-Header: value, X-Another: value2"
  }
}
```

## Model Configuration

### Override Default Model
Specify which Claude model to use.

```json
{
  "model": "claude-sonnet-4-5-20250929"
}
```

**Available Models:**
- `"claude-sonnet-4-5-20250929"`: Sonnet 4.5 (latest)
- `"claude-opus-4-5"`: Opus 4.5
- `"claude-haiku-4"`: Haiku 4

## MCP Server Management

### Auto-Enable Project MCP Servers
Automatically approve MCP servers from `.mcp.json`.

```json
{
  "enableAllProjectMcpServers": true
}
```

### Enable Specific Servers
Whitelist specific MCP servers.

```json
{
  "enabledMcpjsonServers": ["memory", "github", "database"]
}
```

### Disable Specific Servers
Blacklist specific MCP servers.

```json
{
  "disabledMcpjsonServers": ["filesystem", "web-scraper"]
}
```

## Session Management

### Cleanup Period
Set retention period for chat transcripts.

```json
{
  "cleanupPeriodDays": 30
}
```

**Default**: 30 days

### Co-Authored By Attribution
Include Claude attribution in commits.

```json
{
  "includeCoAuthoredBy": false
}
```

**Default**: `true`

## Output Customization

### Output Style
Adjust Claude's system prompt and behavior.

```json
{
  "outputStyle": "Explanatory"
}
```

**Options:**
- `"Explanatory"`: Detailed explanations
- `"Concise"`: Minimal output
- Custom styles via output style configuration

### Status Line
Configure context display in status bar.

```json
{
  "statusLine": {
    "enabled": true,
    "format": "custom-format"
  }
}
```

## AWS Authentication

### AWS Auth Refresh
Custom AWS credential refresh script.

```json
{
  "awsAuthRefresh": "/scripts/refresh-aws-credentials.sh"
}
```

**Use Cases:**
- SSO credential refresh
- Role assumption
- Multi-account access

## Hooks

Configure custom commands before/after tool executions.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "/scripts/auto-format.sh"
          }
        ]
      }
    ]
  }
}
```

**See Also:** `@context/hook/index.md` for detailed hooks documentation.

## Complete Example

```json
{
  "apiKeyHelper": "/bin/generate_api_key.sh",
  "model": "claude-sonnet-4-5-20250929",
  "cleanupPeriodDays": 20,
  "includeCoAuthoredBy": false,
  "outputStyle": "Concise",
  "env": {
    "NODE_ENV": "production",
    "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}"
  },
  "permissions": {
    "allow": [
      "Bash(npm run lint)",
      "Bash(npm run test:*)"
    ],
    "deny": [
      "Read(./.env)",
      "Bash(rm:*)"
    ],
    "ask": [
      "Bash(git push:*)"
    ],
    "additionalDirectories": ["../docs/"],
    "defaultMode": "acceptEdits"
  },
  "enableAllProjectMcpServers": true,
  "disabledMcpjsonServers": ["experimental-server"]
}
```