# Claude CLI Analytics Platform Architecture

## Overview
Electron 기반의 3-tier 아키텍처로 Main Process, Preload Script, Renderer Process를 완전히 격리하여 보안성과 확장성을 보장합니다.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      Renderer Process                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Presentation Layer                 │   │
│  │  ├── components/     (UI 컴포넌트)                   │   │
│  │  ├── pages/          (페이지 컴포넌트)               │   │
│  │  └── hooks/          (React Hooks)                  │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                    State Layer                      │   │
│  │  ├── stores/         (Zustand/Redux)                │   │
│  │  ├── contexts/       (React Context)                │   │
│  │  └── queries/        (React Query)                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Preload Bridge   │
                    │  (Context Bridge)  │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                       Main Process                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   IPC Layer                         │   │
│  │  ├── handlers/       (IPC 핸들러)                   │   │
│  │  ├── channels/       (채널 정의)                    │   │
│  │  └── validators/     (요청 검증)                    │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                 Service Layer                       │   │
│  │  ├── services/                                      │   │
│  │  │   ├── ClaudeService     (Claude CLI 실행)       │   │
│  │  │   ├── LoggerService     (로깅)                  │   │
│  │  │   ├── SessionService    (세션 관리)             │   │
│  │  │   ├── AnalyticsService  (분석)                  │   │
│  │  │   └── ConfigService     (설정 관리)             │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                  Core Layer                         │   │
│  │  ├── core/                                          │   │
│  │  │   ├── ProcessManager    (프로세스 관리)         │   │
│  │  │   ├── StreamManager     (스트림 처리)           │   │
│  │  │   └── EventBus          (이벤트 시스템)         │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                  Data Layer                         │   │
│  │  ├── repositories/   (데이터 저장소)                │   │
│  │  ├── models/         (데이터 모델)                  │   │
│  │  └── database/       (SQLite/LevelDB)              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── main/                    # Main Process
│   ├── ipc/                # IPC Communication
│   │   ├── handlers/       # IPC 핸들러
│   │   ├── channels/       # 채널 정의
│   │   └── validators/     # 입력 검증
│   ├── services/           # Business Logic
│   │   ├── claude/
│   │   ├── logger/
│   │   ├── session/
│   │   ├── analytics/
│   │   └── config/
│   ├── core/              # Core Utilities
│   │   ├── process/
│   │   ├── stream/
│   │   └── events/
│   ├── data/              # Data Access
│   │   ├── repositories/
│   │   ├── models/
│   │   └── database/
│   └── index.ts
│
├── preload/               # Preload Scripts
│   ├── api/              # Exposed APIs
│   ├── validators/       # Security Validators
│   └── index.ts
│
├── renderer/              # Renderer Process
│   ├── components/       # UI Components
│   ├── pages/           # Page Components
│   ├── hooks/           # Custom Hooks
│   ├── stores/          # State Management
│   ├── services/        # Renderer Services
│   ├── utils/           # Utilities
│   └── index.tsx
│
└── shared/               # Shared Code
    ├── types/           # Type Definitions
    ├── constants/       # Constants
    └── utils/           # Shared Utilities
```

## State Management

### ProjectContext
애플리케이션 전역 프로젝트 상태를 관리하는 React Context 시스템입니다.

#### 구조
```typescript
interface ProjectContextValue {
  projectPath: string | null;          // 현재 프로젝트 경로
  projectDirName: string | null;       // 프로젝트 디렉토리 이름
  updateProject: (path, dirName) => void;
  clearProject: () => void;
}
```

#### 주요 특징
- **전역 상태 공유**: 모든 페이지에서 `useProject()` 훅으로 접근
- **영속성**: 메인 프로세스 설정을 통한 세션 간 유지
- **자동 동기화**: Context 변경 시 관련 컴포넌트 자동 업데이트

#### 사용 컴포넌트
- `ExecutePage`: Context에서 프로젝트 경로 읽어 입력 필드 자동 설정
- `ClaudeProjectsList`: 프로젝트 선택 시 Context 업데이트
- `McpConfigsPage`: 현재 프로젝트 기반 MCP 설정 관리
- `Layout`: 사이드바에 현재 프로젝트 표시

#### 데이터 흐름
```
사용자 프로젝트 선택
  ↓
