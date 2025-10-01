# MCP Basics

## What is MCP?
Model Context Protocol (MCP) is a standardized protocol that extends Claude Code's capabilities by connecting to external servers. MCP servers provide:
- **Tools**: Functions Claude can execute
- **Resources**: Data and content Claude can access
- **Prompts**: Reusable prompt templates

## Server Types

### 1. Stdio Servers
Local processes running on your machine.

**Characteristics:**
- Direct system access
- Fast execution
- No network dependency

**Use Cases:**
- File system operations
- Local database queries
- System command execution

**Example:**
```bash
claude mcp add db -- npx -y @bytebase/dbhub \
  --dsn "postgresql://user:pass@localhost:5432/db"
```

### 2. SSE (Server-Sent Events) Servers
Real-time streaming connections to cloud services.

**Characteristics:**
- Persistent connections
- Server-to-client streaming
- Real-time updates

**Use Cases:**
- Cloud service integration
- Event-driven workflows
- Live data monitoring

**Example:**
```bash
claude mcp add --transport sse analytics https://api.example.com/mcp
```

### 3. HTTP Servers
Standard request/response pattern with web services.

**Characteristics:**
- REST API integration
- Stateless communication
- Wide compatibility

**Use Cases:**
- REST API integration
- Third-party services
- Web-based tools

**Example:**
```bash
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
```

## Key Commands

### Add Server
```bash
claude mcp add <name> <command>
```

### List Servers
```bash
claude mcp list
```

### Get Server Details
```bash
claude mcp get <server-name>
```

### Remove Server
```bash
claude mcp remove <server-name>
```