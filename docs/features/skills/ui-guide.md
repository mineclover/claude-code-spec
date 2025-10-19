# Skills UI Guide

## Overview

Skills UI는 Claude Code Skills를 관리하는 대화형 인터페이스입니다. Skills 탐색, Import, 편집, 삭제를 직관적인 UI로 제공합니다.

## Route

**Path:** `/skills`
**Component:** `src/pages/SkillsPage.tsx`
**Icon:** 🎯

## Features

### 1. Installed Skills Tab

설치된 Skills를 확인하고 관리합니다.

#### Scope Selection
- **Project Skills**: 현재 프로젝트의 `.claude/skills/`
- **Global Skills**: `~/.claude/skills/`

#### Skills List
- Skill 카드 형식으로 표시
- 이름, 설명, 업데이트 날짜 표시
- 지원 파일 여부 표시

#### Skill Detail
- 선택한 Skill의 상세 정보
- SKILL.md 내용 미리보기
- 편집 및 삭제 기능

### 2. Repository Browser Tab

공식 Skills 저장소를 탐색하고 Import합니다.

#### Repository Status
- 저장소 클론 상태 확인
- Skills 개수 및 마지막 업데이트 시각
- 저장소 경로

#### Repository Operations
- **Clone**: 최초 저장소 클론 (`~/.claude/skills-repo/`)
- **Update**: 저장소 업데이트 (git pull)

#### Skills Browser
- 모든 공식 Skills 목록
- 검색 기능
- Skill 상세 정보 (커밋 정보 포함)
- Import 버튼으로 즉시 Import

## UI Components

### SkillsPage

메인 페이지 컴포넌트

```tsx
<SkillsPage>
  <Header>
    <h1>Skills</h1>
    <p>Manage Claude Code Skills</p>
  </Header>

  <Tabs>
    <Tab active={activeTab === 'installed'}>Installed Skills</Tab>
    <Tab active={activeTab === 'repository'}>Repository Browser</Tab>
  </Tabs>

  {activeTab === 'installed' && (
    <InstalledSkillsView>
      <Toolbar>
        <ScopeSelector />
        <NewSkillButton />
      </Toolbar>
      <SkillsList />
      <SkillDetail />
    </InstalledSkillsView>
  )}

  {activeTab === 'repository' && (
    <RepositoryBrowserView>
      <RepositoryStatus />
      <SearchBar />
      <OfficialSkillsList />
    </RepositoryBrowserView>
  )}
</SkillsPage>
```

### Skill Card

```tsx
<SkillCard>
  <SkillHeader>
    <h3>{skill.name}</h3>
    <ScopeBadge>{skill.scope}</ScopeBadge>
  </SkillHeader>
  <Description>{skill.description}</Description>
  <SkillFooter>
    {skill.hasFiles && <Badge>📎 Has files</Badge>}
    <Date>{updatedAt}</Date>
  </SkillFooter>
  {isRepository && <ImportButton />}
</SkillCard>
```

## User Workflows

### 1. Browse and Import Skill

```
1. Navigate to /skills
2. Click "Repository Browser" tab
3. (First time) Click "Clone Repository"
4. Search or browse skills
5. Click "Import to project/global"
6. Skill copied to .claude/skills/
```

### 2. View Installed Skills

```
1. Navigate to /skills
2. Select scope (Project/Global)
3. Click on skill card
4. View skill details in panel
```

### 3. Delete Skill

```
1. Select skill from list
2. Click "Delete" button
3. Confirm deletion
4. Skill removed from filesystem
```

### 4. Update Repository

```
1. Navigate to Repository Browser tab
2. Click "Update Repository"
3. Latest skills fetched from git
4. New skills available for import
```

## State Management

### Component State

```typescript
// Tab and scope
const [activeTab, setActiveTab] = useState<'installed' | 'repository'>('installed');
const [scope, setScope] = useState<'global' | 'project'>('project');

// Skills data
const [installedSkills, setInstalledSkills] = useState<SkillListItem[]>([]);
const [officialSkills, setOfficialSkills] = useState<OfficialSkill[]>([]);
const [repoStatus, setRepoStatus] = useState<RepositoryStatus | null>(null);

// Selection
const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

// UI state
const [loading, setLoading] = useState(false);
const [repoLoading, setRepoLoading] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
```

### API Calls

```typescript
// Load installed skills
const skills = await window.skillAPI.listSkills(scope, projectPath);

// Load repository status
const status = await window.skillRepositoryAPI.getRepositoryStatus();

// Clone repository
await window.skillRepositoryAPI.cloneRepository();

// Update repository
await window.skillRepositoryAPI.updateRepository();

// List official skills
const skills = await window.skillRepositoryAPI.listOfficialSkills();

// Search official skills
const results = await window.skillRepositoryAPI.searchOfficialSkills(query);

// Import skill
await window.skillRepositoryAPI.importSkill({
  skillId: 'brand-guidelines',
  scope: 'project',
  projectPath,
});

// Delete skill
await window.skillAPI.deleteSkill(skillId, scope, projectPath);
```

