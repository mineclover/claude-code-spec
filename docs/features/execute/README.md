# Execute Feature - Claude CLI 실행 및 제어

## Overview

Execute 페이지는 Claude CLI를 헤드리스 모드로 실행하고 실시간으로 모니터링하는 플랫폼의 핵심 기능입니다.

**Route:** `/`  
**Component:** `src/pages/ExecutePage.tsx`

## Claude Code Features Used

### 1. Headless Execution (`-p` flag)

Claude CLI를 대화형 모드 대신 단일 프롬프트로 실행합니다.

```typescript
// src/lib/ClaudeClient.ts:59-86
const args = [
  '-p',
  query,
  '--output-format',
  'stream-json',
  '--verbose',
  '--dangerously-skip-permissions',
];

// Add MCP config if specified
if (this.options.mcpConfig) {
  args.push('--mcp-config', this.options.mcpConfig);
  args.push('--strict-mcp-config');
}

// Add model if specified (defaults to sonnet for better performance)
if (this.options.model) {
  args.push('--model', this.options.model);
} else {
  // Default to sonnet instead of opus for better speed/cost balance
  args.push('--model', 'sonnet');
}

// Add session resume if available
if (this.currentSessionId) {
  args.push('--resume', this.currentSessionId);
}
```

**Documentation:** `docs/claude-context/headless/headless-basics.md`

### 2. Stream JSON Output Format

`--output-format stream-json` 플래그로 JSONL 형식 출력을 받습니다.

```typescript
// src/lib/ClaudeClient.ts:90-97
this.process = spawn('claude', args, {
  cwd: this.options.cwd,
  env: {
    ...process.env,
    PATH: process.env.PATH,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

**JSONL Format:**
```jsonl
{"type":"system","subtype":"init","session_id":"...","model":"...","cwd":"...","tools":[...],"mcp_servers":[...]}
{"type":"message","subtype":"user","message":{"role":"user","content":[{"type":"text","text":"..."}]}}
{"type":"message","subtype":"assistant","message":{"role":"assistant","content":[...]}}
{"type":"result","result":{"status":"success","duration_ms":1234}}
```

**Parser:** `src/lib/StreamParser.ts`  
**Documentation:** `docs/claude-context/output-styles/stream-json.md`

### 3. MCP Configuration

```typescript
// src/pages/ExecutePage.tsx:402-417
<select
  id="mcpConfigSelect"
  value={selectedMcpConfig}
  onChange={(e) => setSelectedMcpConfig(e.target.value)}
>
  <option value="">None (default permissions)</option>
  {mcpConfigs.map((config) => (
    <option key={config.path} value={config.path}>
      {config.name}
    </option>
  ))}
</select>
```

**Documentation:** `docs/claude-context/mcp-config/index.md`

### 4. Model Selection

```typescript
// ExecutePage.tsx:419-430
<select value={selectedModel} onChange={...}>
  <option value="sonnet">Sonnet (Default - Balanced)</option>
  <option value="opus">Opus (Most Capable)</option>
</select>
```

### 5. Session Management

세션 재개 기능으로 이전 대화를 이어갈 수 있습니다.

```typescript
// ExecutePage.tsx:211-244
const handleResumeSession = async (sessionId: string) => {
  const result = await window.claudeAPI.executeClaudeCommand(
    projectPath,
    query || '',
    sessionId, // Resume existing session
    selectedMcpConfig || undefined,
    selectedModel
  );
};
```

**Documentation:** `docs/claude-context/usage/sessions.md`

### 6. Sub-Agent Tracking (isSidechain)

모든 이벤트에 `isSidechain` 필드가 포함되어 서브 에이전트 실행을 추적합니다.

```typescript
// src/lib/types.ts:10-14 (BaseStreamEvent)
export interface BaseStreamEvent {
  type: string;
  isSidechain?: boolean; // Indicates if this event is from a sub-agent
  [key: string]: unknown;
}

// All specific event types (SystemInitEvent, UserEvent, AssistantEvent, etc.)
// extend this with isSidechain field for sub-agent tracking
```

**Documentation:** `docs/visualization/session-logs/event-components.md`

## Implementation Details

### Architecture

```
┌─────────────────┐
│  ExecutePage    │ (React Component)
│  - UI Controls  │
│  - State Mgmt   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ClaudeClient   │ (Service)
│  - spawn CLI    │
│  - Stream       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  StreamParser   │ (Parser)
│  - Parse JSONL  │
│  - Buffer lines │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  StreamOutput   │ (UI Component)
│  - Render events│
└─────────────────┘
```

### Key Components

**ExecutePage (src/pages/ExecutePage.tsx)**
- 475 lines
- State variables: 14개 (projectPath, query, events, errors, isRunning, etc.)
- Key methods:
  - `loadMcpConfigs()`: MCP 설정 로드 (lines 36-49)
  - `loadRecentSessions()`: 세션 목록 로드 (페이지네이션, 캐싱) (lines 51-124)
  - `handleExecute()`: 새 Claude 실행 (lines 177-209)
  - `handleResumeSession()`: 세션 재개 (lines 211-244)
  - `handleLoadSessionToOutput()`: 세션 로그를 화면에 표시 (lines 246-267)

**ClaudeClient (src/lib/ClaudeClient.ts)**
- 189 lines
- Methods:
  - `execute()`: CLI 실행 (lines 47-102)
  - `getSessionId()`: 세션 ID 조회 (lines 161-163)
  - `kill()`: 프로세스 종료 (lines 168-173)
  - `isRunning()`: 실행 상태 확인 (lines 186-188)

**StreamParser (src/lib/StreamParser.ts)**
- 108 lines
- Features:
  - Line buffering (line 12 for buffer declaration, lines 24-32 for buffering logic)
  - ANSI escape sequence removal (lines 41-45)
  - Incomplete JSON detection (lines 66-79)

**StreamOutput (src/components/stream/StreamOutput.tsx)**
- 60 lines
- Features:
  - Auto-scroll (lines 16-19)
  - Event type badges (lines 28-31)
  - Event rendering (lines 41-47)

## Data Flow

```
User Input (Query)
  ↓
