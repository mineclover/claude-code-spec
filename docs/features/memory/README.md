# Memory Feature - CLAUDE.md Editor

## Overview

Memory 기능은 CLAUDE.md 파일의 Managed Regions를 편집하여 Claude Code에게 제공할 컨텍스트를 관리합니다.

**Route:** `/memory`  
**Component:** `src/pages/MemoryPage.tsx` (597 lines)  
**Core Library:** `src/lib/MarkdownEditor.ts` (1419 lines)

## Claude Code Memory System

### CLAUDE.md File

Claude Code는 프로젝트 루트의 `CLAUDE.md` 파일을 자동으로 로드합니다:
- 프로젝트 개요, 아키텍처, 가이드라인 포함
- Claude에게 제공되는 초기 컨텍스트
- 일반 마크다운과 특수 Managed Regions 혼합

### Context References

두 가지 참조 방식:

**Direct Reference** (백틱 없음):
```markdown
@context/config/permissions-configuration.md
```
→ 파일 전체를 컨텍스트에 포함

**Indirect Reference** (백틱 있음):
```markdown
- `@context/config/permissions-configuration.md`
  - 권한 설정 방법 설명
  - allow, deny, ask 패턴 사용
```
→ 설명만 포함, 파일 내용은 필요시 Claude가 요청

### Managed Regions

특수 주석으로 표시된 편집 가능한 영역:

```markdown
<!-- MEMORY_START: references -->
## References

@context/config/permissions-configuration.md
@context/usage/cli-reference.md
<!-- MEMORY_END: references -->
```

**Benefits:**
- 동적 컨텍스트 구성
- 중복 참조 방지
- 유효성 검사 가능
- 재구성(reorganize) 지원

## Related Documentation

- [MEMORY_EDITOR.md](../../MEMORY_EDITOR.md)
- [MANAGED_REGIONS_SPEC.md](../../MANAGED_REGIONS_SPEC.md)
- [Claude Context - Memory](../../claude-context/memory/)

## Implementation Details

### MarkdownEditor Class

**File:** `src/lib/MarkdownEditor.ts`  
**Lines:** 1419

Core library for parsing and manipulating CLAUDE.md files.

#### Region Management

**findAllManagedRegions()**: Find all regions in document
```typescript
// Returns array of ManagedRegion objects with name, start/end lines, content
const regions = editor.findAllManagedRegions();
```

**addManagedRegion()**: Create new region
```typescript
editor.addManagedRegion(name: string, content: string, position: 'start' | 'end' | { after: string });
```

**updateManagedRegionContent()**: Update region content
```typescript
editor.updateManagedRegionContent(name: string, newContent: string);
```

**deleteManagedRegion()**: Remove region
```typescript
editor.deleteManagedRegion(name: string);
```

#### Item Parsing

**parseRegionItems()**: Parse items within a region
```typescript
const items = editor.parseRegionItems(regionName: string);
// Returns: HeadingItem[], DirectRefItem[], IndirectRefItem[], CodeBlockItem[], TextItem[]
```

Supports:
- Headings (`##`, `###`, etc.)
- Direct refs (`@context/...`)
- Indirect refs with multi-line bullet descriptions
- Code blocks with language tags
- Plain text

**Item Types:**
```typescript
type RegionItem = 
  | HeadingItem        // ## Heading text
  | DirectRefItem      // @context/path.md
  | IndirectRefItem    // - `@context/path.md` + description bullets
  | CodeBlockItem      // ```language\ncode\n```
  | TextItem           // Any other text
```

#### Item Manipulation

**addRegionItem()**: Add new item to region
```typescript
editor.addRegionItem(regionName: string, item: Omit<RegionItem, 'id' | 'line' | 'endLine'>, position: 'start' | 'end' | number);
```

**updateRegionItem()**: Modify existing item
```typescript
editor.updateRegionItem(regionName: string, itemId: string, newItem: Partial<Omit<RegionItem, 'id' | 'line' | 'endLine'>>);
```

