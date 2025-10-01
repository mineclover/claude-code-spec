# 용어집 (Glossary)

Claude CLI Analytics & Control Platform에서 사용하는 주요 용어 정의입니다.

## 핵심 개념

### Session (세션)
Claude CLI와의 전체 대화 단위입니다. 하나의 세션은 여러 개의 이벤트로 구성됩니다.

**관련 개념:**
- Session ID: 각 세션을 고유하게 식별하는 ID
- Session Log: 세션 내에서 발생한 모든 이벤트의 기록
- Session Summary: 세션의 요약 정보

**코드에서:**
```typescript
interface Session {
  sessionId: string;
  cwd: string;
  query: string;
  timestamp: number;
  result?: string;
}
```

### Event (이벤트)
세션 내에서 발생하는 개별 메시지나 액션의 단위입니다. Claude CLI의 stream JSON output에서 전달되는 각각의 항목입니다.

**이벤트 타입:**
- `system_init`: 시스템 초기화 이벤트
- `user`: 사용자 메시지 또는 도구 결과
- `assistant`: 어시스턴트 응답
- `result`: 최종 결과
- `error`: 에러 메시지
- `summary`: 세션 요약

**코드에서:**
```typescript
type StreamEvent =
  | SystemInitEvent
  | UserEvent
  | AssistantEvent
  | ResultEvent
  | ErrorEvent;
```

### Event Component (이벤트 컴포넌트)
특정 타입의 이벤트를 화면에 시각화하는 React 컴포넌트입니다.

**예시:**
- `SystemInitEvent`: 시스템 초기화 정보 표시
- `UserEvent`: 사용자 입력 또는 도구 결과 표시
- `AssistantEvent`: AI 응답 및 도구 사용 표시
- `ResultEvent`: 최종 결과 표시
- `ErrorEvent`: 에러 메시지 표시
- `UnknownEvent`: 알 수 없는 이벤트 표시

### Session Entry (세션 엔트리)
세션 로그에 저장된 개별 항목입니다. 이벤트와 유사하지만 로그 파일에 저장되는 형태입니다.

**코드에서:**
```typescript
interface ClaudeSessionEntry {
  type: string;
  timestamp: number;
  summary?: string;
  leafUuid?: string;
  message?: unknown;
  [key: string]: unknown;
}
```

## UI 컴포넌트

### Stream Output
실시간으로 Claude CLI의 응답을 표시하는 영역입니다. 이벤트들이 순차적으로 나열됩니다.

### Session Log Viewer
저장된 세션의 로그를 확인하는 뷰어입니다. 과거 세션의 모든 이벤트를 볼 수 있습니다.

### Event Renderer
이벤트의 타입에 따라 적절한 이벤트 컴포넌트로 라우팅하는 컴포넌트입니다.

**종류:**
- `StreamEventRenderer`: Stream Output용 이벤트 렌더러
- `SessionLogEventRenderer`: Session Log Viewer용 이벤트 렌더러

### Event Box
모든 이벤트 컴포넌트를 감싸는 공통 래퍼 컴포넌트입니다. 일관된 스타일과 레이아웃을 제공합니다.

## 아키텍처 패턴

### Unified Event System (통합 이벤트 시스템)
StreamEvent와 ClaudeSessionEntry를 통합하여 관리하는 중앙화된 이벤트 시스템입니다.

**핵심 컴포넌트:**
- **EventTypeRegistry**: 이벤트 타입 감지 및 렌더러 매핑을 관리하는 중앙 레지스트리
- **UnifiedEvent**: StreamEvent와 ClaudeSessionEntry를 포괄하는 통합 타입
- **UnifiedEventRenderer**: 모든 이벤트 타입을 처리하는 통합 렌더러

**장점:**
- Stream Output과 Session Log Viewer에서 동일한 렌더링 로직 사용
- 새로운 이벤트 타입 추가가 용이 (레지스트리에 등록만 하면 됨)
- 타입 안정성과 확장성 향상
- 중복 코드 제거

