# Memory Features

## Memory Imports
Include content from other files using `@` syntax.

### Syntax
```markdown
@path/to/file.md
```

### Path Types
- **Same directory**: `@README`, `@local-file.md`
- **Subdirectory**: `@docs/instructions.md`, `@context/memory/guide.md`
- **Absolute paths**: `@~/.claude/shared.md`

### Import Limitations
- Maximum 5 hops (prevents infinite recursion)
- Imports ignored inside code blocks/spans
- Paths evaluated from the importing file's location

**Important**: While 5-hop recursion is supported, imported files are only guaranteed to load when directly referenced from CLAUDE.md. Indirect references (e.g., CLAUDE.md → index.md → sub-file.md) may not always load. For critical context files, add direct references in CLAUDE.md.

## Memory Discovery

### View Loaded Memories
Use the `/memory` command to see all currently loaded memory files.

### Recursive Loading
Claude Code automatically:
1. Starts from current working directory
2. Reads all CLAUDE.md files up the directory tree
3. Stops at file system root
4. Loads discovered memories in hierarchy order