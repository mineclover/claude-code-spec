# Output Styles Basics

## What are Output Styles

Output styles modify Claude Code's core system prompt to adapt behavior beyond standard software engineering tasks. They directly alter the system prompt rather than adding supplementary context.

## Built-in Styles

### 1. Default Style
Standard software engineering mode focused on:
- Code implementation
- Bug fixes
- Technical problem-solving
- Concise, direct responses

### 2. Explanatory Style
Adds educational "Insights" while working:
- Explains technical decisions
- Provides context for implementations
- Shows reasoning behind choices
- Maintains standard engineering workflow

### 3. Learning Style
Collaborative mode with enhanced interaction:
- Educational insights during work
- Identifies human contribution opportunities
- Encourages user participation
- Promotes knowledge transfer

## Usage

### View Current Style
```bash
/output-style
```

### Change Style Interactively
```bash
/output-style              # Shows menu to select style
```

### Direct Style Switch
```bash
/output-style default      # Switch to default mode
/output-style explanatory  # Switch to explanatory mode
/output-style learning     # Switch to learning mode
```

## Comparison with Other Features

Output styles are distinct from:

### CLAUDE.md Memory Files
- **Memory**: Persistent context and instructions loaded at session start
- **Output Styles**: System prompt modifications affecting core behavior

### `--append-system-prompt` Flag
- **Flag**: Temporary system prompt additions for single session
- **Output Styles**: Persistent behavior changes across sessions

### Sub-agents
- **Sub-agents**: Specialized AI assistants for specific tasks
- **Output Styles**: Behavior modifications for main Claude instance

### Custom Slash Commands
- **Slash Commands**: Quick shortcuts for specific prompts
- **Output Styles**: Comprehensive behavior transformation