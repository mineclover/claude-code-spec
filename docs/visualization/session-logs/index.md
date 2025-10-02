# Session Logs Visualization

세션 로그 시각화 관련 문서입니다.

## 문서 목록

### [Task Tracking Strategy](./task-tracking-strategy.md)
병렬 Task 실행 시 서브 에이전트 추적 전략

- 프롬프트 메타데이터 기반 추적
- 체크포인트 보고 시스템
- `triggering_tool_use_id` 필드 추가 전까지의 임시 솔루션

## 관련 컴포넌트

### Session Event Components
- `src/components/sessions/events/MessageEvent.tsx`
- `src/components/sessions/events/SummaryEvent.tsx`
- `src/components/sessions/events/UnknownSessionEvent.tsx`

### Stream Event Components
- `src/components/stream/events/AssistantEvent.tsx`
- `src/components/stream/events/UserEvent.tsx`
- `src/components/stream/events/SystemInitEvent.tsx`
- `src/components/stream/events/ResultEvent.tsx`
- `src/components/stream/events/ErrorEvent.tsx`

### Common Components
- `src/components/stream/common/EventBox.tsx` - 이벤트 렌더링 컨테이너
- `src/components/common/UnifiedEventRenderer.tsx` - 통합 이벤트 렌더러

## 주요 개념

### Sub-Agent (isSidechain)
- `isSidechain: true` - 서브 에이전트에서 실행된 이벤트
- `isSidechain: false` - 메인 에이전트 이벤트
- 시각적 구분: 들여쓰기, 점선 테두리, "Sub-Agent" 배지

### Event Types
- `system` - 시스템 초기화 및 설정
- `user` - 사용자 메시지 및 도구 결과
- `assistant` - Assistant 응답 및 도구 사용
- `result` - 최종 실행 결과
- `error` - 에러 이벤트

## 참고 문서

- [UI Component Architecture](../../ui-component-architecture.md)
- [Sub-Agent Basics](../../claude-context/sub-agent/sub-agent-basics.md)
