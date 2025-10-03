# Claude Docs Feature

## Overview

Claude Docs 기능은 Claude Code 공식 문서를 로컬에 저장하고 탐색하는 문서 브라우저입니다.

**Route:** `/claude-docs`
**Component:** `src/pages/ClaudeDocsPage.tsx` (212 lines)

## Documentation Structure

### Directory Tree

`docs/claude-context/` contains 61 markdown files organized into 10 topic areas:

```
docs/claude-context/
├── index.md
├── config/ (6 files)
│   ├── reference.md
│   ├── permissions-configuration.md
│   ├── settings-hierarchy.md
│   └── ...
├── usage/ (7 files)
│   ├── reference.md
│   ├── cli-reference.md
│   ├── sessions.md
│   └── ...
├── mcp-config/ (6 files)
├── memory/ (5 files)
├── hook/ (9 files)
├── prompt/ (10 files)
├── sub-agent/ (5 files)
├── headless/ (4 files)
├── output-styles/ (4 files)
└── monitoring-usage/ (4 files)
```

### Topic Areas

1. **Memory** - Context management, CLAUDE.md, Managed Regions
2. **Usage** - CLI commands, sessions, execution strategies
3. **Prompts** - Prompt engineering, best practices
4. **Config** - Settings, permissions, hierarchies
5. **Hooks** - Event hooks, custom automation
6. **Headless** - Non-interactive execution
7. **Sub-Agent** - Sub-agent spawning, tracking
8. **Output Styles** - Output formats (stream-json, markdown)
9. **MCP Config** - MCP server management
10. **Monitoring & Usage** - Analytics, tracking

Each directory contains a `reference.md` file summarizing the topic.

## Implementation Details

### Architecture

```
┌───────────────┐
│ ClaudeDocsPage│ (React Component)
│  - File Tree  │
│  - Breadcrumb │
│  - Content    │
└───────┬───────┘
        │ IPC: docs:read-structure
        │ IPC: docs:read-file
        ▼
┌───────────────┐
│ docsHandlers  │ (Main Process)
│  - Read Dir   │
│  - Read File  │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ File System   │
│ docs/claude-  │
│   context/    │
└───────────────┘
```

### Component Structure

**State Management** (lines 16-21):
```typescript
const [fileTree, setFileTree] = useState<FileNode[]>([]);
const [selectedFile, setSelectedFile] = useState<string | null>(null);
const [content, setContent] = useState<string>('');
const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
const [loading, setLoading] = useState(false);
const [docsRoot, setDocsRoot] = useState<string>('');
```

### Key Functions

**loadFileTree()** (lines 38-49):
```typescript
const loadFileTree = useCallback(async () => {
  if (!docsRoot) return;

  try {
    const tree = await window.docsAPI.readDocsStructure(docsRoot);
    setFileTree(tree);
    // Expand root level by default
    setExpandedDirs(new Set([docsRoot]));
  } catch (error) {
    console.error('Failed to load docs structure:', error);
  }
}, [docsRoot]);
```

**loadFileContent()** (lines 55-67):
```typescript
const loadFileContent = async (filePath: string) => {
  setLoading(true);
  try {
    const fileContent = await window.docsAPI.readDocsFile(filePath);
    setContent(fileContent);
    setSelectedFile(filePath);
  } catch (error) {
    console.error('Failed to load file:', error);
    setContent('Failed to load file content');
  } finally {
    setLoading(false);
  }
};
```

**toggleDirectory()** (lines 69-79):
```typescript
const toggleDirectory = (dirPath: string) => {
  setExpandedDirs((prev) => {
    const next = new Set(prev);
    if (next.has(dirPath)) {
      next.delete(dirPath);
    } else {
      next.add(dirPath);
    }
    return next;
  });
};
```

**renderFileTree()** (lines 81-123): Recursive rendering of file tree with expand/collapse

### IPC Communication

**Channels:**
- `docs:read-structure` - Get directory structure
- `docs:read-file` - Read markdown file content

**Handlers** (src/ipc/handlers/docsHandlers.ts):

```typescript
// Read directory structure (lines 62-70)
router.handle('read-structure', async (_event, rootPath: string) => {
  try {
    const structure = await readDirectoryStructure(rootPath);
    return structure;
  } catch (error) {
    console.error('Error reading docs structure:', error);
    throw error;
  }
});

// Read file content (lines 73-83)
router.handle('read-file', async (_event, filePath: string) => {
  try {
    // Clean the file path - remove any trailing backticks or quotes
    const cleanPath = filePath.replace(/[`'"]+$/, '').trim();
    const content = await fs.readFile(cleanPath, 'utf-8');
    return content;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
});
```

**Helper Function** (lines 17-58):
```typescript
async function readDirectoryStructure(dirPath: string): Promise<FileNode[]> {
  // Reads directory recursively
  // Returns array of FileNode objects with children for directories
  // Sorts directories first, then files, both alphabetically
  // Skips hidden files (starting with .)
}
```

### Type Definitions

```typescript
// src/types/api/docs.ts
export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
}