ExecutePage.handleExecute()
  ↓
window.claudeAPI.executeClaudeCommand() [IPC]
  ↓
Main Process: claudeHandlers.ts
  ↓
ClaudeClient.execute()
  ↓
spawn('claude', [...args])
  ↓
stdout → StreamParser → JSON Events
  ↓
IPC: 'claude:stream' channel
  ↓
ExecutePage.events state
  ↓
StreamOutput component
  ↓
User sees real-time output
```

## User Guide

### 1. 프로젝트 선택

- **Browse 버튼**: 디렉토리 선택 다이얼로그
- **직접 입력**: 프로젝트 경로 입력

### 2. 세션 관리

**최근 세션 보기:**
- 프로젝트 선택 시 자동으로 최근 5개 세션 표시
- 페이지네이션으로 더 많은 세션 조회
- 새로고침 버튼으로 최신 목록 갱신

**세션 로드:**
- 세션 클릭: 선택
- 더블클릭 또는 → 버튼: 출력 화면에 로드
- Resume 버튼: 선택한 세션 이어가기

### 3. MCP 설정 선택

- `.mcp-analysis.json`: 코드 분석용
- `.mcp-dev.json`: 일반 개발용
- `.mcp-ui.json`: UI 개발용
- `.mcp-e2e.json`: E2E 테스트용
- `.mcp-empty.json`: 최소 설정

### 4. 모델 선택

- **Sonnet**: 빠르고 균형잡힌 성능 (기본값)
- **Opus**: 가장 강력한 모델

### 5. 쿼리 실행

1. Query 입력란에 프롬프트 입력
2. **Execute** 버튼 클릭
3. 실시간 출력 확인

## Configuration Options

### MCP Configuration

MCP 설정 파일은 `.claude/` 디렉토리에 위치:

```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@agentic-insights/mcp-server-serena"]
    }
  }
}
```

### Session Caching

세션 목록은 IndexedDB에 5분간 캐싱됩니다:

```typescript
// src/services/cache.ts:65
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
```

## API Reference

### Window APIs

**claudeAPI:**
- `executeClaudeCommand(projectPath, query, sessionId?, mcpConfig?, model?)`: CLI 실행
- `selectDirectory()`: 디렉토리 선택 다이얼로그
- `onClaudeStarted(callback)`: 실행 시작 이벤트
- `onClaudeStream(callback)`: 스트림 이벤트
- `onClaudeError(callback)`: 에러 이벤트
- `onClaudeComplete(callback)`: 완료 이벤트

**settingsAPI:**
- `listMcpConfigs(projectPath)`: MCP 설정 목록

**claudeSessionsAPI:**
- `getProjectSessionsPaginated(projectPath, page, pageSize)`: 세션 목록
- `getSessionMetadata(projectPath, sessionId)`: 세션 메타데이터
- `readLog(projectPath, sessionId)`: 세션 로그

## Troubleshooting

### 1. Claude CLI not found
- Claude Code가 설치되어 있는지 확인
- PATH 환경 변수에 claude 명령어 포함 확인

### 2. MCP 서버 초기화 실패
- MCP 설정 파일 JSON 문법 확인
- 서버 명령어 및 경로 확인
- `npm install` 로 필요한 패키지 설치

### 3. 세션 로드 안됨
- `~/.claude/projects/` 디렉토리 권한 확인
- 세션 로그 파일 존재 여부 확인

### 4. 스트림 출력 안보임
- `--output-format stream-json` 사용 확인
- StreamParser 에러 로그 확인

### 5. Permission 에러
- `.claude/settings.json` 권한 설정 확인
- `--dangerously-skip-permissions` 대신 명시적 권한 사용 권장

## Performance Considerations

### Initialization Time
- **Empty MCP** (0 servers): ~1-2s
- **Analysis** (2 servers): ~2-3s
- **Development** (2 servers): ~2-3s
- **Full** (6+ servers): ~5-10s

### Memory Usage
- Base: ~50MB
- + MCP servers: ~100-200MB per server
- + Session logs: ~1-5MB per session

### Session Loading Optimization
- IndexedDB 캐싱으로 즉시 로드
- 백그라운드에서 메타데이터 enrichment
- 페이지네이션으로 메모리 절약

## Future Enhancements

1. **Permissions UI**: `settings.json` 편집 UI
2. **Token Analytics**: 입력/출력 토큰 사용량 차트
3. **Multi-process**: 여러 Claude 동시 실행
4. **Cost Tracking**: API 비용 추적
5. **Quick Templates**: 자주 쓰는 쿼리 템플릿
6. **Export**: 세션 로그 Export (Markdown, PDF)

## Related Documentation

- [Claude Context - Headless Basics](../claude-docs/#headless)
- [Claude Context - Stream JSON Format](../claude-docs/#output-styles)
- [MCP Configs Feature](../mcp-configs/)
- [Claude Projects Feature](../claude-projects/)
- [Settings Feature](../settings/)
