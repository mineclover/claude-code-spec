# Settings Hierarchy

## Five-Level Structure

Settings are evaluated in strict precedence order from highest to lowest priority:

### 1. Enterprise Managed Policies
- **Priority**: Highest (cannot be overridden)
- **Purpose**: Organization-wide policy enforcement
- **Scope**: All users in the organization

**Locations by Platform:**
- **macOS**: `/Library/Application Support/ClaudeCode/managed-settings.json`
- **Linux/WSL**: `/etc/claude-code/managed-settings.json`
- **Windows**: `C:\ProgramData\ClaudeCode\managed-settings.json`

**Use Cases:**
- Security policies
- Compliance requirements
- Organization-wide restrictions

### 2. Command Line Arguments
- **Priority**: Second highest
- **Purpose**: Temporary session overrides
- **Scope**: Current session only

**Examples:**
```bash
claude --model claude-opus-4-5 -p "your prompt"
claude --permission-mode acceptAll -p "automated task"
```

**Use Cases:**
- One-time configuration changes
- Testing different models
- Automation scripts

### 3. Local Project Settings
- **Location**: `.claude/settings.local.json`
- **Priority**: Third
- **Purpose**: Personal project-specific settings
- **Scope**: Current project, not version controlled

**Characteristics:**
- Not checked into git (add to `.gitignore`)
- Developer-specific preferences
- Local experiments and overrides

**Use Cases:**
- Personal API keys
- Local development configurations
- Temporary project overrides

### 4. Shared Project Settings
- **Location**: `.claude/settings.json`
- **Priority**: Fourth
- **Purpose**: Team-shared project configuration
- **Scope**: All team members via source control

**Characteristics:**
- Checked into version control
- Team-wide consistency
- Project-specific defaults

**Use Cases:**
- Project conventions
- Shared hooks and permissions
- Team MCP server configurations

### 5. User Settings
- **Location**: `~/.claude/settings.json`
- **Priority**: Lowest
- **Purpose**: Personal preferences across all projects
- **Scope**: Individual user, all projects

**Characteristics:**
- Global personal settings
- Applies to all projects
- User-specific tools and preferences

**Use Cases:**
- Personal code style preferences
- Global hooks
- User-level MCP servers

## Precedence Visualization

```
Enterprise Managed Policies  ─┐ (Highest Priority)
                              │
Command Line Arguments       ─┤
                              │
Local Project Settings       ─┤ Settings merge with
                              │ higher levels taking
Shared Project Settings      ─┤ precedence
                              │
User Settings                ─┘ (Lowest Priority)
```

## Settings Merging Behavior

When the same setting exists at multiple levels:
- **Simple values**: Higher level completely overrides lower level
- **Objects**: Merged recursively, with higher level keys taking precedence
- **Arrays**: Higher level replaces lower level entirely (no merging)

**Example:**
```json
// User settings (~/.claude/settings.json)
{
  "env": {
    "NODE_ENV": "development",
    "DEBUG": "true"
  }
}

// Project settings (.claude/settings.json)
{
  "env": {
    "NODE_ENV": "production"
  }
}

// Result: Project overrides user
{
  "env": {
    "NODE_ENV": "production",  // From project
    "DEBUG": "true"             // From user
  }
}
```

## Best Practices

### Configuration Strategy
1. **Enterprise**: Security and compliance only
2. **CLI Args**: Testing and one-off overrides
3. **Local Project**: Personal secrets and experiments
4. **Shared Project**: Team conventions and standards
5. **User**: Personal preferences and global tools

### Version Control
- **Commit**: `.claude/settings.json` (shared project)
- **Ignore**: `.claude/settings.local.json` (personal)
- **Document**: Required settings in project README

### Security
- Never commit secrets to shared settings
- Use `apiKeyHelper` for dynamic credentials
- Store sensitive data in local settings only
- Use environment variables when possible