**deleteRegionItem()**: Remove item from region
```typescript
editor.deleteRegionItem(regionName: string, itemId: string);
```

**Moving Items**: Reorder by updating via JSON
```typescript
// Swap items in array then update
const newItems = [...items];
[newItems[i], newItems[j]] = [newItems[j], newItems[i]];
editor.updateRegionFromJSON(regionName, { items: newItems });
```

#### JSON Interop

**regionToJSON()**: Export region as JSON
```typescript
const json = editor.regionToJSON(regionName: string);
// Returns: { name: string, items: RegionItem[] }
```

**updateRegionFromJSON()**: Import region from JSON
```typescript
editor.updateRegionFromJSON(regionName: string, data: { items: RegionItem[] });
```

**importRegionsFromJSON()**: Bulk import
```typescript
editor.importRegionsFromJSON(data: { regions: { name: string, items: RegionItem[] }[] });
```

#### Validation & Auto-fix

**findDuplicateReferences()**: Detect duplicate @context refs
```typescript
const duplicates = editor.findDuplicateReferences();
// Returns: Map<string, number[]> (path -> line numbers)
```

**removeDuplicateReferences()**: Auto-remove duplicates (keeps first)
```typescript
editor.removeDuplicateReferences();
```

**removeInvalidReferences()**: Auto-remove non-existent refs
```typescript
await editor.removeInvalidReferences(projectPath: string);
```

Note: Invalid reference detection is implemented in MemoryPage.tsx using `extractContextReferences()` and `contextPathToFilePath()`.

**autoFix()**: Complete auto-fix (duplicates + invalid + reorganize)
```typescript
await editor.autoFix(projectPath: string);
```

#### Organization

**reorganizeManagedRegions()**: Move all regions to bottom
```typescript
editor.reorganizeManagedRegions();
```

Steps:
1. Extract all managed regions
2. Remove from document
3. Add separator (`---`)
4. Append all regions at end
5. Ensure proper spacing

**areRegionsAtBottom()**: Check if reorganization needed
```typescript
const needsReorg = !editor.areRegionsAtBottom();
```

Note: `areRegionsAtBottom()` checks for the heading "## Memory 관리 영역" before regions, while `reorganizeManagedRegions()` adds a `---` separator. The CLAUDE.md file in this project uses the heading pattern.

### MemoryPage Component

**File:** `src/pages/MemoryPage.tsx`  
**Lines:** 597

React UI for editing CLAUDE.md.

**State Variables:**
- `content`: Full document content
- `editor`: MarkdownEditor instance
- `managedRegions`: Array of regions
- `selectedRegion`: Currently selected region
- `expandedRegions`: Set of expanded region names
- `duplicateRefs`: Map of duplicate references
- `invalidRefs`: Array of invalid references
- `isReorganizeNeeded`: Boolean flag

**Key Features:**
- Create/delete managed regions
- Expand/collapse regions for editing
- Three editing modes:
  1. Structured (add/edit items individually)
  2. JSON (edit region as JSON)
  3. Raw (edit markdown directly)
- Validation warnings
- Auto-fix button
- Reorganize button

### RegionEditor Component

**Location:** Inline component within MemoryPage.tsx (lines 308-597)

**Features:**
- Item list with icons
- Add item menu (heading, direct-ref, indirect-ref, code-block)
- Move items up/down
- Delete items
- JSON view with editor
- Export to JSON file
- Raw markdown editor

### Parsing Details

**Direct Reference Pattern:**
```typescript
/^\s*(@context\/[^\s`]+)\s*$/
```
Must be:
- Standalone line (allows leading/trailing whitespace)
- No backticks
- Path cannot contain spaces or backticks

**Indirect Reference Multi-line Pattern:**
```typescript
/^\s*`(@context\/[^`]+)`\s*$/   // Path line (with backticks)
/^\s*-\s+(.+)$/                 // Description bullet lines
```

