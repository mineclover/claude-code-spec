# Claude Code Headless Controller

Electron 데스크톱 앱으로 Claude CLI를 헤드리스 모드로 실행하고, stream-json 형식의 실시간 출력을 웹 UI로 확인할 수 있는 도구입니다.

## 주요 특징

- ✅ **Claude CLI Headless 모드**: 백엔드에서 `claude` CLI를 자동으로 실행
- ✅ **Stream JSON 실시간 파싱**: Line-by-line JSON 파싱으로 실시간 이벤트 처리
- ✅ **세션 관리**: Session ID를 통한 대화 이어가기 지원
- ✅ **모듈화 아키텍처**: 재사용 가능한 독립 모듈 설계
- ✅ **완전한 타입 안정성**: TypeScript로 작성된 타입 세이프한 코드
- ✅ **Electron IPC 통신**: Main/Renderer 프로세스 간 안전한 통신

## 실행 방법

```bash
# 설치
npm install

# 개발 모드 실행
npm start

# 패키징
npm run package
```

## 사용법

1. **프로젝트 디렉토리 선택**: Browse 버튼 또는 직접 입력
2. **쿼리 입력**: Claude에게 요청할 작업 입력
3. **Execute 클릭**: Claude CLI가 실행되고 실시간 응답 표시

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
│   ├── StreamParser.ts       # JSON 스트림 파싱
│   ├── ClaudeClient.ts       # Claude CLI 실행 관리
│   └── SessionManager.ts     # 세션 이력 관리
├── main.ts                   # Electron Main Process
├── preload.ts                # IPC Bridge
├── App.tsx                   # React UI
└── global.d.ts               # 글로벌 타입 정의
```

## 개발 가이드

### 모듈 재사용

각 모듈은 독립적으로 사용 가능합니다:

```typescript
// StreamParser만 사용
import { StreamParser } from './lib/StreamParser';

// ClaudeClient만 사용
import { ClaudeClient } from './lib/ClaudeClient';

// SessionManager만 사용
import { SessionManager } from './lib/SessionManager';
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

- [Claude Code Headless 공식 문서](https://docs.claude.com/en/docs/claude-code/headless.md)
- [아키텍처 상세 문서](./ARCHITECTURE.md)

## 라이선스

MIT