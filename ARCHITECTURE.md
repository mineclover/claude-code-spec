# Architecture Documentation

> **📢 2025-10-02 업데이트**: 프로젝트 구조가 대폭 개선되었습니다. 자세한 내용은 [리팩토링 요약](./docs/REFACTORING_SUMMARY.md)을 참고하세요.

## 목차
1. [개요](#overview)
2. [아키텍처 구성](#아키텍처-구성)
   - [모듈 구조](#1-모듈-구조)
   - [핵심 모듈](#2-핵심-모듈)
   - [IPC 통신](#3-ipc-통신)
   - [Stream JSON 처리](#4-stream-json-처리-흐름)
3. [사용 방법](#사용-방법)
4. [재사용 가능한 설계](#재사용-가능한-설계)
5. [결론](#결론)

## Overview

Claude Code Headless Controller는 Claude CLI를 Electron 앱에서 headless 모드로 실행하고, stream-json 형식으로 실시간 출력을 표시하는 데스크톱 애플리케이션입니다.

## 아키텍처 구성

### 1. 모듈 구조

```
src/
├── types/api/               # API 타입 정의 (도메인별 분리)
│   ├── claude.ts           # Claude CLI 관련 타입
│   ├── settings.ts         # 설정 파일 관련 타입
│   ├── logger.ts           # 로깅 관련 타입
│   ├── bookmarks.ts        # 북마크 관련 타입
│   ├── sessions.ts         # 세션 관리 타입
│   ├── app-settings.ts     # 앱 설정 타입
│   ├── docs.ts             # 문서 관련 타입
│   ├── metadata.ts         # 메타데이터 타입
│   └── index.ts            # 통합 export
│
├── preload/                 # Preload 스크립트 (모듈화)
│   ├── apis/               # contextBridge API 노출 (도메인별)
│   │   ├── claude.ts
│   │   ├── settings.ts
│   │   ├── logger.ts
│   │   ├── bookmarks.ts
│   │   ├── sessions.ts
│   │   ├── app-settings.ts
│   │   ├── docs.ts
│   │   └── metadata.ts
│   └── index.ts            # 통합 API 노출
│
├── main/                    # Main 프로세스 모듈
│   ├── window.ts           # 윈도우 생성 로직
│   ├── app-context.ts      # 전역 상태 관리
│   └── ipc-setup.ts        # IPC 핸들러 등록
│
├── ipc/                     # IPC 통신 레이어
│   ├── IPCRouter.ts        # 라우터 기반 IPC 시스템
│   └── handlers/           # 도메인별 IPC 핸들러
│       ├── claudeHandlers.ts
│       ├── settingsHandlers.ts
│       ├── loggerHandlers.ts
│       ├── bookmarksHandlers.ts
│       ├── claudeSessionsHandlers.ts
│       ├── appSettingsHandlers.ts
│       ├── docsHandlers.ts
│       ├── metadataHandlers.ts
│       └── dialogHandlers.ts
│
├── lib/                     # 핵심 라이브러리
│   ├── StreamParser.ts     # JSON 스트림 파싱
│   ├── ClaudeClient.ts     # Claude CLI 실행 관리
│   └── SessionManager.ts   # 세션 이력 관리
│
├── services/                # 비즈니스 로직
│   ├── appSettings.ts      # 앱 설정 서비스
│   ├── settings.ts         # 프로젝트 설정 서비스
│   ├── logger.ts           # 로깅 서비스
│   ├── bookmarks.ts        # 북마크 서비스
│   ├── claudeSessions.ts   # Claude 세션 서비스
│   └── cache.ts            # 캐시 서비스
│
├── components/              # React 컴포넌트
│   ├── ui/                 # 공통 UI 컴포넌트
│   ├── settings/           # 설정 컴포넌트
│   ├── layout/             # 레이아웃 컴포넌트
│   ├── stream/             # 스트림 출력 컴포넌트
│   ├── sessions/           # 세션 관리 컴포넌트
│   ├── bookmarks/          # 북마크 컴포넌트
│   └── common/             # 공통 컴포넌트
│
├── pages/                   # 페이지 컴포넌트
│   ├── ExecutePage.tsx     # Claude 실행 페이지
│   ├── ClaudeProjectsPage.tsx  # 프로젝트 관리 페이지
│   ├── McpConfigsPage.tsx  # MCP 설정 페이지
│   ├── SettingsPage.tsx    # 설정 페이지
│   ├── ClaudeDocsPage.tsx  # Claude 문서 페이지
│   ├── ControllerDocsPage.tsx  # 컨트롤러 문서 페이지
│   ├── BookmarksPage.tsx   # 북마크 페이지
│   └── IndexPage.tsx       # 인덱스 페이지
│
├── main.ts                  # Electron Main Process 진입점
├── App.tsx                  # React UI 진입점
└── window.d.ts             # Window API 타입 정의
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

#### 라우터 기반 IPC 시스템

프로젝트는 도메인별로 IPC 통신을 조직화하는 **IPCRouter** 시스템을 사용합니다.

**구조:**
```typescript
// IPC Router 생성
const claudeRouter = ipcRegistry.router('claude');

// 핸들러 등록
claudeRouter.handle('execute', async (event, projectPath, query) => {
  // 로직 처리
});

// 채널명: domain:action (예: "claude:execute")
```

**장점:**
- ✅ 도메인별 핸들러 그룹화
- ✅ 자동 에러 핸들링 및 로깅
- ✅ 채널명 자동 생성 (`domain:action`)
- ✅ 타입 안전성

#### 도메인별 IPC 채널

**Claude 도메인** (`claude:*`)
- `execute` - Claude CLI 실행
- `get-sessions` - 세션 리스트 조회
- `get-current-session` - 현재 세션 ID 조회
- `resume-session` - 세션 이어가기
- `clear-sessions` - 세션 초기화
- 이벤트: `started`, `stream`, `error`, `complete`

**Settings 도메인** (`settings:*`)
- `find-files` - 설정 파일 검색
- `create-backup` - 백업 생성
- `restore-backup` - 백업 복원
- `list-mcp-configs` - MCP 설정 목록
- `get-mcp-servers` - MCP 서버 목록

**Logger 도메인** (`logger:*`)
- `get-files` - 로그 파일 목록
- `read-file` - 로그 파일 읽기
- `analyze-patterns` - 패턴 분석
- `rotate` - 로그 로테이션

**Bookmarks 도메인** (`bookmarks:*`)
- `get-all` - 모든 북마크
- `add` - 북마크 추가
- `update` - 북마크 수정
- `delete` - 북마크 삭제
- `search` - 북마크 검색

**Sessions 도메인** (`claude-sessions:*`)
- `get-all-projects` - 모든 프로젝트
- `get-project-sessions` - 프로젝트 세션 목록
- `read-log` - 세션 로그 읽기
- `get-summary` - 세션 요약

**Dialog 도메인** (`dialog:*`)
- `selectDirectory` - 디렉토리 선택

#### Preload API 노출

각 도메인은 독립적인 API 모듈로 노출됩니다:

```typescript
// src/preload/apis/claude.ts
export function exposeClaudeAPI() {
  contextBridge.exposeInMainWorld('claudeAPI', {
    executeClaudeCommand: (...) => ipcRenderer.invoke('claude:execute', ...),
    // ...
  });
}

// src/preload/index.ts (통합)
exposeClaudeAPI();
exposeSettingsAPI();
exposeLoggerAPI();
// ...
```

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

#### 핵심 라이브러리
각 모듈은 독립적으로 사용 가능:

```typescript
// StreamParser만 사용
import { StreamParser } from './lib/StreamParser';

// ClaudeClient만 사용 (CLI 실행)
import { ClaudeClient } from './lib/ClaudeClient';

// SessionManager만 사용 (세션 관리)
import { SessionManager } from './lib/SessionManager';
```

#### 타입 시스템
중앙화된 타입 시스템으로 일관성 보장:

```typescript
// 통합 import (권장)
import type { ClaudeAPI, SettingsAPI, LoggerAPI } from './types/api';

// 개별 도메인 import
import type { ClaudeAPI } from './types/api/claude';
import type { SettingsAPI } from './types/api/settings';

// Window 타입 (자동 완성 지원)
// window.d.ts에서 전역 타입 정의
window.claudeAPI.executeClaudeCommand(...)
window.settingsAPI.findFiles(...)
```

#### 서비스 레이어
각 서비스는 독립적인 비즈니스 로직을 담당:

```typescript
// 앱 설정 서비스
import { settingsService } from './services/appSettings';

// 프로젝트 설정 서비스
import { findSettingsFiles } from './services/settings';

// 로거 서비스
import { createSessionLogger } from './services/logger';
```

## 파서의 중요성

StreamParser는 이 시스템의 핵심 컴포넌트입니다:

1. **버퍼 관리**: stdout에서 받는 데이터는 chunk 단위로 오므로, 불완전한 JSON 라인을 버퍼에 저장하고 완전한 라인만 파싱
2. **에러 내성**: 잘못된 JSON 라인이 와도 전체 시스템이 중단되지 않음
3. **성능**: 각 chunk를 즉시 처리하여 실시간 스트리밍 보장

## 결론

이 아키텍처는:

### 핵심 원칙
- ✅ **모듈화**: 각 기능이 독립된 모듈로 분리
- ✅ **도메인 분리**: IPC 통신과 타입이 도메인별로 조직화
- ✅ **타입 안전성**: 중앙화된 타입 시스템으로 일관성 보장
- ✅ **재사용성**: 모듈을 다른 프로젝트에서 쉽게 재사용 가능
- ✅ **확장성**: 새로운 기능 추가 용이
- ✅ **유지보수성**: 명확한 책임 분리로 디버깅 쉬움
- ✅ **세션 관리**: 대화 이력 추적 및 이어가기 지원

### 리팩토링 결과 (2025-10-02)

**구조 개선:**
- `preload.ts`: 540+ 줄 → 27 줄 (95% 감소)
- `main.ts`: 103 줄 → 39 줄 (62% 감소)
- 타입 정의: 도메인별 8개 모듈로 분리
- Preload API: 도메인별 8개 모듈로 분리
- Main Process: 3개 책임별 모듈로 분리

**장점:**
1. **가독성**: 파일 크기가 관리 가능한 수준으로 축소
2. **확장성**: 새 API 추가 시 기존 코드 영향 최소화
3. **타입 일관성**: 중복 타입 제거 및 단일 진실 공급원
4. **테스트 용이성**: 각 모듈 독립 테스트 가능

상세 내용: [docs/REFACTORING_SUMMARY.md](./docs/REFACTORING_SUMMARY.md)