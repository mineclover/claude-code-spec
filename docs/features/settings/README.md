# Settings Feature

## Overview

Settings 페이지는 플랫폼 전역 설정 및 Claude Code 프로젝트 설정을 관리합니다.

**Route:** `/settings`
**Component:** `src/pages/SettingsPage.tsx` (11 lines)
**Main Implementation:** `src/components/settings/SettingsTab.tsx` (665 lines)

## Claude Code Settings

### Settings Hierarchy

Claude Code uses a 5-level settings hierarchy:

1. **Built-in Defaults** - Hardcoded in Claude binary
2. **User Settings** (`~/.claude.json`) - Global user preferences
3. **Project Settings** (`.claude/settings.json`) - Project-specific
4. **Local Settings** (`.claude/settings.local.json`) - Git-ignored local overrides
5. **CLI Flags** - Runtime arguments (highest priority)

**Priority:** CLI Flags > Local > Project > User > Built-in

**Documentation:** `docs/claude-context/config/settings-hierarchy.md`

### Permissions Configuration

**File:** `.claude/settings.json`

**Structure:**
```json
{
  "permissions": {
    "allow": [
      "Read(./src/**)",
      "Write(./tests/**)"
    ],
    "deny": [
      "Write(./node_modules/**)",
      "Bash(rm *)"
    ]
  }
}
```

**Permission Types:**
- `allow`: Explicitly allowed operations (auto-approved)
- `deny`: Explicitly denied operations (always blocked)
- `ask`: Prompt user for confirmation (default for unlisted)

**Tool Patterns:**
```
Read(glob_pattern)
Write(glob_pattern)
Edit(glob_pattern)
Bash(command_pattern)
Glob(pattern)
Grep(pattern)
```

**Documentation:** `docs/claude-context/config/permissions-configuration.md`

### This Project's Configuration

**File:** `.claude/settings.json` (lines 1-38)

**Current Permissions:**
```json
{
  "permissions": {
    "allow": [
      "Read(./src/**)",
      "Read(./docs/**)",
      "Read(./package.json)",
      "Read(./tsconfig.json)",
      "Read(./electron.vite.config.ts)",
      "Write(./src/**)",
      "Edit(./src/**)",
      "Write(./docs/**)",
      "Edit(./docs/**)",
      "Glob(**/*)",
      "Grep(**/*)",
      "Bash(npm run build)",
      "Bash(npm run dev)",
      "Bash(npm run start)",
      "Bash(npm run lint:*)",
      "Bash(npm run format:*)",
      "Bash(npm run type-check)",
      "Bash(git status)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Write(./.env)",
      "Edit(./.env)",
      "Edit(./package-lock.json)",
      "Bash(rm:*)",
      "Bash(git push:*)",
      "Bash(npm publish:*)"
    ]
  }
}
```

**Design Philosophy:**
- Explicit allow for common operations
- Protect sensitive files (.env, package-lock.json)
- Allow git operations except push
- Allow npm scripts for development

## Implementation Details

### File Structure

**SettingsPage** (src/pages/SettingsPage.tsx): 11 lines
- Simple wrapper component
- Renders SettingsTab

**SettingsTab** (src/components/settings/SettingsTab.tsx): 665 lines
- Two modes: Application settings, Project settings
- State management for all settings
- File I/O operations
- Validation and error handling

**appSettings Service** (src/services/appSettings.ts): 219 lines
- Application-level settings management
- Platform-specific paths
- Persistent storage

**settings Service** (src/services/settings.ts): 416 lines
- Project-level settings management
- Permissions handling
- MCP configuration utilities

**IPC Handlers** (src/ipc/handlers/settingsHandlers.ts): 92 lines
- Bridges renderer and main process
- File system operations
- Settings validation

### Component Architecture

**SettingsTab Structure:**
```typescript
// lines 16-48: State Management
const [currentTab, setCurrentTab] = useState<'application' | 'project'>('application');
const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
const [projectSettings, setProjectSettings] = useState<string>('');
// ... + 30 more state variables

// lines 294-560: Application Mode
<div>
  <h2>Application Settings</h2>
  <FormGroup label="Claude Projects Path" />
  <FormGroup label="MCP Resource Paths" />
  <FormGroup label="Document Paths" />
</div>

// lines 563-665: Project Mode
<div>
  <h2>Project Settings</h2>
  <FormGroup label="Settings File Path" />
  <textarea value={projectSettings} />
  <Button onClick={handleSaveProjectSettings} />
</div>
```

### Platform Settings

**Application Settings** (appSettings.ts:10-20):

```typescript
interface AppSettings {
  claudeProjectsPath?: string;
  currentProjectPath?: string;
  currentProjectDirName?: string;
  mcpResourcePaths?: string[];     // Additional MCP config file paths
  claudeDocsPath?: string;         // Claude docs location
  controllerDocsPath?: string;     // Controller docs location
  metadataPath?: string;           // Metadata storage path
}
```

