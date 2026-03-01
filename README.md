# Claude Code Headless Controller

Electron 데스크톱 앱으로 Claude CLI를 헤드리스 모드로 실행하고, stream-json 형식의 실시간 출력을 웹 UI로 확인할 수 있는 도구입니다.

[image](img/image.png)

## 프로젝트 구성

이 프로젝트는 모노레포 구조로 구성되어 있습니다:

- **GUI 앱** (root): Electron 기반 데스크톱 애플리케이션
- **[@context-action/code-api](./packages/code-api/)**: Claude CLI 클라이언트 라이브러리 (재사용 가능)



## 주요 특징

### 실행 및 모니터링
- ✅ **병렬 실행 관리**: 여러 Claude CLI 프로세스 동시 실행 및 모니터링
- ✅ **실시간 스트리밍**: Stream JSON 파싱 및 실시간 이벤트 처리
- ✅ **실행 이력 추적**: 세션 ID 기반 모든 실행 내역 관리
- ✅ **프로세스 제어**: 실행 중 프로세스 종료 및 정리

### 프로젝트 관리
- ✅ **세밀한 권한 제어**: settings.json 기반 안전한 자동화 (`--dangerously-skip-permissions` 불필요)
- ✅ **MCP 서버 선택**: 작업별 최적화된 MCP 서버 설정 (분석/개발/최소)
- ✅ **세션 관리**: 프로젝트별 세션 조회 및 이어가기 지원
- ✅ **MCP 설정 편집**: 프로젝트별 MCP 서버 설정 관리

### 작업 관리 (Tasks) - Execute 최적화
- ✅ **의존성 분석**: 작업에 필요한 파일 및 문서 의존성 사전 정의
- ✅ **컨텍스트 배정**: Execute 시 자동 컨텍스트 구성
- ✅ **작업 영역 할당**: Area 설정으로 불필요한 컨텍스트 차단
- ✅ **성공 기준 검증**: 체크리스트 기반 결과 검증
- ✅ **리뷰 시스템**: 리뷰어 지정 및 산출물 검토

### 기술 특징
- ✅ **모듈화 아키텍처**: 재사용 가능한 독립 모듈 설계
- ✅ **완전한 타입 안정성**: TypeScript로 작성된 타입 세이프한 코드
- ✅ **Electron IPC 통신**: Main/Renderer 프로세스 간 안전한 통신

## 실행 방법

### 개발자용
```bash
# 설치
npm install

# 개발 모드 실행
npm start

# macOS 패키징 (테스트용)
npm run package:mac

# macOS 배포용 빌드 (DMG + ZIP 파일 생성)
npm run build:mac
# 또는
npm run make
```

### 사용자용 (앱 설치)
```bash
# 1. DMG 파일 열기
open "out/make/Claude Code Spec.dmg"

# 2. 앱을 Applications 폴더로 드래그

# 3. 보안 설정
xattr -cr "/Applications/Claude Code Spec.app"

# 4. 실행
open -a "Claude Code Spec"
```

**상세 설치 가이드**: [INSTALL.md](./INSTALL.md) | **빌드 가이드**: [BUILD_GUIDE.md](./docs/BUILD_GUIDE.md)

## 빠른 시작

### 1. 초기 설정
프로젝트는 이미 권한 설정과 MCP 서버가 구성되어 있습니다:

- **권한 설정**: `.claude/settings.json` (팀 공유)
- **MCP 서버**: `.claude/.mcp-*.json` (용도별 설정)

**상세 가이드:** [SETUP.md](./docs/SETUP.md)

### 2. 사용법

1. **프로젝트 디렉토리 선택**: Browse 버튼 또는 직접 입력
2. **쿼리 입력**: Claude에게 요청할 작업 입력
3. **Execute 클릭**: Claude CLI가 실행되고 실시간 응답 표시

**실행 명령 예시:**
```bash
claude -p "코드 분석" \
  --output-format stream-json \
  --mcp-config .claude/.mcp-dev.json \
  --strict-mcp-config
```

### 3. 권한 관리

프로젝트는 `.claude/settings.json`으로 안전하게 자동화됩니다:

```json
{
  "permissions": {
    "allow": [
      "Read(./src/**)",
      "Write(./src/**)",
      "Bash(npm run test)"
    ],
    "deny": [
      "Read(./.env)",
      "Bash(rm:*)"
    ]
  }
}
```

**장점:**
- ✅ `--dangerously-skip-permissions` 불필요
- ✅ 민감한 파일 보호
- ✅ 팀 정책 공유 가능

## 아키텍처

### 핵심 라이브러리: @context-action/code-api

Claude CLI와의 통신을 담당하는 핵심 모듈들은 독립적인 라이브러리로 분리되어 있습니다.

