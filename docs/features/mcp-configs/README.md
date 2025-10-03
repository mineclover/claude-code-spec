# MCP Configurations Management

## Overview

The **MCP Configurations** page provides a graphical interface for managing Model Context Protocol (MCP) server configurations within your Claude Code projects.

**Route:** `/mcp-configs`  
**Component:** `src/pages/McpConfigsPage.tsx`

## Purpose

MCP configurations enable you to:

1. **Optimize Initialization Time**: Load only the MCP servers you need
2. **Reduce Context Usage**: Minimize the number of tools loaded
3. **Control Dependencies**: Explicitly define which MCP servers your project requires
4. **Enable Team Sharing**: Commit configuration files to version control
5. **Support Multiple Workflows**: Create different configurations for different tasks

## Claude Code MCP Configuration

### The `--mcp-config` Flag

```bash
claude --mcp-config .claude/.mcp-dev.json -p "your query"
```

**Default Behavior (without flag):**
- Loads MCP servers from all scopes: User, Project, Local
- Initialization can be slow if many servers are configured
- All tools from all servers are loaded into context

**With `--mcp-config` flag:**
- Loads MCP servers only from the specified configuration file
- Faster initialization
- Reduced context usage
- Explicit control over available tools

### The `--strict-mcp-config` Flag

```bash
claude --mcp-config .claude/.mcp-dev.json --strict-mcp-config -p "your query"
```

**Purpose:**
- Ignores user-level MCP configurations (~/.claude.json)
- Prevents unexpected servers from being loaded
- Guarantees reproducible execution environment
- Essential for team collaboration and CI/CD

**Recommended:** Always use `--strict-mcp-config` with `--mcp-config` for predictable behavior.

### MCP Configuration File Format

```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio",
      "command": "command",
      "args": ["arg1", "arg2"],
      "env": {}
    }
  }
}
```

**Example - Development Configuration:**
```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@agentic-insights/mcp-server-serena"]
    },
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@context7/mcp-server"]
    }
  }
}
```

### Naming Convention

MCP configuration files follow the pattern:

```
.claude/.mcp-{purpose}.json
```

**Examples:**
- `.mcp-analysis.json`
- `.mcp-dev.json`
- `.mcp-ui.json`
- `.mcp-e2e.json`
- `.mcp-empty.json`

## Feature Components

### Left Sidebar

- **Configuration List**: All `.mcp-*.json` files in `.claude/` directory
- **New Configuration**: Button to create new config
- **Project Info**: Shows current project directory

### Right Panel

**Edit Mode:**
- Configuration content editor (JSON)
- Usage scripts (Interactive, Single Query)
- Save/Reset buttons

**Create Mode:**
- Configuration name input
- MCP server selection (checkboxes)
- Refresh servers button
- Create/Cancel buttons

## Implementation Details

### Core Functions

**listMcpConfigs()** (src/services/settings.ts:237-262)
```typescript
export async function listMcpConfigs(projectPath: string): Promise<McpConfigFile[]> {
  const claudeDir = path.join(projectPath, '.claude');
  const files = await fs.readdir(claudeDir);
  
  const mcpFiles = files.filter(f => f.startsWith('.mcp-') && f.endsWith('.json'));
  
  const configs = await Promise.all(mcpFiles.map(async (file) => {
    const filePath = path.join(claudeDir, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const stats = await fs.stat(filePath);
    
    return {
      name: file,
      path: filePath,
      content,
      lastModified: stats.mtimeMs
    };
  }));
  
  return configs.sort((a, b) => a.name.localeCompare(b.name));
}
```

**getMcpServerList()** (src/services/settings.ts:268-357)

Loads available MCP servers from configured paths:
1. User-level: `~/.claude.json`
2. Project-level: `.claude/.mcp.json`
3. Local-level: `.claude/.mcp.local.json`

**createMcpConfig()** (src/services/settings.ts:362+)

Creates a new MCP configuration file with selected servers.

### IPC Handlers

```typescript
// src/ipc/handlers/settingsHandlers.ts:74-91
ipcMain.handle('settings:list-mcp-configs', async (_, projectPath: string) => {
  return await listMcpConfigs(projectPath);
});

ipcMain.handle('settings:get-mcp-servers', async () => {
  return await getMcpServerList();
});

ipcMain.handle('settings:create-mcp-config', async (
  _,
  projectPath: string,
  name: string,
  servers: string[]
) => {
  return await createMcpConfig(projectPath, name, servers);
});
```

## User Guide

### Creating a New Configuration

1. Click "**+ New Configuration**"
2. Enter configuration name (e.g., "dev", "analysis")
3. Click "**🔄 Refresh Servers**" to load available servers
4. Select MCP servers (check boxes)
5. Click "**Create Configuration**"
6. File created at `.claude/.mcp-{name}.json`

