# Claude Code Headless Controller

Electron 데스크톱 앱으로 Claude CLI를 헤드리스 모드로 실행하고, stream-json 형식의 실시간 출력을 웹 UI로 확인할 수 있는 도구입니다.

[image](img/image.png)



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

```bash
# 설치
npm install

# 개발 모드 실행
npm start

# 패키징 (테스트용)
npm run package

# 배포용 빌드 (ZIP 파일 생성)
npm run make
```

**macOS 앱으로 설치하기:** [빌드 및 설치 가이드](./docs/BUILD_GUIDE.md) 참고

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

### 핵심 모듈

#### **StreamParser** (`src/lib/StreamParser.ts`)
- Line-by-line JSON 파싱
- 불완전한 JSON 라인 버퍼링
- 에러 내성 파싱

```typescript
const parser = new StreamParser(
  (event) => handleEvent(event),
  (error) => handleError(error)
);
parser.processChunk(data);
```

#### **ClaudeClient** (`src/lib/ClaudeClient.ts`)
- Claude CLI 프로세스 실행 및 관리
- `-p` 플래그와 `--output-format stream-json` 사용
- 세션 ID 자동 추출 및 이어가기 지원

```typescript
const client = new ClaudeClient({
  cwd: '/path/to/project',
  sessionId: 'previous-session-id', // optional
  onStream: (event) => console.log(event),
  onError: (error) => console.error(error),
  onClose: (code) => console.log('Done:', code),
});

client.execute('List files in this directory');
```

#### **SessionManager** (`src/lib/SessionManager.ts`)
- 세션 정보 저장 및 조회
- 대화 이력 관리
- 세션 이어가기 지원

```typescript
sessionManager.saveSession(sessionId, {
  cwd: '/path',
  query: 'My query',
  timestamp: Date.now(),
});

const sessions = sessionManager.getAllSessions();
```

### 타입 시스템 (`src/lib/types.ts`)

완전한 TypeScript 타입 정의:

- **StreamEvent**: 모든 이벤트 타입의 Union Type
- **Type Guards**: isSystemInitEvent, isAssistantEvent, isResultEvent, isErrorEvent
- **Helper Functions**: extractTextFromMessage, extractToolUsesFromMessage

```typescript
import { isAssistantEvent, extractTextFromMessage } from './lib/types';

if (isAssistantEvent(event)) {
  const text = extractTextFromMessage(event.message);
  console.log(text);
}
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
src/
├── lib/
│   ├── types.ts              # TypeScript 타입 정의
│   ├── StreamParser.ts       # Stream JSON 파싱
│   └── taskParser.ts         # Task 마크다운 파싱
├── services/
│   ├── ProcessManager.ts     # 병렬 프로세스 관리
│   ├── SessionManager.ts     # 실행 이력 관리
│   └── appSettings.ts        # 앱 설정 관리
├── ipc/
│   ├── IPCRouter.ts          # IPC 라우팅 시스템
│   └── handlers/             # IPC 핸들러
│       ├── claudeHandlers.ts
│       ├── taskHandlers.ts
│       ├── settingsHandlers.ts
│       └── ...
├── preload/
│   └── apis/                 # Preload API 모듈
│       ├── claude.ts
│       ├── task.ts
│       └── ...
├── pages/                    # React 페이지
│   ├── ExecutionsPage.tsx    # 실행 목록
│   ├── ExecutionDetailPage.tsx # 실행 상세
│   ├── TasksPage.tsx         # 작업 관리
│   ├── ClaudeProjectsListPage.tsx
│   ├── ClaudeSessionsListPage.tsx
│   ├── MemoryPage.tsx
│   └── ...
├── components/               # React 컴포넌트
│   ├── layout/
│   ├── stream/
│   ├── execution/
│   └── ...
├── types/                    # 타입 정의
│   ├── api.ts
│   ├── task.ts
│   └── ...
├── main.ts                   # Electron Main Process
├── preload.ts                # IPC Bridge
├── App.tsx                   # React App
└── window.d.ts               # Window 타입 확장
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

### 모듈 재사용

각 모듈은 독립적으로 사용 가능합니다:

```typescript
// StreamParser만 사용
import { StreamParser } from './lib/StreamParser';

// ProcessManager만 사용
import { ProcessManager } from './services/ProcessManager';

// SessionManager만 사용
import { SessionManager } from './services/SessionManager';

// Task Parser만 사용
import { parseTaskMarkdown, generateTaskMarkdown } from './lib/taskParser';
```

### 타입 가드 활용

```typescript
import { isAssistantEvent, extractTextFromMessage } from './lib/types';

streamEvents.forEach(event => {
  if (isAssistantEvent(event)) {
    const text = extractTextFromMessage(event.message);
    console.log(text);
  }
});
```

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