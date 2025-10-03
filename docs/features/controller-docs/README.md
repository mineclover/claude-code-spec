# Controller Docs Feature

## Overview

Controller Docs 기능은 이 프로젝트 자체(Claude Code Controller)의 문서를 관리하고 표시하는 페이지입니다.

**Route:** `/controller-docs`
**Component:** `src/pages/ControllerDocsPage.tsx` (67 lines)

## Current Implementation

### Basic File Display

Currently displays contents of `glossary.md`:

```typescript
// src/pages/ControllerDocsPage.tsx:5-66
export const ControllerDocsPage: React.FC = () => {
  const [glossary, setGlossary] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [docsPath, setDocsPath] = useState<string>('');

  // Load docs path from settings (lines 11-23)
  useEffect(() => {
    const loadDocsPath = async () => {
      try {
        const savedPath = await window.appSettingsAPI.getControllerDocsPath();
        const defaultPaths = await window.appSettingsAPI.getDefaultPaths();
        const pathToUse = savedPath || defaultPaths.controllerDocsPath;
        setDocsPath(pathToUse);
      } catch (error) {
        console.error('Failed to load docs path:', error);
      }
    };
    loadDocsPath();
  }, []);

  // Load glossary when docsPath is available (lines 25-44)
  const loadGlossary = useCallback(async () => {
    if (!docsPath) return;

    setLoading(true);
    try {
      const glossaryPath = `${docsPath}/glossary.md`;
      const content = await window.docsAPI.readDocsFile(glossaryPath);
      setGlossary(content);
    } catch (error) {
      console.error('Failed to load glossary:', error);
      setGlossary('# Failed to load glossary\n\nPlease check the console for errors.');
    } finally {
      setLoading(false);
    }
  }, [docsPath]);

  useEffect(() => {
    loadGlossary();
  }, [loadGlossary]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Controller Docs</h1>
          <p className={styles.subtitle}>용어집 및 메타 관리</p>
        </div>
      </div>
      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <div className={styles.markdown}>
            <pre className={styles.markdownContent}>{glossary}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
```

### IPC Communication

Uses the same `docsAPI` as Claude Docs feature:

**IPC Channel:** `docs:read-file`
**Handler:** `src/ipc/handlers/docsHandlers.ts` (lines 73-83)

```typescript
// Read file content
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

### Rendering Approach

**Current:** Raw markdown displayed in nested structure:
- Wrapper: `<div className={styles.markdown}>` (line 71)
- Content: `<pre className={styles.markdownContent}>` (line 72)

**Future:** Use markdown renderer like `react-markdown`

## Documentation Structure

### Current Files

Located in `docs/controller-docs/`:
- `glossary.md` (2,111 bytes) - Terms and definitions
- `project-context.md` (4,837 bytes) - Project overview

### Project-Wide Documentation

Total of **87 markdown files** in the project:

```
docs/
├── controller-docs/ (2 files)
│   ├── glossary.md
│   └── project-context.md
├── claude-context/ (60 files)
│   ├── config/ (6)
│   ├── usage/ (7)
│   ├── mcp-config/ (6)
│   ├── memory/ (5)
│   ├── hook/ (9)
│   ├── prompt/ (10)
│   ├── sub-agent/ (5)
│   ├── headless/ (4)
│   ├── output-styles/ (4)
│   └── monitoring-usage/ (4)
├── features/ (9 features, 10 files)
│   ├── index.md
│   ├── execute/
│   ├── index-page/
│   ├── claude-projects/
│   ├── mcp-configs/
│   ├── claude-docs/
│   ├── controller-docs/
│   ├── memory/
│   └── settings/
├── visualization/ (5 files)
│   └── session-logs/
└── root level (13 files)
    ├── ARCHITECTURE.md
    ├── SETUP.md
    ├── CLAUDE.md
    └── ...