**자세한 사용법은 [packages/code-api/README.md](./packages/code-api/README.md)를 참고하세요.**

#### 주요 모듈

```typescript
import {
  // 클라이언트
  ClaudeClient,
  ProcessManager,
  SessionManager,

  // 파서
  StreamParser,

  // 타입 및 타입 가드
  type StreamEvent,
  type SystemInitEvent,
  type AssistantEvent,
  isSystemInitEvent,
  isAssistantEvent,
  extractTextFromMessage,

  // 쿼리 API (구조화된 출력)
  ClaudeQueryAPI,

  // 스키마 빌더
  buildSchemaPrompt,
  zodSchemaToPrompt,
  validateWithZod,
} from '@context-action/code-api';
```

#### 기본 사용 예제

```typescript
import { ClaudeClient } from '@context-action/code-api';

const client = new ClaudeClient({
  cwd: '/path/to/project',
  sessionId: 'previous-session-id', // optional
  onStream: (event) => console.log(event),
  onError: (error) => console.error(error),
  onClose: (code) => console.log('Done:', code),
});

client.execute('List files in this directory');
```

#### 구조화된 JSON 쿼리

```typescript
import { ClaudeQueryAPI } from '@context-action/code-api';
import { z } from 'zod';

const api = new ClaudeQueryAPI();

// Zod 스키마로 타입 안전한 쿼리
const schema = z.object({
  file: z.string(),
  linesOfCode: z.number().min(0),
  language: z.enum(['typescript', 'javascript', 'python']),
});

const result = await api.queryWithZod(
  '/path/to/project',
  'Analyze src/main.ts',
  schema
);

console.log(result.data); // 타입 안전: { file: string, linesOfCode: number, ... }
```

### IPC 통신 구조

```
┌─────────────┐                  ┌─────────────┐
│   Renderer  │                  │    Main     │
│   (React)   │                  │  (Node.js)  │
└─────────────┘                  └─────────────┘
       │                                │
       │  claude:execute                │
       │───────────────────────────────>│
       │                                │
       │                          ┌─────▼─────┐
       │                          │  Claude   │
       │                          │  Client   │
       │                          └─────┬─────┘
       │                                │
       │  claude:stream (events)        │
       │<───────────────────────────────│
       │                                │
       │  claude:complete               │
       │<───────────────────────────────│
```

## 데이터 흐름

```
1. User Input (Query)
   ↓
2. ClaudeClient.execute()
   ↓
3. spawn('claude', ['-p', query, '--output-format', 'stream-json', '--verbose'])
   ↓
4. stdout (line-by-line JSON)
   ↓
5. StreamParser.processChunk()
   ↓
6. Parsed StreamEvent
   ↓
7. IPC: claude:stream
   ↓
8. React UI Update
```

## Stream JSON 이벤트 타입

Claude CLI가 출력하는 주요 이벤트:

### System Init Event
```typescript
{
  type: 'system',
  subtype: 'init',
  session_id: string,
  cwd: string,
  tools: string[],
  model: string,
  // ...
}
```

### Assistant Event
```typescript
{
  type: 'assistant',
  message: {
    content: Array<TextContent | ToolUseContent>,
    usage: { input_tokens, output_tokens },
    // ...
  }
}
```

### Result Event
```typescript
{
  type: 'result',
  subtype: 'success' | 'error',
  result: string,
  duration_ms: number,
  total_cost_usd: number,
  // ...
}
```

## 기술 스택

- **Electron**: 데스크톱 앱 프레임워크
- **React 19**: UI 라이브러리
- **TypeScript**: 타입 안정성
- **Vite**: 빌드 도구
- **Node.js child_process**: Claude CLI 실행

## 프로젝트 구조

