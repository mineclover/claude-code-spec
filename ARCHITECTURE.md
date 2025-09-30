# Architecture Documentation

## Overview

Claude Code Headless Controller는 Claude CLI를 Electron 앱에서 headless 모드로 실행하고, stream-json 형식으로 실시간 출력을 표시하는 데스크톱 애플리케이션입니다.

## 아키텍처 구성

### 1. 모듈 구조

```
src/
├── lib/
│   ├── StreamParser.ts      # JSON 스트림 파싱
│   ├── ClaudeClient.ts       # Claude CLI 실행 관리
│   └── SessionManager.ts     # 세션 이력 관리
├── main.ts                   # Electron Main Process
├── preload.ts                # IPC Bridge
├── App.tsx                   # React UI
└── global.d.ts               # TypeScript 타입 정의
```

### 2. 핵심 모듈

#### **StreamParser.ts**
- 역할: Line-by-line JSON 파싱
- 기능:
  - 버퍼 관리로 불완전한 JSON 라인 처리
  - 완전한 JSON 객체만 파싱하여 콜백 전달
  - 에러 핸들링

```typescript
const parser = new StreamParser(
  (event) => handleEvent(event),
  (error) => handleError(error)
);

parser.processChunk(data); // stdout chunk 처리
parser.flush();             // 남은 버퍼 처리
parser.reset();             // 상태 초기화
```

#### **ClaudeClient.ts**
- 역할: Claude CLI 프로세스 실행 및 관리
- 기능:
  - `--input-format stream-json` + `--output-format stream-json` 방식 사용
  - 세션 ID를 통한 대화 이어가기 (`--resume`)
  - stdin으로 사용자 메시지 전송
  - stdout에서 stream-json 수신
  - 자동 세션 ID 추출 및 저장

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

#### **SessionManager.ts**
- 역할: 세션 이력 관리
- 기능:
  - 세션 정보 저장 (ID, 경로, 쿼리, 타임스탬프)
  - 세션 조회 (전체 리스트, 개별 조회)
  - 현재 세션 추적
  - 결과 업데이트

```typescript
sessionManager.saveSession(sessionId, {
  cwd: '/path',
  query: 'My query',
  timestamp: Date.now(),
});

const sessions = sessionManager.getAllSessions(); // 최신순 정렬
const current = sessionManager.getCurrentSessionId();
```

### 3. IPC 통신

#### Main → Renderer 이벤트
- `claude:started` - 프로세스 시작 (PID 포함)
- `claude:stream` - Stream JSON 이벤트
- `claude:error` - 에러 메시지
- `claude:complete` - 프로세스 종료

#### Renderer → Main 핸들러
- `claude:execute` - Claude CLI 실행
- `claude:get-sessions` - 세션 리스트 조회
- `claude:get-current-session` - 현재 세션 ID 조회
- `claude:resume-session` - 세션 이어가기
- `claude:clear-sessions` - 세션 초기화
- `dialog:selectDirectory` - 디렉토리 선택

### 4. Stream JSON 처리 흐름

```
1. User Input (Query)
   ↓
2. ClaudeClient.execute()
   ↓ stdin
3. Claude CLI (stream-json mode)
   ↓ stdout (line-by-line JSON)
4. StreamParser.processChunk()
   ↓ parsed events
5. onStream callback
   ↓ IPC: claude:stream
6. Renderer (App.tsx)
   ↓
7. UI Update (실시간 표시)
```

### 5. Stream JSON 이벤트 타입

Claude CLI가 출력하는 주요 이벤트:

- **`system` (subtype: `init`)**: 세션 초기화
  - `session_id`: 세션 ID
  - `cwd`: 작업 디렉토리
  - `tools`: 사용 가능한 도구 목록

- **`assistant`**: Claude의 응답
  - `message.content[]`: 응답 내용 (텍스트, 도구 사용 등)

- **`result`**: 최종 결과
  - `result`: 최종 응답 텍스트
  - `total_cost_usd`: 비용
  - `duration_ms`: 소요 시간

## 사용 방법

### 1. 단일 요청

```typescript
// Main process에서
const client = new ClaudeClient({
  cwd: projectPath,
  onStream: (event) => {
    // event.type: 'system', 'assistant', 'result' 등
    renderer.send('claude:stream', event);
  }
});

client.execute(query);
```

### 2. 세션 이어가기

```typescript
// 이전 세션 ID로 계속하기
const client = new ClaudeClient({
  cwd: projectPath,
  sessionId: 'c66c5a19-94d4-4014-9b27-139de5658d0b',
  onStream: (event) => { /* ... */ }
});

client.execute('Follow-up question');
```

### 3. 세션 관리

```typescript
// 세션 저장
sessionManager.saveSession(sessionId, {
  cwd: '/path/to/project',
  query: 'Original query',
  timestamp: Date.now()
});

// 모든 세션 조회 (최신순)
const sessions = sessionManager.getAllSessions();

// 특정 세션 조회
const session = sessionManager.getSession(sessionId);
```

## 재사용 가능한 설계

### 단일 요청 구조
세션 ID를 통해 대화를 이어갈 수 있으므로, 각 요청은 독립적으로 실행됩니다:

1. 새 요청 → 자동으로 새 세션 생성
2. 후속 요청 → 이전 세션 ID 전달 → 대화 이어가기

### 모듈 재사용
각 모듈은 독립적으로 사용 가능:

```typescript
// StreamParser만 사용
import { StreamParser } from './lib/StreamParser';

// ClaudeClient만 사용 (CLI 실행)
import { ClaudeClient } from './lib/ClaudeClient';

// SessionManager만 사용 (세션 관리)
import { SessionManager } from './lib/SessionManager';
```

## 파서의 중요성

StreamParser는 이 시스템의 핵심 컴포넌트입니다:

1. **버퍼 관리**: stdout에서 받는 데이터는 chunk 단위로 오므로, 불완전한 JSON 라인을 버퍼에 저장하고 완전한 라인만 파싱
2. **에러 내성**: 잘못된 JSON 라인이 와도 전체 시스템이 중단되지 않음
3. **성능**: 각 chunk를 즉시 처리하여 실시간 스트리밍 보장

## 결론

이 아키텍처는:
- ✅ **모듈화**: 각 기능이 독립된 모듈로 분리
- ✅ **재사용성**: 모듈을 다른 프로젝트에서 쉽게 재사용 가능
- ✅ **확장성**: 새로운 기능 추가 용이
- ✅ **유지보수성**: 명확한 책임 분리로 디버깅 쉬움
- ✅ **세션 관리**: 대화 이력 추적 및 이어가기 지원