# Project Architecture

## 프로젝트 개요

Claude CLI Analytics & Control Platform - Electron 기반 Claude CLI 실행 제어 및 분석 플랫폼

## 기술 스택

- **Frontend**: React 19, TypeScript, CSS Modules
- **Backend**: Electron (Main Process)
- **Build**: Vite, Electron Forge
- **Linting**: Biome

## 디렉토리 구조

```
src/
├── main/                    # Electron Main Process
│   ├── index.ts            # 메인 프로세스 진입점
│   └── ipc-setup.ts        # IPC 라우터 설정
├── preload/                # Preload Scripts
│   └── apis/               # API 노출 모듈
│       ├── agent.ts
│       ├── task.ts
│       ├── claude.ts
│       └── ...
├── ipc/                    # IPC 통신 로직
│   ├── IPCRouter.ts        # 타입 안전 IPC 라우터
│   └── handlers/           # IPC 핸들러
│       ├── agentHandlers.ts
│       ├── taskHandlers.ts
│       └── ...
├── components/             # React 컴포넌트
│   ├── agent/              # Agent 관련 컴포넌트
│   ├── task/               # Task 관련 컴포넌트
│   ├── execution/          # Execute 관련 컴포넌트
│   └── ...
├── pages/                  # 페이지 컴포넌트
│   ├── AgentsPage.tsx
│   ├── TasksPage.tsx
│   ├── ExecutionsPage.tsx
│   └── ...
├── contexts/               # React Context
│   └── ProjectContext.tsx  # 프로젝트 경로 관리
├── lib/                    # 유틸리티 라이브러리
│   ├── agentParser.ts      # Agent markdown 파싱
│   ├── taskParser.ts       # Task markdown 파싱
│   └── mcpConfigHelper.ts  # MCP 설정 헬퍼
├── types/                  # TypeScript 타입 정의
│   ├── agent.ts
│   ├── task.ts
│   ├── workArea.ts
│   └── toolGroups.ts
└── App.tsx                 # 앱 진입점

.claude/
├── agents/                 # Agent 정의 파일
│   └── task-creator.md
├── tasks/                  # Task 정의 파일
│   └── task-*.md
├── context/                # Agent를 위한 컨텍스트 문서
│   ├── project-architecture.md
│   ├── coding-conventions.md
│   └── ...
├── work-areas.json         # Work Area 정의
├── settings.json           # 권한 설정
└── .mcp-*.json            # MCP 서버 설정
```

## 핵심 아키텍처 패턴

### 1. IPC 통신 패턴

**타입 안전 라우터 사용:**
```typescript
// Main Process
const router = ipcRegistry.router('namespace');
router.handle('methodName', async (args) => { ... });

// Preload
const api = {
  methodName: (args) => ipcRenderer.invoke('namespace:methodName', args)
};

// Renderer
window.namespaceAPI.methodName(args);
```

### 2. Markdown 기반 데이터 관리

**YAML Frontmatter + Markdown Body:**
```markdown
---
id: task-123
title: Task Title
status: pending
---

## Description
Task content here...
```

**파서 패턴:**
- `parseXMarkdown()`: 파일 → 객체
- `generateXMarkdown()`: 객체 → 파일
- `validateX()`: 유효성 검사

### 3. 스토리지 레벨

**Project-level** (`.claude/`):
- 팀 공유 설정 및 데이터
- git 커밋됨

**User-level** (`~/.claude/`):
- 개인 설정 및 데이터
- git 무시됨

## 주요 기능 모듈

### Agents (에이전트 관리)

**목적**: 전문화된 AI Agent 정의 및 관리

**파일 위치**:
- Project: `.claude/agents/*.md`
- User: `~/.claude/agents/*.md`

**주요 필드**:
- `name`: Agent 이름 (파일명과 일치)
- `description`: 역할 설명
- `allowedTools`: 허용된 도구 목록
- `permissions`: 파일 접근 권한 패턴

### Tasks (작업 관리)

**목적**: 프로젝트 작업 정의 및 Agent 할당

**파일 위치**: `.claude/tasks/*.md`

