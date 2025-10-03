# Claude Projects Feature

## Overview

Claude Projects 기능은 Claude Code 실행 기록을 프로젝트 및 세션 단위로 관리하는 3-페이지 시스템입니다.

**Routes:**
- `/claude-projects` - Project list
- `/claude-projects/:projectDirName` - Sessions list
- `/claude-projects/:projectDirName/:sessionId` - Session detail

## Claude Code Session Tracking

### Directory Structure

Claude Code는 모든 세션을 `~/.claude/projects/` 에 저장합니다:

```
~/.claude/projects/
├── -Users-junwoobang-project/
│   ├── session-uuid-1.jsonl
│   ├── session-uuid-2.jsonl
│   └── session-uuid-3.jsonl
└── -Users-john-myproject/
    └── session-uuid-4.jsonl
```

### Path Format Conversion

파일 시스템 경로를 디렉토리 이름으로 변환:

```typescript
// src/services/claudeSessions.ts:48-59
export function pathToDashFormat(path: string): string {
  return path.replace(/\//g, '-');
}

export function dashFormatToPath(dashFormat: string): string {
  // Remove leading dash
  if (dashFormat.startsWith('-')) {
    dashFormat = dashFormat.substring(1);
  }
  return dashFormat.replace(/-/g, '/');
}
```

**Example:**
- Path: `/Users/junwoobang/project`
- Dash Format: `-Users-junwoobang-project`

### Session ID Format

UUID v4 format:
```
550e8400-e29b-41d4-a716-446655440000
```

### Session Log Format

JSONL (JSON Lines) format:

```jsonl
{"type":"system","subtype":"init","session_id":"...","model":"claude-sonnet-4","cwd":"/Users/...","tools":[...],"mcp_servers":[...]}
{"type":"message","subtype":"user","message":{"role":"user","content":[{"type":"text","text":"..."}]}}
{"type":"message","subtype":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"..."}]}}
{"type":"tool_use","tool":"mcp__serena__find_symbol","input":{...},"isSidechain":false}
{"type":"tool_result","tool":"mcp__serena__find_symbol","output":{...}}
{"type":"result","result":{"status":"success","duration_ms":12345}}
```

### Metadata Extraction

From session logs, we extract:

```typescript
// src/services/claudeSessions.ts:83-149
const extractSessionMetadata = (
  filePath: string,
): Pick<ClaudeSessionInfo, 'cwd' | 'firstUserMessage' | 'hasData'> => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    if (lines.length === 0) {
      return { hasData: false };
    }

    let cwd: string | undefined;
    let firstUserMessage: string | undefined;
    let hasAnyData = false;

    // Read each log entry (block)
    for (const line of lines) {
      try {
        const block = JSON.parse(line);
        hasAnyData = true;

        // Extract cwd from any block that has it
        if (!cwd && block.cwd) {
          cwd = block.cwd;
        }

        // Look for first "user" block
        if (!firstUserMessage) {
          if (block.message && typeof block.message === 'object') {
            const message = block.message as { role?: string; content?: string };
            if (message.role === 'user' && message.content) {
              firstUserMessage = message.content.trim();
            }
          }
          else if (block.role === 'user' && block.content) {
            firstUserMessage = block.content.trim();
          }
        }

        // Early exit if we found both
        if (cwd && firstUserMessage) {
          break;
        }
      } catch (_parseError) {}
    }

    return {
      cwd,
      firstUserMessage,
      hasData: hasAnyData,
    };
  } catch (error) {
    console.error('[ClaudeSessions] Failed to extract session metadata:', error);
    return { hasData: false };
  }
};
```

## Implementation Details

### ClaudeProjectsListPage (`/claude-projects`)

**Features:**
- Pagination (10 projects/page)
- Sorting (Most Recent, Oldest, Name)
- Project cards with session count
- Quick "Execute" button
- Cache strategy

**Code:**
```typescript
// src/pages/ClaudeProjectsListPage.tsx:49-75
const loadClaudeProjects = useCallback(async (page: number) => {
  setLoading(true);
  try {
    const cachedPage = await getCachedProjectsPage(page, PAGE_SIZE);
    if (cachedPage !== null) {
      setProjects(cachedPage.projects);
      setTotalProjects(cachedPage.total);
      setHasMore(cachedPage.hasMore);
      setLoading(false);
      setInitialLoading(false);
      return;
    }
    
    const result = await window.claudeSessionsAPI.getAllProjectsPaginated(page, PAGE_SIZE);
    setProjects(result.projects);
    setTotalProjects(result.total);
    setHasMore(result.hasMore);
    setLastUpdated(Date.now());
    
    await setCachedProjectsPage(page, PAGE_SIZE, result.projects, result.total, result.hasMore);
  } catch (error) {
    console.error('Failed to load Claude projects:', error);
  } finally {
    setLoading(false);
    setInitialLoading(false);
  }
}, []);
```