**구조:**
```typescript
// 1. 이벤트 타입 정의
export enum EventType {
  SYSTEM_INIT = 'system_init',
  USER = 'user',
  ASSISTANT = 'assistant',
  RESULT = 'result',
  ERROR = 'error',
  SUMMARY = 'summary',
  MESSAGE = 'message',
  UNKNOWN = 'unknown',
}

// 2. 레지스트리에 감지기 등록
eventRegistry.registerDetector({
  type: EventType.USER,
  priority: 90,
  detect: (event) => event.type === 'user' && 'message' in event,
});

// 3. 레지스트리에 렌더러 등록
eventRegistry.registerRenderer({
  eventType: EventType.USER,
  component: UserEvent,
});

// 4. 통합 렌더러 사용
export const UnifiedEventRenderer = ({ event }) => {
  const eventType = eventRegistry.detectEventType(event);
  const renderer = eventRegistry.getRenderer(eventType);
  const Component = renderer.component;
  return <Component event={event} />;
};
```

**파일 위치:**
- `src/lib/event-registry.ts`: 이벤트 타입 시스템 및 레지스트리
- `src/components/common/UnifiedEventRenderer.tsx`: 통합 이벤트 렌더러

### Event Renderer Pattern (이벤트 렌더러 패턴)
이벤트의 타입에 따라 적절한 컴포넌트를 선택하여 렌더링하는 디자인 패턴입니다.
이 패턴은 현재 Unified Event System으로 구현되어 있습니다.

**레거시 구현 (참고용):**
```typescript
export const StreamEventRenderer: React.FC<Props> = ({ event }) => {
  if (isSystemInitEvent(event)) {
    return <SystemInitEvent event={event} />;
  }
  if (isUserEvent(event)) {
    return <UserEvent event={event} />;
  }
  // ... 다른 타입들
  return <UnknownEvent event={event} />;
};
```

**현재 구현:**
```typescript
export const StreamEventRenderer: React.FC<Props> = ({ event, index }) => {
  return <UnifiedEventRenderer event={event} index={index} />;
};
```

## 기능

### Resume (재개)
중단된 세션을 이어서 계속 진행하는 기능입니다. 세션 ID를 사용하여 이전 대화 컨텍스트를 유지합니다.

### Load to Output (출력에 로드)
저장된 세션의 로그를 현재 Stream Output에 불러오는 기능입니다. 과거 대화를 확인하면서 새로운 작업을 할 수 있습니다.

### Session Management (세션 관리)
세션의 생성, 저장, 조회, 복원을 관리하는 시스템입니다.

## 데이터 저장

### Session Logger
세션의 이벤트를 파일 시스템에 로깅하는 서비스입니다.

**저장 위치:**
```
<projectPath>/.claude/sessions/<sessionId>/
├── events.jsonl      # 이벤트 로그 (JSONL 형식)
└── summary.json      # 세션 요약
```

### Session Manager
세션 정보를 메모리와 파일에 저장하고 관리하는 서비스입니다.

**저장 위치:**
```
<projectPath>/.claude/sessions.json
```

## IPC (Inter-Process Communication)

### IPC Router
Main process와 Renderer process 간의 통신을 관리하는 중앙 라우터입니다.

### IPC Handler
특정 기능에 대한 IPC 요청을 처리하는 핸들러 함수들의 집합입니다.

**종류:**
- `claudeHandlers`: Claude CLI 실행 관련
- `loggerHandlers`: 로깅 관련
- `sessionHandlers`: 세션 관리 관련
- `settingsHandlers`: 설정 관리 관련
- `bookmarksHandlers`: 북마크 관리 관련
- `dialogHandlers`: 다이얼로그 관련
- `appSettingsHandlers`: 앱 설정 관련

## 용어 사용 가이드

### "Event" vs "Session Entry"
- **Event**: 실시간 스트림에서 전달되는 데이터 → Stream Output에서 사용
- **Session Entry**: 로그 파일에 저장된 데이터 → Session Log Viewer에서 사용

### "Session" vs "Conversation"
- **Session**: 기술적 용어, 코드와 시스템에서 사용
- **Conversation**: 사용자 대면 용어, UI 텍스트에서 사용 가능

### 컴포넌트 네이밍
- **Event 표시 컴포넌트**: `[EventType]Event` (예: `UserEvent`, `AssistantEvent`)
- **Event 렌더러**: `[Context]EventRenderer` (예: `StreamEventRenderer`, `SessionLogEventRenderer`)
- **공통 래퍼**: `EventBox`

## 참고

이 용어집은 프로젝트의 성장과 함께 지속적으로 업데이트됩니다.
새로운 용어나 개념이 추가되면 이 문서에 기록해주세요.
