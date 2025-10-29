# Claude Code Library Separation Plan

## 목표

Claude CLI와 상호작용하는 핵심 코드를 독립적인 TypeScript 라이브러리로 분리하여:
1. 재사용 가능한 패키지 제공
2. 명확한 책임 분리
3. 다른 프로젝트에서 쉽게 통합 가능

## Monorepo 구조

```
claude-code-spec/
├── packages/
│   ├── claude-code-client/           # 핵심 Claude CLI 클라이언트 라이브러리
│   │   ├── src/
│   │   │   ├── client/              # Claude CLI 실행 클라이언트
│   │   │   │   ├── ClaudeClient.ts
│   │   │   │   └── types.ts
│   │   │   ├── parser/              # Stream JSON 파싱
│   │   │   │   ├── StreamParser.ts
│   │   │   │   └── types.ts
│   │   │   ├── session/             # 세션 관리
│   │   │   │   ├── SessionManager.ts
│   │   │   │   └── types.ts
│   │   │   ├── process/             # 프로세스 관리
│   │   │   │   ├── ProcessManager.ts
│   │   │   │   └── types.ts
│   │   │   ├── query/               # Query API (Zod 통합)
│   │   │   │   ├── ClaudeQueryAPI.ts
│   │   │   │   └── types.ts
│   │   │   ├── schema/              # 스키마 빌더
│   │   │   │   ├── zodSchemaBuilder.ts
│   │   │   │   ├── schemas.ts
│   │   │   │   └── types.ts
│   │   │   ├── errors/              # 에러 타입
│   │   │   │   └── errors.ts
│   │   │   └── index.ts             # Public API
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   │
│   └── claude-code-controller/       # GUI 컨트롤러 앱
│       ├── src/
│       │   ├── main/                # Electron main process
│       │   ├── preload/             # Preload scripts
│       │   ├── renderer/            # React app
│       │   │   ├── components/
│       │   │   ├── pages/
│       │   │   └── contexts/
│       │   ├── ipc/                 # IPC handlers
│       │   └── services/            # App-specific services
│       │       ├── AgentLoader.ts
│       │       ├── AgentPoolManager.ts
│       │       ├── TaskRouter.ts
│       │       └── ExecutionQueue.ts
│       ├── package.json
│       ├── electron.vite.config.ts
│       └── README.md
│
├── package.json                      # Root package.json (workspaces)
├── tsconfig.base.json               # Shared TypeScript config
└── README.md

```

## 라이브러리 분리 기준

### claude-code-client (독립 라이브러리)

**포함:**
- `src/lib/ClaudeClient.ts` → `packages/claude-code-client/src/client/`
- `src/lib/StreamParser.ts` → `packages/claude-code-client/src/parser/`
- `src/lib/SessionManager.ts` → `packages/claude-code-client/src/session/`
- `src/services/ProcessManager.ts` → `packages/claude-code-client/src/process/`
- `src/services/ClaudeQueryAPI.ts` → `packages/claude-code-client/src/query/`
- `src/lib/zodSchemaBuilder.ts` → `packages/claude-code-client/src/schema/`
- `src/lib/schemas.ts` → `packages/claude-code-client/src/schema/`
- `src/lib/errors.ts` → `packages/claude-code-client/src/errors/`
- `src/lib/types.ts` → `packages/claude-code-client/src/parser/types.ts`

**특징:**
- Pure TypeScript, Node.js 전용
- Electron/GUI 의존성 없음
- 독립적으로 npm에 배포 가능
- 다른 프로젝트에서 import 가능

**Public API 예시:**
```typescript
// packages/claude-code-client/src/index.ts
export { ClaudeClient, type ClaudeClientOptions } from './client/ClaudeClient';
export { StreamParser } from './parser/StreamParser';
export { SessionManager } from './session/SessionManager';
export { ProcessManager } from './process/ProcessManager';
export { ClaudeQueryAPI } from './query/ClaudeQueryAPI';
export * from './schema/zodSchemaBuilder';
export * from './errors/errors';
export * from './parser/types';
```

### claude-code-controller (GUI 앱)

**포함:**
- 모든 Electron 관련 코드
- React UI 컴포넌트
- IPC 핸들러
- App-specific 서비스:
  - `AgentLoader.ts`
  - `AgentPoolManager.ts`
  - `TaskRouter.ts`
  - `ExecutionQueue.ts`
  - `SkillRepositoryManager.ts`

**의존성:**
```json
{
  "dependencies": {
    "@claude-code/client": "workspace:*",
    "electron": "^...",
    "react": "^..."
  }
}
```

## 마이그레이션 단계

### Phase 1: Monorepo 구조 생성
1. `packages/` 디렉토리 생성
2. Root `package.json`에 workspaces 설정
3. `tsconfig.base.json` 생성

### Phase 2: 라이브러리 패키지 생성
1. `packages/claude-code-client/` 생성
2. 핵심 파일 이동 및 import 경로 수정
3. Public API 정의 (`index.ts`)
4. 독립적으로 빌드 가능하도록 설정

### Phase 3: 컨트롤러 앱 이동
1. `packages/claude-code-controller/` 생성
2. 기존 앱 코드 이동
3. `@claude-code/client` 의존성으로 변경
4. Import 경로 업데이트

### Phase 4: 검증 및 최적화
1. 빌드 검증
2. 타입 체크
3. 테스트 실행
4. 문서 업데이트

## 사용 예시

### 다른 프로젝트에서 사용

```typescript
import { ClaudeClient, ProcessManager, ClaudeQueryAPI } from '@claude-code/client';
import { z } from 'zod';

// 1. Simple execution
const client = new ClaudeClient({ cwd: './my-project' });
const process = client.execute('Explain this codebase');

// 2. Process management
const manager = new ProcessManager();
const sessionId = await manager.startExecution({
  projectPath: './my-project',
  query: 'Fix the bug in auth.ts',
  onStream: (sid, event) => console.log(event)
});

// 3. Schema-validated query
const queryAPI = new ClaudeQueryAPI();
const result = await queryAPI.queryWithZod(
  './my-project',
  'Analyze this code',
  z.object({ summary: z.string(), issues: z.array(z.string()) })
);
```

### 컨트롤러 앱에서 사용

```typescript
// packages/claude-code-controller/src/services/MyService.ts
import { ProcessManager } from '@claude-code/client';

export class MyService {
  private processManager = new ProcessManager();

  async execute(params) {
    return this.processManager.startExecution(params);
  }
}
```

## 이점

1. **재사용성**: 다른 프로젝트에서 쉽게 통합
2. **유지보수성**: 명확한 책임 분리
3. **테스트 용이성**: 라이브러리 단위로 독립 테스트
4. **배포 가능성**: npm 패키지로 배포
5. **타입 안전성**: TypeScript 타입 완전 지원
6. **버전 관리**: 라이브러리와 앱 독립적 버전 관리

## 다음 단계

이 구조를 구현하시겠습니까? 단계별로 진행하겠습니다.