### ClaudeSessionsListPage (`/claude-projects/:projectDirName`)

**Features:**
- Pagination (20 sessions/page)
- Metadata enrichment (parallel loading)
- Session preview with first user message
- Empty state indication
- Copy session ID
- Open folder utilities
- Actual project path tracking

**Session Loading with Metadata Enrichment:**

```typescript
// src/pages/ClaudeSessionsListPage.tsx:35-104
const loadSessions = useCallback(
  async (page: number) => {
    if (!projectPath) return;

    setSessionsLoading(true);
    try {
      // Check cache first
      const cached = await getCachedSessionsPage(projectPath, page, SESSIONS_PAGE_SIZE);
      if (cached) {
        setSessions(cached.sessions);
        setTotalSessions(cached.total);
        // Update actual project path from cached sessions
        const sessionWithCwd = cached.sessions.find((s) => s.cwd && s.hasData);
        if (sessionWithCwd?.cwd && !actualProjectPath) {
          setActualProjectPath(sessionWithCwd.cwd);
        }
        setSessionsLoading(false);
        return;
      }

      // Get paginated sessions (basic info only)
      const result = await window.claudeSessionsAPI.getProjectSessionsPaginated(
        projectPath,
        page,
        SESSIONS_PAGE_SIZE,
      );

      // Enrich with metadata in parallel
      const sessionsWithMetadata = await Promise.all(
        result.sessions.map(async (session) => {
          try {
            const metadata = await window.claudeSessionsAPI.getSessionMetadata(
              projectPath,
              session.sessionId,
            );
            return { ...session, ...metadata };
          } catch (error) {
            console.error('Failed to load session metadata:', error);
            return { ...session, hasData: false };
          }
        }),
      );

      setSessions(sessionsWithMetadata);
      setTotalSessions(result.total);

      // Update actual project path from first valid session cwd
      const sessionWithCwd = sessionsWithMetadata.find((s) => s.cwd && s.hasData);
      if (sessionWithCwd?.cwd && !actualProjectPath) {
        setActualProjectPath(sessionWithCwd.cwd);
      }

      await setCachedSessionsPage(
        projectPath,
        page,
        SESSIONS_PAGE_SIZE,
        sessionsWithMetadata,
        result.total,
        result.hasMore,
      );
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setSessions([]);
      setTotalSessions(0);
    } finally {
      setSessionsLoading(false);
    }
  },
  [projectPath],
);
```

**Actual Project Path Tracking:**

세션 로그에서 실제 프로젝트 경로(`cwd`)를 추출하여 사용:

```typescript
// src/pages/ClaudeSessionsListPage.tsx:48-50, 82-85
// From cached sessions:
const sessionWithCwd = cached.sessions.find((s) => s.cwd && s.hasData);
if (sessionWithCwd?.cwd && !actualProjectPath) {
  setActualProjectPath(sessionWithCwd.cwd);
}

// From freshly loaded sessions:
const sessionWithCwd = sessionsWithMetadata.find((s) => s.cwd && s.hasData);
if (sessionWithCwd?.cwd && !actualProjectPath) {
  setActualProjectPath(sessionWithCwd.cwd);
}
```

### ClaudeSessionDetailPage (`/claude-projects/:projectDirName/:sessionId`)

**Features:**
- Full event timeline rendering (delegated to SessionLogViewer)
- Export to JSON (handled by SessionLogViewer)
- Sub-agent detection and visualization (handled by SessionLogViewer)
- Session summary (handled by SessionLogViewer)

**Code:**
```typescript
// src/pages/ClaudeSessionDetailPage.tsx:6-35
export const ClaudeSessionDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectDirName, sessionId } = useParams<{
    projectDirName: string;
    sessionId: string;
  }>();
  const [projectPath, setProjectPath] = useState<string>('');

  // Decode projectDirName to get projectPath
  useEffect(() => {
    if (projectDirName) {
      // Convert projectDirName format to path
      // Example: -Users-junwoobang-project-name -> /Users/junwoobang/project-name
      const path = `/${projectDirName.replace(/^-/, '').replace(/-/g, '/')}`;
      setProjectPath(path);
    }
  }, [projectDirName]);

  const handleClose = () => {
    if (projectDirName) {
      navigate(`/claude-projects/${projectDirName}`);
    }
  };

  if (!projectPath || !sessionId) {
    return <div>Loading...</div>;
  }

  return <SessionLogViewer projectPath={projectPath} sessionId={sessionId} onClose={handleClose} />;
};
```

