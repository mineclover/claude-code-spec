# Event Components

Claude Code 세션 로그 및 스트림 이벤트를 렌더링하는 컴포넌트 시스템입니다.

## 아키텍처 개요

```
UnifiedEventRenderer (통합 렌더러)
    ↓
EventRegistry (이벤트 타입 감지 및 라우팅)
    ↓
EventBox (공통 컨테이너)
    ↓
[Session Events] 또는 [Stream Events]
```

## 핵심 컴포넌트

### 1. EventBox (공통 컨테이너)

**위치:** `src/components/stream/common/EventBox.tsx`

모든 이벤트의 기본 렌더링 컨테이너입니다.

**Props:**
```typescript
interface EventBoxProps {
  type: EventType;           // 'system' | 'assistant' | 'result' | 'error' | 'user' | 'unknown'
  icon?: string;             // 이벤트 아이콘 (emoji)
  title: string;             // 이벤트 제목
  children: React.ReactNode; // 이벤트 내용
  rawData?: unknown;         // Raw 데이터 복사용
  isSidechain?: boolean;     // 서브 에이전트 여부
}
```

**스타일링:**
- 타입별 색상 구분 (system: 파란색, assistant: 초록색, error: 빨간색 등)
- 서브 에이전트 시각화:
  - 왼쪽 들여쓰기 (24px)
  - 점선 테두리
  - "Sub-Agent" 배지
  - 화살표 아이콘 (↳)

**예시:**
```tsx
<EventBox
  type="assistant"
  icon="🤖"
  title="Assistant Response"
  isSidechain={true}
  rawData={event}
>
  <div>Assistant's response content...</div>
</EventBox>
```

### 2. UnifiedEventRenderer (통합 렌더러)

**위치:** `src/components/common/UnifiedEventRenderer.tsx`

Stream 이벤트와 Session Log 엔트리를 모두 처리하는 통합 렌더링 시스템입니다.

**특징:**
- 이벤트 레지스트리 기반 자동 라우팅
- Stream/Session 이벤트 모두 지원
- ErrorBoundary로 안전성 보장
- 타입별 전용 컴포넌트 자동 선택

**동작 방식:**
```typescript
1. Event 타입 감지 (eventRegistry.detectEventType)
2. 적절한 렌더러 조회 (eventRegistry.getRenderer)
3. 해당 컴포넌트로 렌더링
4. ErrorBoundary로 래핑
```

**Props:**
```typescript
interface UnifiedEventRendererProps {
  event: UnifiedEvent;  // Stream 또는 Session 이벤트
  index?: number;       // 리스트 인덱스
}
```

## Session Event Components

Session Log 파일(`.jsonl`)의 이벤트를 렌더링합니다.

### MessageEvent

**위치:** `src/components/sessions/events/MessageEvent.tsx`

**역할:** User/Assistant 메시지 렌더링

**처리 타입:**
- String content: 단순 텍스트 메시지
- Array content (text): 여러 텍스트 블록
- Array content (complex): Tool result 등 복잡한 구조

**렌더링 규칙:**
```typescript
if (role === 'user') {
  icon = '👤', type = 'system'
} else if (role === 'assistant') {
  icon = '🤖', type = 'assistant'
}
```

### SummaryEvent

**위치:** `src/components/sessions/events/SummaryEvent.tsx`

**역할:** 세션 요약 정보 표시

**표시 정보:**
- `event.summary`: 요약 내용
- `event.leafUuid`: Leaf UUID (옵션)

### UnknownSessionEvent

**위치:** `src/components/sessions/events/UnknownSessionEvent.tsx`

**역할:** 알 수 없는 세션 이벤트 표시

**표시 방식:**
- JSON 형태로 전체 이벤트 표시
- 디버깅용

## Stream Event Components

실시간 스트림(stream-json) 이벤트를 렌더링합니다.

### SystemInitEvent

**위치:** `src/components/stream/events/SystemInitEvent.tsx`

**역할:** 시스템 초기화 정보 표시

**표시 정보:**
- Session ID, Model, Working Directory
- Built-in Tools 목록
- MCP Servers 상태 (connected/disconnected)
- Slash Commands
- Permission Mode, API Key Source

### UserEvent

**위치:** `src/components/stream/events/UserEvent.tsx`

**역할:** User 메시지 및 Tool Result 표시

**처리 타입:**
- Tool Result (array): `tool_use_id` 별로 결과 표시
- Local Command Output: ANSI 제거 후 표시
- Regular Message: 일반 사용자 메시지

### AssistantEvent

**위치:** `src/components/stream/events/AssistantEvent.tsx`

**역할:** Assistant 응답 및 Tool Use 표시

**표시 정보:**
- Text Content: 텍스트 응답
- Tool Uses: 사용한 도구 목록 (name, input)
- Token Usage: 입력/출력 토큰, 캐시 정보

### ResultEvent

**위치:** `src/components/stream/events/ResultEvent.tsx`

**역할:** 최종 실행 결과 표시

