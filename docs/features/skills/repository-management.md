# Skills Repository Management

## Overview

Skills Repository 관리 기능은 공식 Skills 저장소(https://github.com/mineclover/skills.git)를 로컬에 클론하고, 탐색하며, Skills를 프로젝트로 Import할 수 있는 기능을 제공합니다.

## Architecture

### Components

```
┌─────────────────────────────────────┐
│   SkillRepositoryManager Service    │
│  - Clone repository                 │
│  - Update repository                │
│  - List/search skills               │
│  - Import skills                    │
│  - Check updates                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│        IPC Handlers                  │
│  skill-repo:*                        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Preload API                     │
│  window.skillRepositoryAPI           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│       React UI                       │
│  - Repository Browser                │
│  - Skill Preview                     │
│  - Import Dialog                     │
└─────────────────────────────────────┘
```

## Configuration

### Default Settings

```typescript
{
  url: 'https://github.com/mineclover/skills.git',
  localPath: '~/.claude/skills-repo',
  branch: 'main',
  upstream: {
    url: 'https://github.com/anthropics/skills.git',
    branch: 'main'
  }
}
```

**설정 파일**: `~/.claude/skills-repo-config.json`

### Changing Repository

```typescript
await window.skillRepositoryAPI.setRepositoryConfig({
  url: 'https://github.com/your-org/skills.git',
  branch: 'develop',
});
```

## Usage

### 1. Initial Setup

```typescript
// Check repository status
const status = await window.skillRepositoryAPI.getRepositoryStatus();

if (!status.exists) {
  // Clone repository
  await window.skillRepositoryAPI.cloneRepository();
}
```

### 2. Browse Official Skills

```typescript
// List all skills
const skills = await window.skillRepositoryAPI.listOfficialSkills();

// Search skills
const results = await window.skillRepositoryAPI.searchOfficialSkills('brand');

// Get specific skill
const skill = await window.skillRepositoryAPI.getOfficialSkill('brand-guidelines');
```

### 3. Import Skills

```typescript
// Import to global scope
const imported = await window.skillRepositoryAPI.importSkill({
  skillId: 'brand-guidelines',
  scope: 'global',
});

// Import to project with custom name
const imported = await window.skillRepositoryAPI.importSkill({
  skillId: 'brand-guidelines',
  scope: 'project',
  projectPath: '/path/to/project',
  customName: 'my-brand-guide',
  overwrite: false,
});
```

### 4. Update Management

```typescript
// Update repository
await window.skillRepositoryAPI.updateRepository();

// Check for skill updates
const updateInfo = await window.skillRepositoryAPI.checkSkillUpdates(
  'brand-guidelines',
  'global'
);

if (updateInfo.hasUpdate) {
  console.log('Update available:', updateInfo.available);
}
```

## Repository Structure

### Local Clone Structure

```
~/.claude/skills-repo/
├── .git/
├── brand-guidelines/
│   ├── SKILL.md
│   ├── examples/
│   └── templates/
├── algorithmic-art/
│   └── SKILL.md
└── ...
```

### Imported Skills Structure

**Global:**
```
~/.claude/skills/
├── brand-guidelines/    ← Imported from repo
│   ├── SKILL.md
│   └── ...
└── my-custom-skill/     ← Manually created
    └── SKILL.md
```

**Project:**
```
project/
└── .claude/
    └── skills/
        ├── brand-guidelines/  ← Imported from repo
        └── project-specific/  ← Manually created
```

## API Reference

### SkillRepositoryAPI

```typescript
interface SkillRepositoryAPI {
  // Configuration
  getRepositoryConfig(): Promise<SkillRepositoryConfig>;
  setRepositoryConfig(config: Partial<SkillRepositoryConfig>): Promise<void>;
  getRepositoryStatus(): Promise<RepositoryStatus>;

  // Repository operations
  cloneRepository(): Promise<void>;
  updateRepository(): Promise<void>;

  // Browse skills
  listOfficialSkills(): Promise<OfficialSkill[]>;
  getOfficialSkill(skillId: string): Promise<OfficialSkill | null>;
  searchOfficialSkills(query: string): Promise<OfficialSkill[]>;

  // Import
  importSkill(options: SkillImportOptions): Promise<Skill>;

  // Updates
  checkSkillUpdates(
    skillId: string,
    scope: 'global' | 'project',
    projectPath?: string
  ): Promise<SkillUpdateInfo>;

  checkAllUpdates(
    scope?: 'global' | 'project',
    projectPath?: string
  ): Promise<SkillUpdateInfo[]>;

  // Events
  onRepositoryUpdated(callback: () => void): () => void;
}
```

### Data Models

```typescript
interface OfficialSkill {
  id: string;                // Directory name
  name: string;              // From frontmatter
  description: string;       // From frontmatter
  path: string;              // Full path in repo
  content: string;           // SKILL.md content
  files: string[];           // Supporting files
  source: 'official' | 'fork';
  lastCommit?: {
    hash: string;
    date: Date;
    message: string;
    author: string;
  };
}

interface RepositoryStatus {
  exists: boolean;
  path: string;
  branch?: string;
  lastUpdate?: Date;
  skillCount?: number;
}

interface SkillImportOptions {
  skillId: string;
  scope: 'global' | 'project';
  projectPath?: string;
  customName?: string;
  overwrite?: boolean;
}
```

## Workflow Examples

### Complete Import Workflow

```typescript
// 1. Clone repository (first time only)
const status = await skillRepositoryAPI.getRepositoryStatus();
if (!status.exists) {
  await skillRepositoryAPI.cloneRepository();
}

// 2. Browse available skills
const skills = await skillRepositoryAPI.listOfficialSkills();
console.log(`Found ${skills.length} skills`);

// 3. Preview skill
const skill = await skillRepositoryAPI.getOfficialSkill('brand-guidelines');
console.log(skill.description);
console.log(skill.content); // SKILL.md content

// 4. Import to project
const imported = await skillRepositoryAPI.importSkill({
  skillId: 'brand-guidelines',
  scope: 'project',
  projectPath: '/path/to/project',
});

console.log(`Imported to: ${imported.path}`);
```

### Update Check Workflow

```typescript
// 1. Update repository
await skillRepositoryAPI.updateRepository();

// 2. Check for skill updates
const installed = await skillAPI.listSkills('project', projectPath);

for (const skill of installed) {
  const updateInfo = await skillRepositoryAPI.checkSkillUpdates(
    skill.id,
    'project',
    projectPath
  );

  if (updateInfo.hasUpdate) {
    console.log(`Update available for ${skill.name}`);
    console.log(`Current: ${updateInfo.current?.hash}`);
    console.log(`Available: ${updateInfo.available?.hash}`);
  }
}
```

## Git Operations

### Commands Used

```bash
# Clone
git clone --depth 1 --branch main https://github.com/mineclover/skills.git ~/.claude/skills-repo

# Add upstream
cd ~/.claude/skills-repo
git remote add upstream https://github.com/anthropics/skills.git

# Update
git fetch origin main
git pull origin main

# Get commit info
git log -1 --format="%H|%ci|%s|%an" -- skill-name
```

## Error Handling

```typescript
try {
  await skillRepositoryAPI.cloneRepository();
} catch (error) {
  if (error.message.includes('already exists')) {
    // Repository already cloned, use update instead
    await skillRepositoryAPI.updateRepository();
  } else {
    console.error('Failed to clone:', error);
  }
}
```

## Performance Considerations

- **Shallow Clone**: Uses `--depth 1` for faster cloning
- **Lazy Loading**: Skills are parsed on-demand
- **Caching**: Repository status is cached in config
- **Background Updates**: Repository updates don't block UI

## Security

- Read-only operations on repository
- No automatic script execution
- Skills imported as plain files
- Git credentials handled by system

## Future Enhancements

1. **Sync with Upstream**: Merge changes from anthropics/skills
2. **Skill Versioning**: Track specific versions
3. **Diff View**: Show changes between versions
4. **Batch Import**: Import multiple skills at once
5. **Custom Repositories**: Support multiple skill repositories
6. **Update Notifications**: Alert when updates available

## Related Documentation

- [Skills Overview](./index.md)
- [Skills Management API](./api-reference.md)
- [Official Skills Repository](https://github.com/mineclover/skills)
- [Upstream Repository](https://github.com/anthropics/skills)