```
claude-code-spec/
├── packages/
│   └── code-api/             # 📦 Claude CLI 클라이언트 라이브러리
│       ├── src/
│       │   ├── client/       # ClaudeClient
│       │   ├── parser/       # StreamParser, types
│       │   ├── process/      # ProcessManager
│       │   ├── session/      # SessionManager
│       │   ├── query/        # ClaudeQueryAPI
│       │   ├── schema/       # Schema builders (Zod, JSON)
│       │   ├── errors/       # Error classes
│       │   └── index.ts      # Public API
│       ├── examples/         # 사용 예제
│       ├── tests/            # 테스트
│       └── dist/             # 빌드 출력 (CJS/ESM/DTS)
│
├── src/                      # 🖥️ GUI 앱 (Electron + React)
│   ├── lib/
│   │   ├── taskParser.ts     # Task 마크다운 파싱
│   │   ├── agentParser.ts    # Agent 정의 파싱
│   │   └── ...
│   ├── services/
│   │   ├── appSettings.ts    # 앱 설정 관리
│   │   ├── AppLogger.ts      # 로깅
│   │   └── ...
│   ├── ipc/
│   │   ├── IPCRouter.ts      # IPC 라우팅
│   │   └── handlers/         # IPC 핸들러
│   │       ├── claudeHandlers.ts
│   │       ├── taskHandlers.ts
│   │       └── ...
│   ├── preload/
│   │   └── apis/             # Preload API 모듈
│   │       ├── claude.ts
│   │       ├── task.ts
│   │       └── ...
│   ├── pages/                # React 페이지
│   │   ├── ExecutionsPage.tsx
│   │   ├── TasksPage.tsx
│   │   └── ...
│   ├── components/           # React 컴포넌트
│   ├── main.ts              # Electron Main Process
│   ├── preload.ts           # IPC Bridge
│   └── App.tsx              # React App
│
├── docs/                     # 문서
├── package.json             # Workspace 루트
└── README.md                # 이 파일
```

## Tasks 기능 - Execute를 위한 작업 명세

### 목적

Tasks는 Claude CLI 실행 시 필요한 **의존성**, **컨텍스트**, **작업 영역**을 사전에 정의하여 효율적인 Execute를 가능하게 합니다.

### 핵심 워크플로우

```
1. Task 정의 (의존성 분석)
   ├─ References: 필요한 모든 파일 명시
   ├─ Area: 작업 범위 제한 (컨텍스트 차단)
   └─ Success Criteria: 검증 가능한 완료 조건

2. Execute 실행
   ├─ Task 선택
   ├─ 자동 컨텍스트 구성 (References 기반)
   ├─ 범위 제한 (Area 기반)
   └─ Claude CLI 실행

3. 결과 검증
   └─ Success Criteria 확인
```

### Task 마크다운 형식

```markdown
---
id: task-001
title: 사용자 인증 API 구현
area: src/auth                  # 컨텍스트 제한 범위
assigned_agent: claude-sonnet-4
reviewer: claude-opus-4
status: in_progress
---

## References
# Execute 시 자동으로 컨텍스트에 포함됨
- /docs/api-spec.md
- /src/types/user.ts
- /src/types/auth.ts
- /src/utils/jwt.ts
- /tests/auth.test.ts

## Success Criteria
- [ ] JWT 토큰 생성 및 검증 구현
- [ ] 단위 테스트 커버리지 85% 이상
- [ ] API 응답 시간 < 200ms

## Description
작업 상세 설명 및 구현 요구사항...
```

### 주요 이점

| 항목 | 일반 Execute | Task 기반 Execute |
|------|-------------|------------------|
| 컨텍스트 | 수동 지정 필요 | 자동 구성 (References) |
| 작업 범위 | 불명확 | Area로 명확히 제한 |
| 의존성 | 매번 파악 | 사전 분석됨 |
| 재실행 | 반복 설정 | Task 재사용 |
| 검증 | 수동 확인 | Success Criteria 자동 |

### 컨텍스트 최적화

**Area 설정**으로 불필요한 파일 차단:
```yaml
area: src/auth  # src/auth 외부 파일 자동 차단
```

**효과**:
- 토큰 절약 (필요한 파일만 로드)
- 빠른 실행 (컨텍스트 크기 감소)
- 실수 방지 (작업 범위 명확화)

## 개발 가이드

### 개발 모드 실행

```bash
# 의존성 설치
npm install

# 개발 모드 실행 (Vite dev server + Electron)
npm start

# 디버그 모드 실행 (DEBUG=true 환경변수)
npm run start:debug
```

`npm start`는 Electron Forge를 통해 Vite dev server와 Electron 프로세스를 동시에 시작합니다. Vite가 HMR을 제공하므로 React 코드 수정 시 자동으로 반영됩니다.

### 빌드 및 패키징

```bash
# macOS 패키징 (테스트용)
npm run package:mac

# macOS 배포용 빌드 (DMG + ZIP)
npm run build:mac

# lint
npm run lint
npm run lint:fix

# 테스트
npm test
npm run test:ui
npm run test:coverage
```

### MCP 서버 설정

개발/분석 시 용도에 맞는 MCP 설정을 선택합니다:

| 설정 파일 | 용도 | 포함 서버 |
|-----------|------|----------|
| `.claude/.mcp-dev.json` | 개발 | serena + context7 |
| `.claude/.mcp-analysis.json` | 분석 | serena + sequential-thinking |
| `.claude/.mcp-e2e.json` | E2E 테스트 | 전체 |
| `.claude/.mcp-ui.json` | UI 개발 | UI 관련 |
| `.claude/.mcp-empty.json` | 최소 | 없음 |

