# MCP Configuration

## Installation Scopes

### 1. Local Scope
Private configuration for current project.

**Characteristics:**
- Not checked into version control
- Ideal for personal/experimental setups
- Default configuration level

**Usage:**
```bash
claude mcp add --scope local server-name <command>
```

### 2. Project Scope
Team-shared configuration stored in `.mcp.json`.

**Characteristics:**
- Version controlled
- Shared across team
- Project-specific servers

**Usage:**
```bash
claude mcp add --scope project server-name <command>
```

**Best Practices:**
- Commit `.mcp.json` to repository
- Document required environment variables
- Use for shared team tools

### 3. User Scope
Personal configuration across all projects.

**Characteristics:**
- User-specific settings
- Available in all projects
- Private to individual user

**Usage:**
```bash
claude mcp add --scope user server-name <command>
```

**Use Cases:**
- Personal utility servers
- Common development tools
- User preferences

## Scope Precedence
When multiple scopes define same server:
1. **Local** (highest priority)
2. **Project**
3. **User** (lowest priority)

## Authentication

### OAuth 2.0 Support
MCP supports OAuth 2.0 for cloud-based servers.

**Features:**
- Automatic token refresh
- Browser-based authentication flow
- Secure token storage

**Authentication Command:**
```bash
/mcp
```

Initiates authentication flow for servers requiring OAuth.

### Environment Variables
Use environment variables for sensitive configuration.

**Example:**
```bash
claude mcp add api -- node server.js \
  --token ${API_TOKEN}
```

**Best Practices:**
- Store credentials in `.env` files
- Never commit secrets to version control
- Use different credentials per environment

## Practical Examples

### Sentry Error Monitoring
```bash
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
```

### PostgreSQL Database
```bash
claude mcp add db -- npx -y @bytebase/dbhub \
  --dsn "postgresql://readonly:pass@prod.db.com:5432/analytics"
```

### Custom Local Server
```bash
claude mcp add --scope local custom -- node ./mcp-server.js
```

## Import from JSON
Import existing MCP configuration:

```bash
claude mcp import config.json
```

**JSON Format:**
```json
{
  "servers": {
    "server-name": {
      "command": "node",
      "args": ["server.js"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```