**Note:** This component is a thin wrapper that converts the URL parameter (projectDirName) to a project path and delegates all session viewing functionality to the `SessionLogViewer` component.

## Caching System

**Technology:** Dexie (IndexedDB wrapper)

**Cache Duration:** 5 minutes

```typescript
// src/services/cache.ts:65
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
```

**Cache Keys:**
- Projects: `projects:${page}:${pageSize}`
- Sessions: `sessions:${projectPath}:${page}:${pageSize}`
- Total count: `totalCount`

**Benefits:**
- Instant loading from cache
- Reduced I/O operations
- Better UX for repeated access

## API Reference

### ClaudeSessionsAPI

**Project Operations:**
```typescript
getAllProjectsPaginated(page: number, pageSize: number): Promise<{
  projects: ClaudeProjectInfo[];
  total: number;
  hasMore: boolean;
}>

getTotalCount(): Promise<number>
```

**Session Operations:**
```typescript
getProjectSessionsPaginated(
  projectPath: string,
  page: number,
  pageSize: number
): Promise<{
  sessions: SessionInfo[];
  total: number;
  hasMore: boolean;
}>

getSessionMetadata(
  projectPath: string,
  sessionId: string
): Promise<{
  cwd?: string;
  firstUserMessage?: string;
  hasData: boolean;
}>
```

**Log Operations:**
```typescript
readLog(projectPath: string, sessionId: string): Promise<ClaudeSessionEntry[]>

getSummary(projectPath: string, sessionId: string): Promise<string | null>

getPreview(projectPath: string, sessionId: string): Promise<string | null>
```

**Utility Operations:**
```typescript
openLogsFolder(): Promise<void>

openProjectFolder(projectPath: string): Promise<void>
```

## User Guide

### Viewing All Projects

1. Navigate to `/claude-projects`
2. See all projects with Claude sessions
3. Click project to view sessions
4. Use "Execute" button to load project in Execute tab

### Browsing Project Sessions

1. Click a project from the list
2. View all sessions for that project (20/page)
3. Sessions show:
   - Session ID
   - First user message (if available)
   - Last modified time
4. Click session to view details

### Inspecting Session Details

1. Click a session from the list
2. View complete event timeline
3. See all tool calls, messages, and results
4. Export session as JSON
5. Identify sub-agent executions (`isSidechain: true`)

### Using "Execute" Button

1. Click "Execute" on any project card
2. Project automatically loads in Execute tab
3. Ready to run new queries in that project

## Related Documentation

- [Event Components](../../visualization/session-logs/event-components.md)
- [Task Tracking Strategy](../../visualization/session-logs/task-tracking-strategy.md)
- [Sub-Agent Basics](../../claude-context/sub-agent/basics.md)
- [Output Styles - Stream JSON](../../claude-context/output-styles/stream-json.md)
- [UI Component Architecture](../../ui-component-architecture.md)

## Technical Notes

### Performance Considerations

- **Cache-first strategy**: Checks IndexedDB cache before API calls
- **Parallel metadata enrichment**: All metadata requests run concurrently using Promise.all
- **IndexedDB caching**: 5-minute cache for repeated access
- **Pagination**: Prevents loading all sessions at once (10 projects, 20 sessions per page)

### Edge Cases Handled

- Empty projects (no sessions)
- Sessions with no data (empty .jsonl files)
- Missing `cwd` in session logs
- Invalid session IDs
- Network errors during metadata fetching

### Future Enhancements

1. **Session Search**: Search within session content
2. **Filters**: Filter by date, duration, success/failure
3. **Bulk Operations**: Delete multiple sessions
4. **Session Comparison**: Compare two sessions side-by-side
5. **Export Options**: Export to Markdown, PDF
6. **Analytics Dashboard**: Session statistics, trends

## Quick Reference

### Path Conversion Examples

| Original Path | Dash Format |
|--------------|-------------|
| `/Users/john/project` | `-Users-john-project` |
| `/home/user/app` | `-home-user-app` |
| `C:\Projects\App` | `-C:-Projects-App` |

### Session Directory Locations

- **macOS/Linux**: `~/.claude/projects/`
- **Windows**: `%USERPROFILE%\.claude\projects\`

### Pagination Sizes

- **Projects List**: 10 per page
- **Sessions List**: 20 per page

### Cache Keys

```
projects:0:10
projects:1:10
sessions:/Users/john/project:0:20
totalCount
```