CLI에서 직접 사용:
```bash
claude --mcp-config .claude/.mcp-dev.json --strict-mcp-config -p "분석 요청"
```

### 라이브러리 개발 (@context-action/code-api)

```bash
cd packages/code-api

# 라이브러리 빌드
npm run build

# 테스트 실행
npm test

# 예제 실행
npm run example:query
npm run example:json
```

### 라이브러리를 다른 프로젝트에서 사용

```bash
# npm link로 로컬 개발
cd packages/code-api
npm link

cd your-other-project
npm link @context-action/code-api
```

```typescript
// 다른 프로젝트에서 사용
import { ClaudeClient, ProcessManager } from '@context-action/code-api';

const client = new ClaudeClient({ ... });
```

## 레거시 코드 관리

### src-old 디렉토리

`src-old/`는 이전 아키텍처의 전체 소스코드를 보관하는 아카이브 디렉토리입니다. 대규모 리팩토링 과정에서 기존 코드를 참조용으로 보존해둔 것으로, 빌드나 실행에는 포함되지 않습니다.

### 리팩토링 요약

기존 아키텍처에서 제거된 모듈:
- **Agent/Task/Skill 관리**: AgentLoader, TaskLifecycleManager, SkillRepositoryManager 등
- **LangGraph 엔진**: LangGraphEngine, WorkflowEngine, 그래프 시각화
- **CentralDatabase**: 중앙 데이터베이스 및 쿼리 시스템
- **전용 페이지**: AgentsPage, TasksPage, SkillsPage, WorkflowPage, BookmarksPage 등 ~20개 페이지
- **기타 서비스**: AppLogger, SessionAnalyzer, ExecutionQueue, AgentTracker 등

새로 추가된 모듈:
- **멀티 CLI 지원**: Claude/Codex/Gemini 통합 (`ToolContext`, `sessionProvider`, `MultiCliExecutionService`)
- **Tool Registry**: 도구 검색 및 인벤토리 (`ToolRegistry`, `OptionInventoryManager`)
- **세션 분류기**: 로그 엔트리 분류 및 렌더링 (`sessionClassifier`, `ClassifiedLogEntry`)
- **세션 프로바이더**: CLI별 세션 로더 (`claudeSessions`, `codexSessions`, `geminiSessions`)

### 현재 페이지 구성 (8개)

| 페이지 | 파일 | 설명 |
|--------|------|------|
| Execute | `ExecutePage.tsx` | CLI 실행 및 스트리밍 |
| Sessions | `SessionsPage.tsx` | 세션 로그 조회 및 분류 뷰어 |
| MCP Configs | `McpConfigsPage.tsx` | MCP 서버 설정 관리 |
| Skills | `SkillsPage.tsx` | CLI 버전 확인/업데이트, 설치된 스킬 활성화 관리 |
| Ref Hooks | `ReferenceHooksPage.tsx` | MoAI/Ralph hook 레퍼런스 조회 및 미리보기 |
| Ref Styles | `ReferenceOutputStylesPage.tsx` | MoAI/Ralph output style/theme 레퍼런스 조회 |
| Ref Skills | `ReferenceSkillsPage.tsx` | MoAI/Ralph SKILL.md 레퍼런스 조회 |
| Settings | `SettingsPage.tsx` | 앱 설정 |

### src-old 참조 시 주의사항

- `src-old/`의 코드는 현재 아키텍처와 호환되지 않습니다
- import 경로, 타입 정의, IPC 채널이 모두 변경되었습니다
- 기능 복원이 필요한 경우 현재 아키텍처에 맞게 재작성해야 합니다
- 리팩토링이 완료되면 `src-old/`는 삭제할 수 있습니다

## 참고 문서

### 프로젝트 문서
- [빌드 및 설치 가이드](./docs/BUILD_GUIDE.md) - macOS 앱 빌드 및 배포 방법
- [설정 가이드](./docs/SETUP.md) - 권한 및 MCP 서버 설정 방법
- [MCP 설정 가이드](./docs/mcp-config-guide.md) - 작업별 MCP 서버 선택
- [MCP Tools Reference](./docs/mcp-tools-reference.md) - 전체 도구 목록
- [실행 전략](./docs/claude-context/usage/claude-execution-strategy.md) - 최적화된 실행 패턴
- [권한 설정](./docs/claude-context/config/permissions-configuration.md) - 세밀한 권한 제어
- [프로젝트 비전](./CLAUDE.md) - 프로젝트 목표 및 비전

### 공식 문서
- [Claude Code Headless 공식 문서](https://docs.claude.com/en/docs/claude-code/headless.md)
- [Claude Code Settings](https://docs.claude.com/en/docs/claude-code/settings)

## 라이선스

MIT