Format:
- Path line: `` `@context/path.md` ``
- Empty lines allowed between path and description
- Description: Multiple bullet lines starting with `-`
- Joins description bullets with `\n`

**Code Block Pattern:**
```typescript
/^```(\w*)$/           // Start (language optional, captured)
line.trim() === '```'  // End
```

Captures language (optional, defaults to 'text') and content between markers.

### Stable Item IDs

Each item gets a stable ID using FNV-1a hash:

```typescript
function generateStableItemId(type: string, content: string): string {
  // Simple hash function (FNV-1a)
  let hash = 2166136261;
  const str = `${type}:${content}`;

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  // Convert to hex and take first 8 chars
  return `${type}-${(hash >>> 0).toString(16).substring(0, 8)}`;
}
```

**Content Format for Hashing:**
- Heading: `"heading:References"`
- Direct ref: `"direct-ref:@context/file.md"`
- Indirect ref: `"indirect-ref:@context/file.md:Description text"`
- Code block: `"code-block:bash:npm run dev"`

**Why Stable IDs?**
- Enables item-level manipulation
- Survives re-parsing
- Cache invalidation
- React key stability

### Validation System

**Duplicate Detection:**
```typescript
const duplicates = md.findDuplicateReferences();
// Map { "@context/file.md" => [10, 45, 78] }
```

Shows warning with all duplicate locations.

**Invalid References:**
```typescript
for (const ref of allRefs) {
  const filePath = MarkdownEditor.contextPathToFilePath(ref.path, projectPath);
  try {
    await window.fileAPI.readFile(filePath);
  } catch {
    invalid.push(ref);
  }
}
```

Checks if referenced files exist in `docs/claude-context/`.

## User Guide

### Accessing the Editor

1. Navigate to `/memory`
2. Select project (if not already set)
3. CLAUDE.md loads automatically

### Creating a Managed Region

**Method 1: UI Form**
1. Enter region name (e.g., "references", "tools")
2. Click "Create"
3. Region created with default template

**Method 2: Structured Editing**
1. Click "Add Item" in existing region
2. Choose item type
3. Fill in details
4. Saves automatically

**Method 3: JSON Editing**
1. Click "{ } JSON View"
2. Edit JSON structure
3. Click "Save JSON"

### Editing a Region

**Structured Mode:**
- Click ➕ Add Item
- Select type (heading, direct-ref, indirect-ref, code-block)
- Edit fields
- Use ⬆️⬇️ to reorder
- Use 🗑️ to delete

**JSON Mode:**
- Toggle JSON view
- Edit items array
- Save when done

**Raw Mode:**
- Edit markdown directly in text area
- Full control over formatting

### Managing Multiple Regions

- Click region header to expand/collapse
- Multiple regions can be expanded simultaneously
- Each region is independent

### Validation and Auto-Fix

**Check for Issues:**
- Duplicate references highlighted with line numbers
- Invalid references listed

**Auto-Fix:**
1. Click "✨ Auto Fix" button
2. Confirms action
3. Removes duplicates (keeps first occurrence)
4. Removes invalid references
5. Reorganizes regions to bottom

**Manual Fix:**
- Edit affected items directly
- Delete duplicates manually
- Fix file paths for invalid refs

### Reorganizing Regions

**When Needed:**
- Regions mixed with regular content
- Want cleaner document structure

**How to Reorganize:**
1. Notice "Reorganize" button appears
2. Click "Reorganize"
3. All regions move to document bottom
4. Separator (`---`) added before regions

## Best Practices

### 1. Region Organization

**Recommended Regions:**
- `references` - File references
- `tools` - Development tools
- `architecture` - System design notes
- `conventions` - Coding standards

**Example:**
```markdown
<!-- MEMORY_START: references -->
## References

