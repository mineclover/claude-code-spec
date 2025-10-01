# Headless Basics

## Basic Invocation
```bash
claude -p "your task"
```

## Key Flags

### Core Flags
- `--print`, `-p`: Non-interactive mode for programmatic execution
- `--output-format`: Response format (text/json/stream-json)
- `--resume`, `-r`: Continue existing session with session ID

### Control Flags
- `--allowedTools`: Tool access control (comma-separated list)
- `--permission-mode`: Permission handling strategy
  - `allow`: Auto-approve all permissions
  - `deny`: Auto-reject all permissions
  - `prompt`: Interactive permission requests (default)
- `--max-turns`: Maximum conversation turns limit
- `--timeout`: Execution timeout in milliseconds

## Output Formats

### Text Format
Default human-readable output.

```bash
claude -p "List files in current directory"
```

### JSON Format
Structured output for programmatic parsing.

```bash
claude -p "Review code" --output-format json
```

### Stream JSON Format
Line-delimited JSON for real-time processing.

```bash
claude -p "Generate report" --output-format stream-json
```

## Session Management

### Starting New Session
```bash
claude -p "Initialize project setup"
```

### Resuming Session
```bash
claude -r session_abc123 -p "Continue with next step"
```

### Session Context
Multi-turn automation maintains conversation context across invocations when using `--resume` with session IDs.