## Styling

### CSS Modules

`src/pages/SkillsPage.module.css` provides:

- **Responsive Grid Layout**: Auto-fill 300px cards
- **Tab Navigation**: Active state styling
- **Card Hover Effects**: Border color and shadow
- **Scope Badges**: Color-coded by type
- **Loading States**: Centered spinners
- **Empty States**: Helpful messages

### Key Classes

```css
.container          /* Main container with padding */
.tabs               /* Tab navigation */
.activeTab          /* Active tab indicator */
.toolbar            /* Scope selector and actions */
.scopeButton.active /* Active scope button */
.skillsList         /* Grid layout for cards */
.skillCard          /* Individual skill card */
.skillCard.selected /* Selected state */
.detail             /* Skill detail panel */
.repoStatus         /* Repository status panel */
.searchInput        /* Search input */
```

### Color Scheme

```css
/* Primary */
--primary-blue: #0066cc;
--primary-blue-hover: #0052a3;

/* Backgrounds */
--bg-white: white;
--bg-gray-light: #f8f8f8;
--bg-gray: #f5f5f5;

/* Borders */
--border-light: #e5e5e5;
--border-gray: #ddd;

/* Text */
--text-dark: #1a1a1a;
--text-medium: #666;
--text-light: #999;
```

## Keyboard Shortcuts

Currently no keyboard shortcuts implemented.

**Future enhancements:**
- `Cmd/Ctrl + K`: Focus search
- `Cmd/Ctrl + N`: New skill
- `Escape`: Clear selection
- `Tab`: Switch between tabs

## Accessibility

- Semantic HTML elements
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus states on all interactive elements

## Performance

- **Lazy Loading**: Skills loaded on tab switch
- **Debounced Search**: 300ms delay on search input
- **Virtual Scrolling**: Not yet implemented (for large lists)
- **Memoization**: Not yet implemented

## Error Handling

All API calls wrapped in try-catch with toast notifications:

```typescript
try {
  await window.skillRepositoryAPI.cloneRepository();
  toast.success('Repository cloned successfully');
} catch (error) {
  console.error('Failed to clone repository:', error);
  toast.error('Failed to clone repository');
}
```

## Execute Integration

### Overview

Skills can be used directly from the Execute page for immediate testing and validation.

### How It Works

1. **Skill Selection**: Choose a skill from the dropdown (Project/Global)
2. **Auto Context Injection**: Skill content automatically prepended to query
3. **Claude Execution**: Claude receives full skill context + user query

### Context Injection Format

```markdown
# Skill Context

[Full SKILL.md content including frontmatter and instructions]

---

# User Query

[User's actual query]
```

### Usage Example

**Steps:**
1. Navigate to Execute page (`/`)
2. Select project path
3. Choose "skill-creator" from Skill dropdown
4. Enter query: "Create a skill for API documentation"
5. Click Execute

**Result:**
Claude receives the skill-creator instructions and follows them to interactively create a new skill.

### Benefits

- **GUI Testing**: Test skills without CLI
- **Quick Validation**: Immediately see if skill works as expected
- **Development Workflow**: Rapid skill development iteration
- **Context Verification**: Confirm skill instructions are loaded correctly

### API Usage

```typescript
// Programmatic skill execution
await window.claudeAPI.executeClaudeCommand(
  projectPath,
  'Your query here',
  undefined, // sessionId
  undefined, // mcpConfig
  'sonnet',  // model
  'skill-creator', // skillId
  'project'  // skillScope
);
```

## Completed Features

### Phase 1: Editor ✅
- [x] Skill creation modal
- [x] YAML + Markdown editor
- [x] Live preview
- [x] Validation

### Phase 2: Execute Integration ✅
- [x] Skill selection in Execute page
- [x] Automatic context injection
- [x] Project/Global scope support
- [x] API-level integration

## Future Enhancements

### Phase 3: Advanced Features
- [ ] Skill versioning
- [ ] Diff viewer (compare with repository)
- [ ] Update notifications
- [ ] Batch operations

### Phase 4: UX Improvements
- [ ] Drag-and-drop import
- [ ] Skill templates
- [ ] Quick actions menu
- [ ] Keyboard shortcuts
- [ ] Multi-skill execution

## Related Documentation

- [Skills Overview](./index.md)
- [Repository Management](./repository-management.md)
- [Skills API Reference](../../../src/types/api/skill.ts)