### Editing an Existing Configuration

1. Select configuration from left sidebar
2. Edit JSON content in text area
3. Click "**Save Changes**"
4. JSON validation runs automatically

### Deleting a Configuration

1. Select configuration
2. Click "**Delete**" button
3. Confirm deletion

### Using a Configuration in CLI

Copy the usage script from the UI:

**Interactive Mode:**
```bash
claude --mcp-config .claude/.mcp-dev.json --strict-mcp-config
```

**Single Query Mode:**
```bash
claude -p "your query" --mcp-config .claude/.mcp-dev.json --strict-mcp-config
```

## Agent-Specific MCP Optimization Strategy

### Principle: Match MCP Configuration to Task Type

Different types of tasks require different sets of MCP tools. Loading only necessary servers reduces:
- Initialization time (faster startup)
- Context window usage (more room for code/conversation)
- Cost (fewer tokens consumed)
- Complexity (simpler tool selection for Claude)

### Recommended Configuration Presets

> **Note on Tool Counts:**
> - The actual number and list of tools provided by each MCP server is determined dynamically at runtime
> - Tool availability may vary based on MCP server versions and configurations
> - Use the `/context` command in Claude Code to see the exact tools loaded for your configuration
> - This documentation describes the intended purpose of each preset, not exact tool counts

> **Note on Serena Invocation Methods:**
> - `.mcp-analysis.json` and `.mcp-dev.json` use `npx @agentic-insights/mcp-server-serena` (package-based)
> - `.mcp-ui.json` and `.mcp-e2e.json` use `serena start-mcp-server` (CLI-based with context)
> - Both methods provide the same core functionality, but CLI-based allows project context configuration
> - The CLI method requires serena to be installed globally or in your PATH

#### 1. Analysis Configuration (`.mcp-analysis.json`)

**Purpose:** Code exploration, architecture analysis, read-only operations

**MCP Servers:**
- `serena` - Code symbol analysis, file navigation (via npx)
- `sequential-thinking` - Complex problem-solving, step-by-step reasoning

**Use Cases:**
- Understanding codebase architecture
- Analyzing dependencies and relationships
- Planning refactoring without making changes
- Code reviews and audits

**Example Usage:**
```bash
claude --permission-mode plan \
  --mcp-config .claude/.mcp-analysis.json \
  --strict-mcp-config \
  -p "Analyze the authentication flow and identify potential security issues"
```

**Benefits:**
- Fast initialization (only 2 MCP servers)
- Read-only safety (use with `--permission-mode plan`)
- Focused tool set for analysis tasks

#### 2. Development Configuration (`.mcp-dev.json`)

**Purpose:** General coding, refactoring, documentation lookup

**MCP Servers:**
- `serena` - Code operations (read, write, symbol management, via npx)
- `context7` - Library documentation lookup

**Use Cases:**
- Writing new features
- Refactoring existing code
- Looking up library documentation
- Bug fixes

**Example Usage:**
```bash
claude --mcp-config .claude/.mcp-dev.json \
  --strict-mcp-config \
  -p "Add error handling to the API endpoints using best practices from Express.js docs"
```

**Benefits:**
- Balanced tool set for most development tasks
- Access to up-to-date library documentation
- Fast enough for interactive use

#### 3. UI Configuration (`.mcp-ui.json`)

**Purpose:** UI/UX development, component creation, styling

**MCP Servers:**
- `serena` - Code operations (via direct serena CLI)
- `magic` - UI component builder (21st.dev integration)

**Use Cases:**
- Creating new UI components
- Redesigning existing interfaces
- Adding logos and visual elements
- Styling and layout improvements

**Example Usage:**
```bash
claude --mcp-config .claude/.mcp-ui.json \
  --strict-mcp-config \
  -p "Create a modern dashboard layout with cards, charts, and a sidebar"
```

**Benefits:**
- Access to pre-built component templates
- Logo search and integration
- UI-focused tool set

#### 4. E2E Testing Configuration (`.mcp-e2e.json`)

**Purpose:** Browser automation, end-to-end testing

**MCP Servers:**
- `serena` - Code operations (via direct serena CLI)
- `playwright` - Browser control and automation

**Use Cases:**
- Writing E2E tests
- Browser automation scripts
- Testing user flows
- Screenshot capture and comparison

**Example Usage:**
```bash
claude --mcp-config .claude/.mcp-e2e.json \
  --strict-mcp-config \
  -p "Create E2E test for the login flow with error handling"
```

**Benefits:**
- Full browser control capabilities
- Snapshot and screenshot tools
- Network request monitoring

#### 5. Empty Configuration (`.mcp-empty.json`)