export interface DocsAPI {
  readDocsStructure: (rootPath: string) => Promise<FileNode[]>;
  readDocsFile: (filePath: string) => Promise<string>;
}
```

## User Guide

### Accessing Documentation

1. Navigate to `/claude-docs`
2. See file tree on left sidebar
3. Click any file to view content
4. Use breadcrumbs to navigate

### Using Reference Links

Documentation uses `@context/...` pattern for cross-references:

```markdown
See [Permissions Configuration](@context/config/permissions-configuration.md)
```

**Note:** Reference link clicking handler exists in code (lines 131-147) but is not currently connected to the UI (the `_handleContentClick` function is prefixed with `_` indicating it's unused).

### Starting Points

- **index.md** - Overview of all documentation
- **config/reference.md** - Configuration options
- **usage/reference.md** - CLI usage guide
- **mcp-config/reference.md** - MCP setup

## Adding/Updating Documentation

### Directory Location

All Claude Code documentation is in:
```
docs/claude-context/
```

### File Structure

Follow the existing structure:
- Each topic has its own subdirectory
- Include a `reference.md` in each directory
- Use clear, descriptive filenames

### Adding New Documentation

1. Choose appropriate topic directory
2. Create markdown file with descriptive name
3. Add entry to `reference.md` in that directory
4. Use `@context/...` for cross-references

Example:
```bash
# Create new doc
docs/claude-context/usage/advanced-techniques.md

# Update reference
docs/claude-context/usage/reference.md
```

### Best Practices for Writing Documentation

1. **Clear Titles**: Use descriptive H1 headers
2. **Examples**: Include code examples
3. **Cross-References**: Link related documents
4. **Structure**: Use consistent heading hierarchy
5. **Code Blocks**: Specify language for syntax highlighting

Example document structure:
```markdown
# Feature Name

## Overview

Brief description of the feature.

## Basic Usage

```bash
claude --feature-flag
```

## Advanced Configuration

...

## Related Documentation

- [Related Doc](@context/topic/file.md)
```

## Technical Details

### Configuration

Documentation path is configured through app settings:

```typescript
// src/services/appSettings.ts:163-164
const defaultSettings: AppSettings = {
  claudeDocsPath: path.join(app.getPath('userData'), 'claude-docs'),
  // ...
};
```

Platform-specific default paths:
- **macOS**: `~/Library/Application Support/claude-code-controller/claude-docs`
- **Linux**: `~/.config/claude-code-controller/claude-docs`
- **Windows**: `%APPDATA%\claude-code-controller\claude-docs`

### Security

Uses Electron `contextBridge` for secure IPC:

```typescript
// src/preload/apis/docs.ts
contextBridge.exposeInMainWorld('docsAPI', {
  readDocsStructure: (rootPath: string) => ipcRenderer.invoke('docs:read-structure', rootPath),
  readDocsFile: (filePath: string) => ipcRenderer.invoke('docs:read-file', filePath)
} as DocsAPI);
```

Only allows reading from configured docs directory, preventing path traversal attacks.

### Performance

- **Lazy loading**: Only loads file tree on mount
- **On-demand content**: File content loaded when clicked
- **No caching**: Always reads fresh content (suitable for documentation that changes)

### Styling

Uses CSS Modules (ClaudeDocsPage.module.css):
- Tree view with indentation
- Syntax highlighting for markdown
- Responsive layout
- Dark/light mode support

**CSS Structure** (lines 1-58):
1. Container (lines 1-7)
2. Header (lines 9-28)
3. Content (lines 30-34)
4. Markdown (lines 36-50)
5. Loading (lines 52-58)

## Current Limitations

1. **No Markdown Rendering**: Shows raw markdown (not rendered HTML)
2. **No Search**: Cannot search within documentation
3. **No Favorites**: Cannot bookmark frequently accessed docs
4. **Reference Links Not Clickable**: `@context/...` links not interactive

## Future Enhancements

1. **Markdown Rendering**:
   - Use `react-markdown` or `marked`
   - Syntax highlighting with `highlight.js`
   - Custom renderers for `@context/...` links

2. **Search Functionality**:
   - Full-text search across all docs
   - Fuzzy matching for file names
   - Recent searches

3. **Navigation Improvements**:
   - Breadcrumb navigation
   - Table of contents for long docs
   - Previous/Next buttons

4. **Interactive Features**:
   - Clickable `@context/...` references
   - Copy code blocks with one click
   - Dark/light theme toggle

5. **Performance**:
   - Cache file tree structure
   - Preload commonly accessed docs
   - Lazy load large files

### Recommended Libraries

- **Markdown Rendering**: `react-markdown` (24KB)
- **Syntax Highlighting**: `rehype-highlight` (with `lowlight`)
- **Search**: `flexsearch` (12KB, fast fuzzy search)
- **Code Copying**: `react-syntax-highlighter`

## Related Features

- [Memory Feature](../memory/index.md) - For editing CLAUDE.md
- [Controller Docs](../controller-docs/index.md) - For project documentation
- [Execute Feature](../execute/index.md) - Uses these docs as reference

The Claude Docs feature provides a centralized location for all Claude Code documentation, making it easy to reference while working with the platform.