**Default Paths (macOS):**
- Claude Projects: `~/.claude/projects`
- MCP Resources: `~/.claude.json`, `~/.config/claude/mcp.json`
- Claude Docs: `~/Library/Application Support/claude-code-controller/claude-docs`
- Controller Docs: `{app}/docs/controller-docs`

## User Guide

### Application Settings

**Accessing:**
1. Navigate to `/settings`
2. Select "Application" tab (default)

**Configuration Options:**

**1. Claude Projects Path**
- Where Claude stores session logs
- Default: `~/.claude/projects`
- Change to use custom location

**2. MCP Resource Paths**
- Where to search for MCP server definitions
- Multiple paths supported
- Used by MCP Configs page to discover servers

**3. Document Paths**
- Claude docs location
- Controller docs location
- Customize for non-standard installations

### Project Settings

**Accessing:**
1. Navigate to `/settings`
2. Select "Project" tab
3. Choose project directory

**Managing Settings File:**

**View Current Settings:**
- File loaded from `.claude/settings.json`
- Shows current permissions, configurations

**Edit Settings:**
1. Edit JSON in text area
2. Validate syntax
3. Click "Save Project Settings"

**Backup and Restore:**
- Create backup before major changes
- Copy JSON to safe location
- Restore by pasting and saving

### Permission Presets

Ready-to-use permission configurations:

#### 1. Development Environment

**Purpose:** Full access for active development

```json
{
  "permissions": {
    "allow": [
      "Read(./src/**)",
      "Read(./tests/**)",
      "Read(./docs/**)",
      "Read(./package.json)",
      "Read(./tsconfig.json)",
      "Write(./src/**)",
      "Edit(./src/**)",
      "Write(./tests/**)",
      "Edit(./tests/**)",
      "Write(./docs/**)",
      "Edit(./docs/**)",
      "Glob(**/*)",
      "Grep(**/*)",
      "Bash(npm run build)",
      "Bash(npm run dev)",
      "Bash(npm run test*)",
      "Bash(npm run lint*)",
      "Bash(git status)",
      "Bash(git log*)",
      "Bash(git diff*)",
      "Bash(git add*)",
      "Bash(git commit*)"
    ],
    "deny": [
      "Write(./node_modules/**)",
      "Write(./dist/**)",
      "Write(./.git/**)",
      "Write(./.env)",
      "Bash(rm *)",
      "Bash(git push*)",
      "Bash(git reset --hard*)",
      "Bash(npm publish*)"
    ]
  }
}
```

#### 2. Read-Only Analysis

**Purpose:** Code exploration without modifications

```json
{
  "permissions": {
    "allow": [
      "Read(./src/**)",
      "Read(./tests/**)",
      "Read(./docs/**)",
      "Read(./package.json)",
      "Read(./tsconfig.json)",
      "Glob(**/*)",
      "Grep(**/*)",
      "Bash(git status)",
      "Bash(git log*)",
      "Bash(git diff*)"
    ],
    "deny": [
      "Write(**)",
      "Edit(**)",
      "Bash(rm *)",
      "Bash(npm *)",
      "Bash(git add*)",
      "Bash(git commit*)",
      "Bash(git push*)"
    ]
  }
}
```

#### 3. UI Development

**Purpose:** Frontend work only, protecting backend

```json
{
  "permissions": {
    "allow": [
      "Read(./src/**)",
      "Write(./src/components/**)",
      "Edit(./src/components/**)",
      "Write(./src/pages/**)",
      "Edit(./src/pages/**)",
      "Write(./src/styles/**)",
      "Edit(./src/styles/**)",
      "Bash(npm run dev)",
      "Bash(npm run build)",
      "Glob(**/*)",
      "Grep(**/*)"
    ],
    "deny": [
      "Write(./src/main.ts)",
      "Write(./src/preload.ts)",
      "Write(./src/ipc/**)",
      "Write(./src/services/**)",
      "Bash(git *)",
      "Bash(npm publish*)"
    ]
  }
}
```

#### 4. CI/CD Environment

**Purpose:** Automated testing and builds

```json
{
  "permissions": {
    "allow": [
      "Read(./src/**)",
      "Read(./tests/**)",
      "Read(./docs/**)",
      "Write(./tests/**)",
      "Edit(./tests/**)",
      "Bash(npm run test*)",
      "Bash(npm run build)",
      "Bash(npm run lint*)",
      "Bash(git status)",
      "Bash(git diff*)",
      "Glob(**/*)",
      "Grep(**/*)"
    ],
    "deny": [
      "Write(./src/**)",
      "Write(./dist/**)",
      "Write(./.env.production)",
      "Bash(git add*)",
      "Bash(git commit*)",
      "Bash(git push*)",
      "Bash(npm publish*)"
    ]
  }
}
```

### Default Configurations

**Recommended Defaults:**
- MCP Config: `.mcp-dev.json` for general use
- Model: `sonnet` for balanced performance
- Permissions: Use project-specific `.claude/settings.json`