**Purpose:** Minimal setup, pure LLM capabilities

**MCP Servers:** None (built-in Claude Code tools only)

**Use Cases:**
- Simple questions and answers
- Performance benchmarking
- Testing without MCP overhead
- Quick queries that don't need code access

**Example Usage:**
```bash
claude --mcp-config .claude/.mcp-empty.json \
  --strict-mcp-config \
  -p "Explain the difference between async/await and Promises"
```

**Benefits:**
- Fastest initialization
- Minimal context usage
- Good for learning and exploration

### Performance Comparison

> **Note:** Initialization times are approximate and may vary based on system performance, network conditions, and MCP server versions.

| Configuration | MCP Servers | Init Time (approx) | Best For |
|---------------|-------------|-------------------|----------|
| Empty | 0 | 1-2s | Questions, benchmarks |
| Analysis | 2 | 2-3s | Code exploration |
| Development | 2 | 2-3s | General coding |
| UI | 2 | 3-4s | Component development |
| E2E | 2 | 3-5s | Browser testing |
| Full (default) | 6+ | 5-10s | Interactive sessions |

### Workflow-Based Selection Strategy

#### Exploration Phase
```bash
# Start with analysis to understand the codebase
claude --permission-mode plan \
  --mcp-config .claude/.mcp-analysis.json \
  --strict-mcp-config
```

#### Implementation Phase
```bash
# Switch to development config for making changes
claude --mcp-config .claude/.mcp-dev.json \
  --strict-mcp-config
```

#### UI Development
```bash
# Use UI config for frontend work
claude --mcp-config .claude/.mcp-ui.json \
  --strict-mcp-config
```

#### Testing Phase
```bash
# Use E2E config for browser tests
claude --mcp-config .claude/.mcp-e2e.json \
  --strict-mcp-config
```

### Team Collaboration

**Recommended Practice:**
1. Create MCP configurations for your project
2. Commit `.claude/.mcp-*.json` to version control
3. Add to README: "Run with `claude --mcp-config .claude/.mcp-dev.json`"
4. Team members get consistent tool environment

**Example .gitignore:**
```gitignore
# Commit MCP presets
!.claude/.mcp-*.json

# But ignore local overrides
.claude/.mcp.local.json
```

## Reference Documentation

### Internal Documentation
- [Claude Context - MCP Config](../../claude-context/mcp-config/index.md)
- [Claude Context - Usage - CLI Reference](../../claude-context/usage/cli-reference.md)
- [Execute Feature](../execute/)
- [Settings Feature](../settings/)

### External Resources
- [Claude Code Official Docs - MCP](https://docs.anthropic.com/claude-code/mcp)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)

## Troubleshooting

### MCP Server Not Found

**Symptom:** Server not appearing in available servers list

**Solutions:**
1. Check if server is configured in `~/.claude.json`
2. Run "Refresh Servers" button
3. Manually add to configuration file

### JSON Validation Errors

**Symptom:** "Invalid JSON" error when saving

**Solutions:**
1. Use JSON validator (jsonlint.com)
2. Check for missing commas, quotes
3. Validate `mcpServers` structure

### Configuration Not Loading

**Symptom:** MCP servers not loaded when using `--mcp-config`

**Solutions:**
1. Use `--strict-mcp-config` flag
2. Check file path is relative to project root
3. Verify file exists: `ls .claude/.mcp-*.json`

### MCP Server Initialization Failures

**Symptom:** Server listed but tools not available

**Solutions:**
1. Check server command is in PATH
2. Run command manually to test
3. Check server logs for errors
4. Ensure dependencies are installed (npm, npx)

## Best Practices

1. **Start Minimal**: Begin with empty or minimal configs, add servers as needed
2. **Use Strict Mode**: Always use `--strict-mcp-config` for reproducibility
3. **Document Configs**: Add comments (as separate `.md` files) explaining each config's purpose
4. **Version Control**: Commit MCP configs to git for team consistency
5. **Test Locally**: Test configs locally before sharing with team
6. **Regular Updates**: Keep MCP server packages updated
7. **Monitor Performance**: Track initialization times and adjust configs
8. **Match to Task**: Choose the right configuration for each type of work

## Summary

The MCP Configurations feature provides a powerful way to optimize Claude Code execution by controlling which MCP servers are loaded. By creating task-specific configurations, you can achieve:

- **Faster startup times** (2-3s vs 5-10s for full server load)
- **Reduced context usage** (fewer MCP servers = fewer tools loaded)
- **Better focus** (only relevant tools available)
- **Team consistency** (shared configurations)
- **Cost optimization** (fewer tokens per session)

Use the graphical interface to create and manage configurations, or edit JSON files directly. Always use `--strict-mcp-config` for predictable, reproducible behavior.
