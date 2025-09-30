# Stream UI Component Architecture

## 목적
Claude CLI의 Stream JSON Output을 가독성 있게 렌더링하는 React 컴포넌트 구조 설계

## 현재 문제점
- `App.tsx`의 `renderStreamEvent` 함수가 모든 렌더링 로직을 포함 (155줄)
- 인라인 스타일로 관리되어 일관성 없음
- 이벤트 타입별 렌더링 로직이 하나의 함수에 집중
- 재사용 불가능한 구조

## 설계 원칙
1. **함수형 컴포넌트**: 순수 함수로 구성, 사이드 이펙트 최소화
2. **단일 책임**: 각 컴포넌트는 하나의 이벤트 타입만 렌더링
3. **컴포지션**: 작은 컴포넌트를 조합하여 복잡한 UI 구성
4. **타입 안전성**: TypeScript를 활용한 엄격한 타입 체크
5. **재사용성**: Props를 통한 유연한 커스터마이징

## 컴포넌트 계층 구조

```
src/components/
├── stream/                          # Stream 관련 컴포넌트
│   ├── StreamOutput.tsx            # 메인 컨테이너
│   ├── StreamEventRenderer.tsx     # 이벤트 라우터
│   │
│   ├── events/                     # 이벤트별 렌더러
│   │   ├── SystemInitEvent.tsx
│   │   ├── AssistantEvent.tsx
│   │   ├── ResultEvent.tsx
│   │   ├── ErrorEvent.tsx
│   │   └── UnknownEvent.tsx
│   │
│   └── common/                     # 공통 하위 컴포넌트
│       ├── EventBox.tsx           # 이벤트 컨테이너
│       ├── TokenUsage.tsx         # 토큰 사용량 표시
│       ├── ToolUse.tsx            # 툴 사용 표시
│       ├── CodeBlock.tsx          # 코드 블록
│       └── InfoBadge.tsx          # 정보 배지
│
├── ui/                             # 범용 UI 컴포넌트
│   ├── Button.tsx
│   ├── Input.tsx
│   └── Badge.tsx
│
└── layout/                         # 레이아웃 컴포넌트
    ├── Header.tsx
    ├── InputSection.tsx
    └── OutputSection.tsx
```

## 컴포넌트 명세

### 1. StreamOutput (컨테이너)
**책임**: 스트림 이벤트 목록을 받아 전체 출력 영역 렌더링
```typescript
interface StreamOutputProps {
  events: StreamEvent[];
  errors: Array<{ id: string; message: string }>;
  currentPid: number | null;
}
```

### 2. StreamEventRenderer (라우터)
**책임**: 이벤트 타입을 판별하여 적절한 렌더러로 라우팅
```typescript
interface StreamEventRendererProps {
  event: StreamEvent;
  index: number;
}
```

### 3. 이벤트별 렌더러

#### SystemInitEvent
**표시 정보**:
- Session ID
- CWD (작업 디렉토리)
- Model
- Available Tools
- MCP Servers 상태

#### AssistantEvent
**표시 정보**:
- 텍스트 콘텐츠
- 툴 사용 목록
- 토큰 사용량 (input/output)
- Cache 정보

**하위 컴포넌트**:
- `ToolUse`: 각 툴 호출 표시
- `TokenUsage`: 토큰 통계

#### ResultEvent
**표시 정보**:
- 성공/실패 상태
- 최종 결과 텍스트
- 실행 시간 (total, API)
- Turn 수
- 총 비용
- 누적 토큰 사용량

#### ErrorEvent
**표시 정보**:
- 에러 타입
- 에러 메시지

### 4. 공통 컴포넌트

#### EventBox
모든 이벤트의 컨테이너, 일관된 스타일 제공
```typescript
interface EventBoxProps {
  type: 'system' | 'assistant' | 'result' | 'error' | 'unknown';
  icon?: string;
  title: string;
  children: React.ReactNode;
}
```

#### TokenUsage
토큰 사용량을 시각화
```typescript
interface TokenUsageProps {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}
```

#### ToolUse
툴 사용 내역 표시
```typescript
interface ToolUseProps {
  id: string;
  name: string;
  input: Record<string, unknown>;
}
```

#### CodeBlock
코드/JSON 블록 표시
```typescript
interface CodeBlockProps {
  code: string;
  language?: 'json' | 'typescript' | 'text';
  maxHeight?: number;
}
```

## 스타일링 전략

### CSS Modules 사용
- 각 컴포넌트별 `.module.css` 파일
- 클래스 이름 충돌 방지
- 타입 안전한 스타일 참조

### 색상 팔레트
```css
:root {
  /* Event Types */
  --color-system: #007acc;
  --color-assistant: #28a745;
  --color-result: #17a2b8;
  --color-error: #dc3545;

  /* UI Elements */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8f9fa;
  --color-border: #dee2e6;

  /* Text */
  --color-text-primary: #212529;
  --color-text-secondary: #6c757d;
  --color-text-muted: #adb5bd;
}
```

## 데이터 흐름

```
App.tsx
  ↓ events: StreamEvent[]
StreamOutput.tsx
  ↓ event: StreamEvent (map)
StreamEventRenderer.tsx
  ↓ Type Guard 판별
  ├→ SystemInitEvent.tsx
  ├→ AssistantEvent.tsx
  │    ├→ ToolUse.tsx
  │    └→ TokenUsage.tsx
  ├→ ResultEvent.tsx
  │    └→ TokenUsage.tsx
  ├→ ErrorEvent.tsx
  └→ UnknownEvent.tsx
       └→ CodeBlock.tsx
```

## 구현 단계

### Phase 1: 기본 구조
1. ✅ 컴포넌트 디렉토리 구조 생성
2. ✅ 공통 컴포넌트 구현 (EventBox, CodeBlock)
3. ✅ StreamEventRenderer 구현

### Phase 2: 이벤트 렌더러
4. ✅ SystemInitEvent 컴포넌트
5. ✅ AssistantEvent 컴포넌트
6. ✅ ResultEvent 컴포넌트
7. ✅ ErrorEvent 컴포넌트

### Phase 3: 하위 컴포넌트
8. ✅ ToolUse 컴포넌트
9. ✅ TokenUsage 컴포넌트
10. ✅ InfoBadge 컴포넌트

### Phase 4: 통합 및 스타일링
11. ✅ App.tsx 리팩토링
12. ✅ CSS Modules 적용
13. ✅ 애니메이션 효과 추가

### Phase 5: 향상된 기능
14. 코드 하이라이팅
15. 이벤트 필터링
16. 이벤트 검색
17. 토큰 사용량 차트

## 예상되는 개선 효과

1. **가독성**: 이벤트 타입별로 최적화된 UI
2. **유지보수성**: 각 컴포넌트가 독립적으로 관리 가능
3. **확장성**: 새로운 이벤트 타입 추가 용이
4. **재사용성**: 공통 컴포넌트를 다른 곳에서도 활용 가능
5. **테스트 용이성**: 각 컴포넌트 단위 테스트 가능

## 다음 단계

1. `src/components` 디렉토리 생성
2. 공통 컴포넌트 구현 (EventBox, CodeBlock)
3. 이벤트별 렌더러 구현
4. App.tsx 리팩토링
5. 스타일 적용 및 테스트