**표시 정보:**
- Result Text
- Duration (ms), API Duration (ms)
- Number of Turns
- Total Cost (USD)
- Token Usage

### ErrorEvent

**위치:** `src/components/stream/events/ErrorEvent.tsx`

**역할:** 에러 정보 표시

**표시 정보:**
- Error Type
- Error Message

### UnknownEvent

**위치:** `src/components/stream/events/UnknownEvent.tsx`

**역할:** 알 수 없는 스트림 이벤트 표시

**표시 방식:**
- JSON 형태로 전체 이벤트 표시
- `isSidechain` 필드 자동 감지

## Event Registry

**위치:** `src/lib/event-registry.ts`

이벤트 타입 감지 및 렌더러 매핑을 담당합니다.

**주요 기능:**
```typescript
// 이벤트 타입 감지
eventRegistry.detectEventType(event)
  → EventType.SYSTEM_INIT | USER | ASSISTANT | ...

// 렌더러 등록
eventRegistry.registerRenderer({
  eventType: EventType.ASSISTANT,
  component: AssistantEvent
})

// 렌더러 조회
eventRegistry.getRenderer(EventType.ASSISTANT)
  → { eventType, component }
```

## isSidechain (서브 에이전트) 지원

모든 이벤트 컴포넌트는 `isSidechain` 필드를 지원합니다.

### 시각적 구분

**EventBox 스타일링:**
```css
.sidechain {
  margin-left: 24px;           /* 들여쓰기 */
  border-left-style: dashed;   /* 점선 테두리 */
  opacity: 0.9;                /* 약간 투명 */
}

.sidechain::before {
  content: '↳';                /* 화살표 아이콘 */
  position: absolute;
  left: -20px;
}

.sidechainBadge {
  /* "Sub-Agent" 배지 스타일 */
}
```

### 전달 방식

모든 이벤트 컴포넌트는 EventBox에 `isSidechain` prop을 전달합니다:

```typescript
// Session Event 예시
<EventBox
  type="assistant"
  icon="🤖"
  title="Assistant"
  isSidechain={event.isSidechain}  // ← 전달
>
  ...
</EventBox>

// Stream Event 예시
<EventBox
  type="system"
  icon="🔧"
  title="System Initialized"
  isSidechain={event.isSidechain}  // ← 전달
>
  ...
</EventBox>
```

## 사용 예시

### Session Log 렌더링

```tsx
import { UnifiedEventRenderer } from '@/components/common/UnifiedEventRenderer';

// Session log events
const events = await claudeAPI.sessions.readLog(projectPath, sessionId);

return (
  <div>
    {events.map((event, index) => (
      <UnifiedEventRenderer
        key={event.uuid || index}
        event={event}
        index={index}
      />
    ))}
  </div>
);
```

### Stream 렌더링

```tsx
import { UnifiedEventRenderer } from '@/components/common/UnifiedEventRenderer';

// Stream events
const [events, setEvents] = useState<StreamEvent[]>([]);

// Stream으로 이벤트 수신
claudeAPI.onClaudeResponse((event) => {
  setEvents(prev => [...prev, event]);
});

return (
  <div>
    {events.map((event, index) => (
      <UnifiedEventRenderer
        key={index}
        event={event}
        index={index}
      />
    ))}
  </div>
);
```

## 확장 방법

### 새로운 이벤트 타입 추가

1. **이벤트 컴포넌트 작성:**
```tsx
// src/components/stream/events/MyCustomEvent.tsx
export const MyCustomEvent: React.FC<{ event: MyEventType }> = ({ event }) => {
  return (
    <EventBox type="custom" icon="⚡" title="Custom Event" isSidechain={event.isSidechain}>
      {/* 커스텀 렌더링 */}
    </EventBox>
  );
};
```

2. **레지스트리에 등록:**
```typescript
// UnifiedEventRenderer.tsx
eventRegistry.registerRenderer({
  eventType: EventType.CUSTOM,
  component: MyCustomEvent
});
```

3. **타입 가드 추가 (필요시):**
```typescript
// src/lib/event-registry.ts
function detectEventType(event: UnifiedEvent): EventType {
  if ('customField' in event) return EventType.CUSTOM;
  // ...
}
```

## 스타일 커스터마이징

### EventBox 타입별 색상 변경

```css
/* EventBox.module.css */
.myCustomType {
  border-left: 4px solid #ff6b6b;
  background-color: #fff5f5;
}
```

### 서브 에이전트 스타일 변경

```css
/* EventBox.module.css */
.sidechain {
  margin-left: 32px;  /* 들여쓰기 증가 */
  border-left-color: #9b59b6;  /* 색상 변경 */
}

.sidechain::before {
  content: '→';  /* 아이콘 변경 */
}
```

## 관련 문서

- [Task Tracking Strategy](./task-tracking-strategy.md) - 병렬 Task 추적 전략
- [UI Component Architecture](../../ui-component-architecture.md) - 전체 UI 아키텍처
- [Event Registry](../../../src/lib/event-registry.ts) - 이벤트 레지스트리 구현