await updateProject(path, dirName)
  ↓
메인 프로세스 설정 저장 (appSettingsAPI)
  ↓
Context 상태 업데이트
  ↓
구독 중인 컴포넌트 자동 갱신
```

자세한 내용은 [ProjectContext 문서](./controller-docs/project-context.md)를 참조하세요.

## IPC Communication Pattern

### 1. Request-Response Pattern
```typescript
// Renderer → Main
const result = await window.api.invoke('channel:action', payload);

// Main
ipcMain.handle('channel:action', async (event, payload) => {
  // Validate, Process, Return
});
```

### 2. Event Streaming Pattern
```typescript
// Main → Renderer
webContents.send('channel:stream', data);

// Renderer
window.api.on('channel:stream', (data) => {
  // Handle stream data
});
```

### 3. Bidirectional Communication
```typescript
// Renderer initiates
const subscription = window.api.subscribe('channel:updates', (data) => {
  // Handle updates
});

// Main broadcasts
broadcastToAll('channel:updates', data);
```

## Security Principles

1. **Context Isolation**: 완전한 컨텍스트 격리
2. **Input Validation**: 모든 IPC 입력 검증
3. **Sandboxing**: Renderer 프로세스 샌드박싱
4. **Least Privilege**: 최소 권한 원칙
5. **Secure Defaults**: 보안 기본 설정

## Service Layer Design

### ClaudeService
- Claude CLI 프로세스 관리
- 스트림 파싱 및 전달
- 세션 상태 관리
- 에러 핸들링

### LoggerService
- 이벤트 로깅
- 로그 로테이션
- 로그 검색 및 필터링
- 성능 메트릭 수집

### SessionService
- 세션 생성/복구
- 세션 히스토리
- 세션 메타데이터
- 세션 내보내기/가져오기

### AnalyticsService
- 토큰 사용량 분석
- 응답 시간 측정
- 비용 계산
- 패턴 분석

### ConfigService
- 설정 관리
- 프로필 관리
- 환경 변수 관리
- 플러그인 설정

## Data Flow

```
User Input → Renderer → Preload API → IPC Channel → Main Handler
    ↓                                                      ↓
UI Update ← Preload API ← IPC Event ← Service Layer ← Validation
```

## Event Bus System

```typescript
interface EventBus {
  emit(event: string, data: any): void;
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
  once(event: string, handler: Function): void;
}
```

## Error Handling Strategy

1. **Graceful Degradation**: 서비스 실패 시 대체 동작
2. **Error Boundaries**: UI 에러 격리
3. **Retry Logic**: 자동 재시도
4. **User Feedback**: 명확한 에러 메시지
5. **Error Logging**: 상세 에러 로깅

## Performance Optimization

1. **Lazy Loading**: 지연 로딩
2. **Code Splitting**: 코드 분할
3. **Virtual Scrolling**: 가상 스크롤링
4. **Debouncing/Throttling**: 이벤트 최적화
5. **Worker Threads**: CPU 집약적 작업 분리

## Testing Strategy

```
src/
├── main/
│   └── __tests__/        # Main process tests
├── renderer/
│   └── __tests__/        # Renderer tests
└── e2e/                  # End-to-end tests
```

## Deployment Architecture

```
├── builds/
│   ├── mac/
│   ├── win/
│   └── linux/
├── releases/
└── updates/              # Auto-update files
```

## Future Considerations

1. **Plugin System**: 플러그인 아키텍처
2. **Multi-window Support**: 다중 창 지원
3. **Remote Control**: 원격 제어 기능
4. **Cloud Sync**: 클라우드 동기화
5. **API Server**: REST/GraphQL API