```

## Implementation Details

### Component Architecture

**State** (lines 6-8):
```typescript
const [glossary, setGlossary] = useState<string>('');
const [loading, setLoading] = useState(false);
const [docsPath, setDocsPath] = useState<string>('');
```

**Loading Sequence:**
1. Component mounts
2. First `useEffect` loads docsPath from settings (lines 11-23)
3. Settings API provides saved or default path
4. Second `useEffect` triggers when docsPath changes (lines 42-44)
5. `loadGlossary` callback constructs full path (line 44)
6. IPC call to `docs:read-file` with full path (line 45)
7. Glossary content set to state (line 46)

### Settings API Integration

Documentation path retrieved from app settings:

```typescript
// src/services/appSettings.ts:134-174
getDefaultPaths(): {
  claudeProjectsPath: string;
  mcpConfigPath: string;
  claudeDocsPath: string;
  controllerDocsPath: string;
  metadataPath: string;
} {
  const homeDir = app.getPath('home');
  const platform = process.platform;

  // Get project root - use app path in development, user's home in production
  const isDev = !app.isPackaged;
  const appPath = app.getAppPath();
  const projectRoot = isDev ? appPath : path.join(homeDir, 'Documents', 'claude-code-spec');

  // ... platform-specific logic ...

  // Document paths (relative to project root)
  const claudeDocsPath = path.join(projectRoot, 'docs', 'claude-context');
  const controllerDocsPath = path.join(projectRoot, 'docs', 'controller-docs');
  const metadataPath = path.join(projectRoot, 'docs', 'claude-context-meta');

  return {
    claudeProjectsPath,
    mcpConfigPath,
    claudeDocsPath,
    controllerDocsPath,
    metadataPath,
  };
}
```

**Platform Defaults:**
- **Development**: App path + `docs/controller-docs/`
- **Production**: `~/Documents/claude-code-spec/docs/controller-docs/`
- Path separator handled automatically by Node.js `path` module

### Styling

CSS Modules (ControllerDocsPage.module.css):

```css
/* lines 1-7: Container - Dark theme with flexbox */
.container {
  display: flex;
  height: 100%;
  overflow: hidden;
  background-color: #1e1e1e;
  flex-direction: column;
}

/* lines 9-16: Header - Dark theme with border */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #333;
  background-color: #252526;
}

/* lines 18-28: Title section styling */
.titleSection h1 {
  margin: 0 0 4px 0;
  font-size: 24px;
  color: #ffffff;
}

.subtitle {
  margin: 0;
  font-size: 14px;
  color: #888;
}

/* lines 30-34: Content - Flexbox with scroll */
.content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* lines 36-40: Markdown wrapper - Scrollable container */
.markdown {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

/* lines 42-50: Markdown content - Monospace display */
.markdownContent {
  font-family: "Consolas", "Monaco", "Courier New", monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #d4d4d4;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
}

/* lines 52-58: Loading state - Centered */
.loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
}
```

## User Guide

### Accessing Controller Docs

1. Navigate to `/controller-docs`
2. View documentation content
3. Currently shows `glossary.md`

### Path Configuration

Controlled by Settings (automatic):
- Development: Project root `docs/controller-docs/`
- Production: Application data directory

## Documentation Organization Guide

### Recommended Directory Structure

```
docs/
├── controller-docs/          # Platform-specific docs
│   ├── glossary.md          # Terms & definitions
│   ├── project-context.md   # Project overview
│   ├── architecture.md      # System architecture
│   └── development.md       # Development guide
│
├── features/                # Feature documentation
│   ├── index.md
│   └── {feature}/README.md
│
├── visualization/           # Data visualization
│   └── session-logs/
│
└── [Root Level Docs]        # General docs
    ├── ARCHITECTURE.md
    ├── SETUP.md
    └── README.md
