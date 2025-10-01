# Headless Mode Reference

## Official Documentation
- [Claude Code Headless Mode](https://docs.claude.com/en/docs/claude-code/headless.md)

## Key Concepts from Documentation

### Basic Command Structure
```bash
claude -p "your prompt here" \
  --allowedTools "Bash,Read" \
  --permission-mode acceptEdits
```

### Output Formats
- `text` (default): Plain text output
- `json`: Structured response with metadata
- `stream-json`: Real-time streaming messages

### Session Management
- `--resume`, `-r`: Resume by session ID
- Multi-turn conversations in automated contexts

### Tool Control
- `--allowedTools`: Whitelist permitted tools
- `--permission-prompt-tool`: Handle permission requirements