## Security Best Practices

### 1. Principle of Least Privilege

Only allow operations that are actually needed:

```json
{
  "permissions": {
    "allow": [
      "Read(./src/**)",      // ✅ Specific path
      "Write(./src/features/**)"  // ✅ Even more specific
    ],
    "deny": [
      "Write(./src/config/**)"    // ✅ Protect sensitive files
    ]
  }
}
```

**Avoid:**
```json
{
  "permissions": {
    "allow": [
      "Read(**)",   // ❌ Too broad
      "Write(**)"   // ❌ Dangerous
    ]
  }
}
```

### 2. Explicit Denials

Always deny dangerous operations:

```json
{
  "permissions": {
    "deny": [
      "Write(./.env)",              // Secrets
      "Write(./.env.production)",   // Production config
      "Write(./node_modules/**)",   // Dependencies
      "Write(./.git/**)",           // Version control
      "Bash(rm *)",                 // Destructive commands
      "Bash(git push*)",            // Remote changes
      "Bash(npm publish*)"          // Package publishing
    ]
  }
}
```

### 3. Version Control

**Commit settings.json:**
```bash
git add .claude/settings.json
git commit -m "feat: Add permissions configuration"
```

**But ignore local overrides:**
```gitignore
.claude/settings.local.json
.claude/.mcp.local.json
```

### 4. Documentation

Document your permissions:

```markdown
# Claude Code Permissions

This project uses explicit permissions in `.claude/settings.json`.

## Allowed Operations
- Read all source files
- Write to src/ and tests/ only
- Run npm scripts for dev/build/test
- Git operations except push/reset

## Denied Operations
- Modifications to node_modules, dist, .git
- Destructive bash commands
- Remote git operations (push)
- Package publishing
```

### 5. Migration from `--dangerously-skip-permissions`

**Before:**
```bash
claude --dangerously-skip-permissions -p "your query"
```

**After:**
```bash
# 1. Create .claude/settings.json with explicit permissions
# 2. Use without dangerous flag
claude -p "your query"

# Permissions are now managed safely via settings.json
```

### 6. Testing Permissions

Test permissions before committing:

```bash
# Try a denied operation
claude -p "Delete all node_modules"
# Should fail gracefully

# Try an allowed operation
claude -p "Read package.json"
# Should succeed

# Try an unlisted operation
claude -p "Write to new_file.txt"
# Should prompt for confirmation
```

## Reference Links

### Core Documentation
- [Settings Hierarchy](../../claude-context/config/settings-hierarchy.md)
- [Permissions Configuration](../../claude-context/config/permissions-configuration.md)
- [Claude Execution Strategy](../../claude-context/usage/claude-execution-strategy.md)

### Related Features
- [MCP Configs](../mcp-configs/README.md)
- [Memory](../memory/README.md)
- [Execute](../execute/README.md)

### External Resources
- [Claude Code Settings](https://docs.anthropic.com/claude-code/settings)
- [Permission Patterns](https://docs.anthropic.com/claude-code/permissions)

## Troubleshooting

### Settings File Location

**Symptom:** Cannot find `.claude/settings.json`

**Solutions:**
1. Create directory: `mkdir -p .claude`
2. Create file: `touch .claude/settings.json`
3. Add minimal content: `{ "permissions": { "allow": [] } }`

### Permission Errors

**Symptom:** "Permission denied" when running Claude

**Solutions:**
1. Check `.claude/settings.json` exists
2. Add required permission to `allow` array
3. Remove from `deny` array if present
4. Test with `--dangerously-skip-permissions` to isolate issue

### Settings Not Loading

**Symptom:** Changes to settings.json not taking effect

**Solutions:**
1. Verify JSON syntax (use jsonlint.com)
2. Restart Claude CLI
3. Check file path is correct
4. Look for `.claude/settings.local.json` overrides

### MCP Servers Not Found

**Symptom:** MCP servers not appearing in configs list

**Solutions:**
1. Check Application Settings → MCP Resource Paths
2. Verify `~/.claude.json` exists
3. Add additional search paths if needed
4. Restart application

## Future Enhancements

1. **Visual Permissions Editor**
   - Drag-and-drop permission rules
   - Pattern builder for glob patterns
   - Validation with real-time feedback

2. **Permission Templates**
   - Built-in presets in UI
   - One-click apply
   - Custom template creation

3. **Settings Validation**
   - JSON schema validation
   - Pattern testing
   - Conflict detection

4. **Backup Management**
   - Auto-backup before changes
   - Restore previous versions
   - Diff view for changes

5. **Multi-Project Settings**
   - Copy settings between projects
   - Share templates with team
   - Global defaults

6. **Audit Logging**
   - Track permission changes
   - Who changed what when
   - Rollback capability

The Settings feature provides essential configuration management for both the platform and Claude Code projects, with a strong focus on security through explicit permissions.