```

### Documentation Categories

**1. Controller Docs (Platform-specific)**
- Project architecture
- Development workflow
- API reference
- Deployment guide

**2. Claude Context (External reference)**
- Claude Code CLI documentation
- MCP server guides
- Best practices

**3. Features (Feature-specific)**
- Per-feature documentation
- User guides
- Implementation details

**4. Visualization (Analytics)**
- Session log analysis
- Event tracking
- Performance metrics

### Best Practices

**Controller Docs vs Claude Context:**
- **Controller Docs**: Documentation about THIS application
- **Claude Context**: Documentation about Claude Code CLI

**What belongs in Controller Docs:**
- Electron app architecture
- React component structure
- IPC communication patterns
- Development setup

**What belongs in Claude Context:**
- Claude CLI usage
- MCP configuration
- Hooks and automation
- Output formats

## Key Project Documentation Links

### Setup & Architecture
- [SETUP.md](../../SETUP.md) - Installation and configuration
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - System design
- [CLAUDE.md](../../CLAUDE.md) - Project overview

### Claude Code Reference
- [Claude Context Index](../../claude-context/index.md)
- [Config Reference](../../claude-context/config/reference.md)
- [Usage Reference](../../claude-context/usage/reference.md)

### Features
- [Features Overview](../../features/index.md)
- Individual feature docs in `features/*/README.md`

## Future Enhancements

### 1. Full Document Browser

Transform into a complete documentation browser similar to Claude Docs:

**Features:**
- File tree navigation
- Directory expansion/collapse
- Breadcrumb navigation
- Multi-document tabs

**Implementation:**
```typescript
// Use same tree structure as ClaudeDocsPage
const [fileTree, setFileTree] = useState<DirectoryNode | null>(null);
const [selectedPath, setSelectedPath] = useState<string>('');
```

### 2. Markdown Rendering

Replace `<pre>` with proper markdown rendering:

**Libraries:**
- `react-markdown` - Main renderer
- `rehype-highlight` - Syntax highlighting
- `remark-gfm` - GitHub Flavored Markdown

**Example:**
```typescript
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {content}
</ReactMarkdown>
```

### 3. Multi-Document Tabs

Allow opening multiple docs simultaneously:

```typescript
interface OpenDoc {
  path: string;
  title: string;
  content: string;
}

const [openDocs, setOpenDocs] = useState<OpenDoc[]>([]);
const [activeDoc, setActiveDoc] = useState<string>('');
```

### 4. Search

Full-text search across all controller docs:

```typescript
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

const handleSearch = async (query: string) => {
  // Search in all .md files
  // Return matched files with context
};
```

### 5. Live Editing

Edit documentation directly in the UI:

```typescript
const [editMode, setEditMode] = useState(false);
const [editContent, setEditContent] = useState('');

const handleSave = async () => {
  await window.docsAPI.writeDocsFile(selectedPath, editContent);
  await loadDocs();
};
```

## Technical Limitations

### Current Constraints

1. **Single File Display**: Only shows one hardcoded file
2. **No Navigation**: Cannot browse other docs
3. **Raw Markdown**: Not rendered as HTML
4. **No Search**: Cannot find specific content
5. **Read-Only**: Cannot edit docs from UI

### IPC Handlers Available

The backend already supports full directory structure reading:

```typescript
// src/ipc/handlers/docsHandlers.ts:62-70
router.handle('read-structure', async (_event, rootPath: string) => {
  try {
    const structure = await readDirectoryStructure(rootPath);
    return structure;
  } catch (error) {
    console.error('Error reading docs structure:', error);
    throw error;
  }
});
```

This means the foundation for a full document browser is already in place.

## Development Notes

### How to Add New Documentation

1. Create markdown file in `docs/controller-docs/`
2. Follow naming convention: lowercase-with-dashes.md
3. Add front matter (optional):
```markdown
---
title: Document Title
category: Architecture
---
```

4. Update navigation if implementing tree view

### Key Files to Modify

**To change displayed file:**
```typescript
// src/pages/ControllerDocsPage.tsx:44
const glossaryPath = `${docsPath}/OTHER_FILE.md`;
const content = await window.docsAPI.readDocsFile(glossaryPath);
```

**To implement tree navigation:**
1. Copy structure from `ClaudeDocsPage.tsx`
2. Reuse `renderFileTree()` function
3. Add state for `selectedPath`

### Testing

```bash
# Add new doc
echo "# Test Doc" > docs/controller-docs/test.md

# Verify it loads
npm run dev
# Navigate to /controller-docs
```

The Controller Docs feature is currently minimal but has the infrastructure to become a full-featured documentation browser for the project's own documentation.
