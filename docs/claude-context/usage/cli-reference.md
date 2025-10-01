# CLI Reference

## Basic Commands

### Interactive Mode
```bash
claude
```
Start interactive REPL session.

### Query with Initial Prompt
```bash
claude "analyze the authentication flow"
```
Start REPL with initial query.

### Headless Query
```bash
claude -p "summarize the codebase structure"
```
Execute query via SDK and exit (non-interactive).

### Continue Session
```bash
claude -c
# or
claude --continue
```
Load and continue most recent conversation.

### Resume Specific Session
```bash
claude --resume
```
Resume a specific previous session.

### Update CLI
```bash
claude update
```
Update to latest Claude Code version.

### MCP Configuration
```bash
claude mcp
```
Configure Model Context Protocol servers.

## CLI Flags

### Working Directory
```bash
claude --add-dir /path/to/dir
```
Add additional working directories.

### Print Mode
```bash
claude -p "query"
claude --print "query"
```
Print response without entering interactive mode.

### Model Selection
```bash
claude --model sonnet
claude --model opus
```
Set session model (sonnet, opus, etc.).

### Verbose Logging
```bash
claude --verbose
```
Enable detailed logging output.

### Max Turns Limit
```bash
claude --max-turns 10
```
Limit agentic turns in non-interactive mode.

## Piping Content

### Input from File
```bash
cat config.json | claude -p "explain this configuration"
```

### Input from Command
```bash
git diff | claude -p "review these changes"
```

### Multiple Inputs
```bash
cat error.log | claude -p "diagnose the error and suggest fixes"
```

## Usage Patterns

### One-off Analysis
```bash
claude -p "what does the User model look like?"
```

### Code Review
```bash
git diff main | claude -p "review this PR"
```

### Documentation Generation
```bash
claude -p "generate API documentation for src/api/users.ts"
```

### Error Diagnosis
```bash
npm test 2>&1 | claude -p "fix the failing tests"
```