**주요 필드**:
- `id`: 고유 식별자
- `title`: 작업 제목
- `area`: 작업 영역 (Work Area displayName)
- `assigned_agent`: 할당된 Agent
- `reviewer`: 검토자
- `status`: pending | in_progress | completed | cancelled
- `references`: 참고 파일 경로
- `successCriteria`: 완료 기준

### Work Areas (작업 영역)

**목적**: 계층적 작업 분류 및 컨텍스트 최적화

**파일 위치**: `.claude/work-areas.json`

**주요 필드**:
- `id`: 고유 식별자 (예: `frontend-pages`)
- `category`: 메인 카테고리 (예: `Frontend`)
- `subcategory`: 서브 카테고리 (예: `Pages`)
- `displayName`: 표시 이름 (예: `Frontend/Pages`)
- `description`: 작업 영역 설명

**기본 카테고리** (5개):
- **Frontend**: Pages, Components, Contexts
- **Backend**: IPC, Lib, Process
- **Infra**: Build, Deploy
- **Docs**: Features, Architecture, Guides
- **Test**: Unit, Integration

### Executions (실행 관리)

**목적**: Claude CLI 실행 및 스트림 응답 관리

**실행 방식**:
```bash
claude -p "query" \
  --output-format stream-json \
  --mcp-config .claude/.mcp-dev.json \
  --strict-mcp-config
```

**스트림 파싱**:
- JSONL 형식 (JSON Lines)
- `StreamParser` 클래스로 파싱
- 실시간 UI 업데이트

## MCP (Model Context Protocol)

### MCP 서버 종류

1. **serena**: 코드 분석 및 편집
   - 심볼 기반 검색
   - 파일 구조 분석
   - 코드 편집 도구

2. **magic**: UI 컴포넌트
   - 21st.dev 통합
   - 로고 검색

3. **playwright**: 브라우저 자동화
   - 웹 테스트
   - 스크린샷

### MCP Config 파일

- `.mcp-dev.json`: 개발용 (serena + context7)
- `.mcp-analysis.json`: 분석용 (serena + sequential-thinking)
- `.mcp-empty.json`: MCP 없음

## Tool Groups

7개 도구 그룹으로 Agent 권한 관리:

1. **all**: 모든 도구
2. **read-only**: Read, Grep, Glob, WebFetch, WebSearch
3. **edit**: Write, Edit
4. **execution**: Bash
5. **mcp**: MCP 서버 도구 (40+ tools)
6. **task-management**: Task, TodoWrite
7. **other**: NotebookEdit, SlashCommand, etc.

## 권한 시스템

### Permission Patterns

```yaml
permissions:
  allowList:
    - "read:src/**"
    - "write:tests/**"
    - "bash:npm run test"
  denyList:
    - "read:.env"
    - "write:package.json"
    - "bash:rm:*"
```

**패턴 형식**: `{action}:{path/command}`

## React 컴포넌트 패턴

### CSS Modules
```typescript
import styles from './Component.module.css';
<div className={styles.container}>...</div>
```

### 컨텍스트 사용
```typescript
import { useProject } from '../contexts/ProjectContext';
const { projectPath } = useProject();
```

### IPC API 호출
```typescript
const data = await window.agentAPI.listAgents(projectPath);
```

## 개발 가이드라인

1. **타입 안전성**: 모든 함수와 컴포넌트에 타입 정의
2. **에러 핸들링**: try-catch + toast 메시지
3. **로딩 상태**: useState로 로딩 상태 관리
4. **폼 검증**: 필수 필드 검증 + 사용자 피드백
5. **CSS 컨벤션**: VS Code Dark 테마 스타일
6. **파일 명명**: kebab-case (파일), PascalCase (컴포넌트)

## 빌드 및 실행

```bash
# 개발 모드
npm run start

# 디버그 모드
npm run start:debug

# 린팅
npm run lint
npm run lint:fix

# 테스트
npm run test
```

## 참고 문서

- `CLAUDE.md`: 프로젝트 개요 및 비전
- `docs/SETUP.md`: 설정 가이드
- `docs/features/`: 기능별 상세 문서
- `docs/claude-context/`: Agent 컨텍스트 문서
