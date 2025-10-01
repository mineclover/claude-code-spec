# Slash Commands

## Built-in Commands

### Session Management

#### /clear
Clear conversation history.

#### /rewind
Rewind conversation to previous state.

#### /continue
Continue from previous conversation (same as `claude -c`).

### Configuration

#### /config
Open Settings interface.

#### /model
Select AI model for current session.

#### /permissions
View and update permission settings.

#### /memory
Edit memory files (CLAUDE.md).

### Development Tools

#### /add-dir
Add working directories to current session.

#### /agents
Manage AI subagents and view available agents.

#### /mcp
Manage Model Context Protocol server connections.

#### /review
Request code review from Claude.

#### /vim
Enter vim mode for editing.

### Project Management

#### /init
Initialize Claude Code project configuration.

#### /terminal-setup
Install key binding for terminal integration.

### Information

#### /help
Get usage help and documentation.

#### /status
Show system status and connection info.

#### /cost
Show token usage and cost information.

### Account Management

#### /login
Switch Anthropic accounts.

#### /logout
Sign out from current account.

### Support

#### /bug
Report bugs to Anthropic.

## Custom Slash Commands

### Creating Custom Commands

Create custom commands in project or personal directories:

**Project-level:**
```bash
.claude/slash-commands/my-command.md
```

**Personal-level:**
```bash
~/.claude/slash-commands/my-command.md
```

### Command Structure

```markdown
# Command Name

Command prompt text that Claude will receive.

Can include:
- Instructions
- ${arg} for command arguments
- Bash command results: `git status`
- File references: @path/to/file.md
```

### Example: Custom Review Command

**.claude/slash-commands/review-pr.md:**
```markdown
# Review PR

Review the following changes and provide:
1. Code quality assessment
2. Potential bugs or issues
3. Suggestions for improvement

Changes:
`git diff main`

Focus areas: ${arg}
```

Usage:
```
/review-pr security and performance
```

## Discovering Commands

### List All Commands
```
/
```
Type slash alone to see available commands.

### Command Help
```
/help
```
Get detailed help for all commands.