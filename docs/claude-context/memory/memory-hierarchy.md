# Memory Hierarchy

## Three-Level Structure

### 1. Enterprise Policy Memory
- **Location**: System-wide configuration files
- **Purpose**: Organization-wide instructions
- **Scope**: All users in the organization
- **Use Case**: Company-wide coding standards, security policies

### 2. Project Memory
- **Location**: `./CLAUDE.md` or `./.claude/CLAUDE.md`
- **Purpose**: Team-shared project instructions
- **Scope**: Team members via source control
- **Use Case**: Project-specific conventions, architecture decisions

### 3. User Memory
- **Location**: `~/.claude/CLAUDE.md`
- **Purpose**: Personal preferences across all projects
- **Scope**: Individual user only
- **Use Case**: Personal coding style, preferred tools

## Precedence Order
When memories conflict, the hierarchy applies in order:
1. Enterprise Policy (highest priority)
2. Project Memory
3. User Memory (lowest priority)

Higher-level memories take precedence, allowing organizations to enforce standards while users maintain personal preferences.