@context/config/permissions-configuration.md
@context/usage/cli-reference.md
<!-- MEMORY_END: references -->

<!-- MEMORY_START: tools -->
## Development Tools

- `@context/usage/claude-execution-strategy.md`
  - Claude 실행 전략 문서
  - 권한 설정과 MCP 프리셋 가이드
<!-- MEMORY_END: tools -->
```

### 2. Direct vs Indirect References

**Use Direct References when:**
- File is always needed
- Content is short (< 500 lines)
- Core configuration or architecture

**Use Indirect References when:**
- File is large
- Content needed only sometimes
- Providing metadata/description is more useful

### 3. Avoiding Duplicates

- Check validation warnings regularly
- Use Auto Fix periodically
- Organize related refs in same region

### 4. Context Optimization

- Keep CLAUDE.md under 10KB for fast loading
- Use indirect refs for large docs
- Remove unused references
- Reorganize to keep managed regions at bottom

### 5. Version Control

```gitignore
# Commit CLAUDE.md
CLAUDE.md

# But warn on large changes
# Review diffs carefully before committing
```

**Tip:** Run Auto Fix before committing to ensure clean state.

## Performance Considerations

### Caching

MarkdownEditor caches parsed regions:
- Cache invalidated on any modification
- Parsing is fast (< 10ms for typical CLAUDE.md)
- Re-parsing only happens when needed

### File I/O

- Reads CLAUDE.md once on page load
- Writes on each save operation
- No auto-save (manual save required)

### Validation

- Duplicate detection: O(n) where n = number of refs
- Invalid ref checking: O(n × file I/O)
- Run manually to avoid performance impact

## Troubleshooting

### Region Not Appearing

**Symptom:** Created region doesn't show up

**Solutions:**
1. Check region markers are correct:
   ```markdown
   <!-- MEMORY_START: name -->
   <!-- MEMORY_END: name -->
   ```
2. Names must match exactly
3. Reload page

### Validation Errors

**Symptom:** "Invalid reference" warnings

**Solutions:**
1. Verify file exists in `docs/claude-context/`
2. Check path spelling
3. Ensure file extension is `.md`
4. Use Auto Fix to remove

### Auto-Fix Not Working

**Symptom:** Auto Fix doesn't remove duplicates

**Solutions:**
1. Check console for errors
2. Ensure write permissions to CLAUDE.md
3. Try manual deletion
4. Reload page and retry

### Items Not Saving

**Symptom:** Changes revert after save

**Solutions:**
1. Check item format is valid
2. Ensure no JSON syntax errors (in JSON mode)
3. Save region before navigating away
4. Check file write permissions

## Related Files

**Source Code:**
- `src/lib/MarkdownEditor.ts` - Core parsing/editing logic (includes RegionItem type definitions)
- `src/pages/MemoryPage.tsx` - React UI
- `src/lib/types.ts` - Stream event type definitions

**Documentation:**
- `docs/MEMORY_EDITOR.md` - User guide
- `docs/MANAGED_REGIONS_SPEC.md` - Technical specification
- `docs/claude-context/memory/` - Claude Code memory docs

**Configuration:**
- `CLAUDE.md` - The file being edited
- `docs/claude-context/` - Referenced files directory

## Future Enhancements

1. **Live Preview**: See rendered CLAUDE.md as you edit
2. **Search**: Find references quickly
3. **Templates**: Pre-defined region templates
4. **Diff View**: Compare before/after changes
5. **Undo/Redo**: Multi-level undo
6. **Drag-and-Drop**: Reorder items visually
7. **Syntax Highlighting**: Color-code different item types
8. **Auto-Save**: Save changes automatically
9. **Conflict Detection**: Multi-user editing warnings
10. **Import from Other Files**: Bulk import references

The Memory feature provides powerful tools for managing CLAUDE.md context, enabling fine-grained control over what Claude sees about your project.
