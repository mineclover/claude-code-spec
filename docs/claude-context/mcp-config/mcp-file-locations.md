# MCP File Locations

## Configuration File Storage

MCP server configurations are stored in JSON files at different scope levels, similar to Memory and Settings hierarchies.

### User-Level Configuration
**Location:** `~/.claude.json`

**Purpose:** Personal MCP servers available across all projects

**Format:**
```json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "memory": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

**Use Cases:**
- Personal utility servers (memory, calculator)
- Personal API integrations (GitHub, Slack)
- Cross-project development tools
- User-specific credentials

**Best Practices:**
- Store personal tokens and credentials here
- Configure commonly used servers once
- Keep sensitive data in environment variables
- Document personal server setup in user notes

### Project-Level Configuration
**Location:** `.mcp.json` (project root)

**Purpose:** Team-shared MCP servers for the project

**Format:**
```json
{
  "mcpServers": {
    "sentry": {
      "type": "http",
      "transport": "http",
      "url": "https://mcp.sentry.dev/mcp",
      "auth": {
        "type": "oauth"
      }
    },
    "database": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@bytebase/dbhub",
        "--dsn",
        "${DATABASE_URL}"
      ]
    }
  }
}
```

**Use Cases:**
- Project-specific error monitoring (Sentry)
- Project database access
- Shared third-party integrations
- Team collaboration tools

**Best Practices:**
- Commit to version control
- Document required environment variables in README
- Use environment variable expansion for secrets
- Specify exact versions when possible

### Local Project Configuration
**Location:** `.mcp.local.json` (not in git)

**Purpose:** Personal project overrides and experiments

**Format:**
```json
{
  "mcpServers": {
    "dev-database": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@bytebase/dbhub",
        "--dsn",
        "postgresql://localhost:5432/dev"
      ]
    }
  }
}
```

**Use Cases:**
- Local development overrides
- Testing new servers
- Personal debugging tools
- Experimental configurations

## Configuration Hierarchy and Merging

### Precedence Order
When same server name exists at multiple levels:
1. **Local Project** (`.mcp.local.json`) - Highest priority
2. **Project** (`.mcp.json`)
3. **User** (`~/.claude.json`) - Lowest priority

### Merging Behavior
```json
// User (~/.claude.json)
{
  "mcpServers": {
    "database": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@bytebase/dbhub", "--dsn", "prod-db"]
    }
  }
}

// Project (.mcp.json)
{
  "mcpServers": {
    "database": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@bytebase/dbhub", "--dsn", "${PROJECT_DB}"]
    }
  }
}

// Result: Project configuration overrides user configuration
```

## File Structure Details

### Server Configuration Schema
```json
{
  "mcpServers": {
    "server-name": {
      // Required fields
      "type": "stdio | http | sse",

      // Stdio-specific
      "command": "path/to/executable",
      "args": ["arg1", "arg2"],

      // HTTP/SSE-specific
      "url": "https://api.example.com/mcp",
      "transport": "http | sse",

      // Common optional fields
      "env": {
        "KEY": "value or ${ENV_VAR}"
      },
      "auth": {
        "type": "oauth | bearer | basic",
        "token": "${TOKEN_ENV_VAR}"
      },
      "timeout": 30000,
      "metadata": {
        "description": "Server description",
        "version": "1.0.0"
      }
    }
  }
}
```

### Environment Variable Expansion
Claude Code automatically expands `${VAR_NAME}` syntax:

```json
{
  "mcpServers": {
    "api-server": {
      "type": "http",
      "url": "https://api.example.com",
      "env": {
        "API_KEY": "${MY_API_KEY}",
        "API_SECRET": "${MY_API_SECRET}",
        "ENDPOINT": "${API_ENDPOINT:-https://default.example.com}"
      }
    }
  }
}
```

**Features:**
- `${VAR}`: Required variable (fails if not set)
- `${VAR:-default}`: Optional with fallback
- Works in command, args, env, and url fields

## File Management

### Creating Configuration Files

**User-level (one-time setup):**
```bash
# Option 1: Use CLI to create
claude mcp add --scope user github -- npx -y @modelcontextprotocol/server-github

# Option 2: Create manually
mkdir -p ~/.claude
cat > ~/.claude.json << 'EOF'
{
  "mcpServers": {
    "memory": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
EOF
```

**Project-level (team setup):**
```bash
# Option 1: Use CLI
claude mcp add --scope project sentry --transport http https://mcp.sentry.dev/mcp

# Option 2: Create manually
cat > .mcp.json << 'EOF'
{
  "mcpServers": {
    "sentry": {
      "type": "http",
      "url": "https://mcp.sentry.dev/mcp"
    }
  }
}
EOF
git add .mcp.json
git commit -m "Add Sentry MCP configuration"
```

### Version Control Strategy

**Commit to git:**
- ✅ `.mcp.json` (shared project config)
- ✅ `.mcp.example.json` (template with placeholders)

**Ignore in git:**
- ❌ `.mcp.local.json` (personal overrides)
- ❌ `~/.claude.json` (user-level config)

**.gitignore:**
```
.mcp.local.json
```

**README.md documentation:**
```markdown
## MCP Configuration

Required environment variables for `.mcp.json`:
- `SENTRY_AUTH_TOKEN`: Sentry API token
- `DATABASE_URL`: PostgreSQL connection string

Set up:
\`\`\`bash
cp .mcp.example.json .mcp.json
# Edit .mcp.json with your environment variables
\`\`\`
```

## Verification and Debugging

### Check Configuration Loading
```bash
# List all active servers
claude mcp list

# Get specific server details
claude mcp get server-name

# Test server connectivity
claude -p "Test connection to [server-name]"
```

### Troubleshooting

**Server not loading:**
1. Check JSON syntax: `jq . < .mcp.json`
2. Verify file permissions: `ls -la .mcp.json`
3. Check environment variables: `echo $REQUIRED_VAR`
4. Review logs: `claude --debug`

**Scope conflicts:**
1. List all sources: `claude mcp list --verbose`
2. Check precedence: Local > Project > User
3. Remove conflicting entry: `claude mcp remove --scope user server-name`

**Environment variable not expanding:**
1. Verify variable is set: `printenv | grep VAR_NAME`
2. Check syntax: Use `${VAR}` not `$VAR`
3. Quote in command args: `"--token=${TOKEN}"`