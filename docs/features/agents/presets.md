# Agent Presets

## 개요

Agent 생성 시 자주 사용하는 도구(allowedTools)와 권한(permissions) 조합을 프리셋으로 관리하여 일관성과 재사용성을 높입니다.

**중요**: Preset은 `allowedTools`와 `permissions`만 제공합니다. Agent의 필수 필드인 `name`과 `description`은 반드시 직접 작성해야 합니다.

## 목적

- **일관성**: 동일한 역할의 Agent는 동일한 도구와 권한 사용
- **재사용성**: 자주 사용하는 조합을 프리셋으로 저장하여 빠른 Agent 생성
- **안전성**: 검증된 권한 조합 사용으로 실수 방지
- **유지보수**: 프리셋 수정 시 여러 Agent에 일괄 적용 가능

## Preset 종류

### 1. Tool Presets (도구 프리셋)

자주 사용하는 도구 조합을 사전 정의합니다.

```yaml
# .claude/presets/tools.yaml
presets:
  - id: analyzer
    name: 코드 분석 전용
    description: 읽기 및 검색 도구만 허용
    allowedTools:
      - Read
      - Grep
      - Glob

  - id: developer
    name: 개발 작업 전용
    description: 코드 읽기, 쓰기, 실행 가능
    allowedTools:
      - Read
      - Write
      - Edit
      - Grep
      - Glob
      - Bash

  - id: reviewer
    name: 코드 리뷰 전용
    description: 읽기만 허용, 수정 불가
    allowedTools:
      - Read
      - Grep
      - Glob

  - id: tester
    name: 테스트 실행 전용
    description: 테스트 파일 작성 및 실행
    allowedTools:
      - Read
      - Write
      - Grep
      - Bash

  - id: documenter
    name: 문서 작성 전용
    description: 문서 파일 읽기 및 작성
    allowedTools:
      - Read
      - Write
      - Edit
      - Grep
      - Glob
```

### 2. Permission Presets (권한 프리셋)

자주 사용하는 파일 접근 권한 조합을 사전 정의합니다.

```yaml
# .claude/presets/permissions.yaml
presets:
  - id: read-only
    name: 읽기 전용
    description: 모든 파일 읽기만 허용
    permissions:
      allowList:
        - "read:**"
      denyList:
        - "read:.env"
        - "read:**/*.key"

  - id: src-reader
    name: 소스 코드 읽기
    description: src/ 디렉토리 읽기만 허용
    permissions:
      allowList:
        - "read:src/**"
        - "read:types/**"
      denyList:
        - "read:.env"

  - id: test-writer
    name: 테스트 작성
    description: src/ 읽기, tests/ 쓰기 허용
    permissions:
      allowList:
        - "read:src/**"
        - "read:types/**"
        - "write:tests/**"
        - "bash:npm run test"
        - "bash:npm run test:*"
      denyList:
        - "write:src/**"
        - "bash:rm:*"

  - id: docs-writer
    name: 문서 작성
    description: docs/ 디렉토리 읽기/쓰기 허용
    permissions:
      allowList:
        - "read:docs/**"
        - "read:README.md"
        - "write:docs/**"
        - "write:README.md"
      denyList:
        - "write:src/**"
        - "write:tests/**"

  - id: full-developer
    name: 전체 개발 권한
    description: 소스 및 테스트 전체 접근
    permissions:
      allowList:
        - "read:src/**"
        - "read:tests/**"
        - "read:types/**"
        - "read:docs/**"
        - "write:src/**"
        - "write:tests/**"
        - "write:types/**"
        - "bash:npm run *"
        - "bash:git add:*"
        - "bash:git commit:*"
      denyList:
        - "read:.env"
        - "write:.env"
        - "bash:rm:*"
        - "bash:git push:*"

  - id: safe-automation
    name: 안전한 자동화
    description: 읽기 전용 + 안전한 명령만 실행
    permissions:
      allowList:
        - "read:**"
        - "bash:npm run lint"
        - "bash:npm run test"
        - "bash:npm run build"
        - "bash:git status"
        - "bash:git diff:*"
        - "bash:git log:*"
      denyList:
        - "read:.env"
        - "bash:rm:*"
        - "bash:git push:*"
```

### 3. Combined Presets (통합 프리셋)

도구 + 권한을 함께 정의한 프리셋입니다.

```yaml
# .claude/presets/combined.yaml
presets:
  - id: test-generator
    name: 테스트 생성 Agent
    description: 소스 분석 후 테스트 파일 생성
    allowedTools:
      - Read
      - Write
      - Grep
      - Bash
    permissions:
      allowList:
        - "read:src/**"
        - "write:tests/**"
        - "bash:npm run test"
      denyList:
        - "write:src/**"

  - id: code-reviewer
    name: 코드 리뷰 Agent
    description: 코드 분석 및 리뷰 전용
    allowedTools:
      - Read
      - Grep
      - Glob
    permissions:
      allowList:
        - "read:src/**"
        - "read:tests/**"
      denyList: []

  - id: doc-generator
    name: 문서 생성 Agent
    description: 코드 분석 후 문서 작성
    allowedTools:
      - Read
      - Write
      - Edit
      - Grep
      - Glob
    permissions:
      allowList:
        - "read:src/**"
        - "read:types/**"
        - "write:docs/**"
        - "write:README.md"
      denyList:
        - "write:src/**"
```

## 저장 위치

- **프로젝트 레벨**: `.claude/presets/`
  - `tools.yaml` - 도구 프리셋
  - `permissions.yaml` - 권한 프리셋
  - `combined.yaml` - 통합 프리셋

- **사용자 레벨**: `~/.claude/presets/`
  - 모든 프로젝트에서 공유되는 프리셋

## Preset 파일 구조

```yaml
# 프리셋 파일의 공통 구조
presets:
  - id: unique-preset-id           # 고유 식별자
    name: 표시 이름                # UI에 표시될 이름
    description: 설명              # 프리셋 설명
    allowedTools: [...]            # (선택) 도구 목록
    permissions:                   # (선택) 권한 정의
      allowList: [...]
      denyList: [...]
```

## UI 통합

### 1. Presets 관리 페이지

```
┌─────────────────────────────────────────────────────────┐
│  Agent Presets                                          │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  Tool        │   Preset Editor                          │
│  Presets     │                                          │
│              │   ID: developer                          │
│  ● analyzer  │   Name: 개발 작업 전용                    │
│  ● developer │   Description: 코드 읽기, 쓰기, 실행 가능  │
│  ● reviewer  │                                          │
│  ● tester    │   Allowed Tools:                         │
│              │   ☑ Read                                 │
│ Permission   │   ☑ Write                                │
│ Presets      │   ☑ Edit                                 │
│              │   ☑ Grep                                 │
│  ● read-only │   ☑ Glob                                 │
│  ● src-read  │   ☑ Bash                                 │
│  ● test-write│                                          │
│              │   [Save] [Delete] [Duplicate]            │
│ Combined     │                                          │
│ Presets      │                                          │
│              │                                          │
│  ● test-gen  │                                          │
│  ● reviewer  │                                          │
│              │                                          │
│  [+ New]     │                                          │
└──────────────┴──────────────────────────────────────────┘
```

### 2. Agent 생성 시 Preset 선택

AgentsPage에서 새 Agent 생성 시:

```
┌─────────────────────────────────────────────────────────┐
│  Create New Agent                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Name: * test-generator                (필수)          │
│  Description: * TypeScript 테스트 생성 전문  (필수)    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Use Preset (Optional)                           │   │
│  │ ┌─────────────────────────────────────────────┐ │   │
│  │ │ test-generator (Combined)         [Apply]  │ │   │
│  │ └─────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Allowed Tools:                                         │
│  ☑ Read  ☑ Write  ☑ Grep  ☑ Bash                       │
│                                                         │
│  Permissions:                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Use Preset (Optional)                           │   │
│  │ ┌─────────────────────────────────────────────┐ │   │
│  │ │ test-writer                     [Apply]    │ │   │
│  │ └─────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Allow List:                                            │
│  • read:src/**                                          │
│  • write:tests/**                                       │
│  • bash:npm run test                                    │
│  [+ Add]                                                │
│                                                         │
│  Deny List:                                             │
│  • write:src/**                                         │
│  [+ Add]                                                │
│                                                         │
│  [Create Agent] [Cancel]                                │
└─────────────────────────────────────────────────────────┘

* = 필수 필드 (직접 입력 필요)
```

## 아키텍처

### 타입 정의 (`src/types/preset.ts`)

```typescript
export type PresetType = 'tool' | 'permission' | 'combined';

export interface ToolPreset {
  id: string;
  name: string;
  description: string;
  allowedTools: string[];
}

export interface PermissionPreset {
  id: string;
  name: string;
  description: string;
  permissions: {
    allowList: string[];
    denyList: string[];
  };
}

export interface CombinedPreset {
  id: string;
  name: string;
  description: string;
  allowedTools: string[];
  permissions: {
    allowList: string[];
    denyList: string[];
  };
}

export type AgentPreset = ToolPreset | PermissionPreset | CombinedPreset;

export interface PresetListItem {
  id: string;
  name: string;
  description: string;
  type: PresetType;
  source: 'project' | 'user';
}
```

### IPC 핸들러 (`src/ipc/handlers/presetHandlers.ts`)

```typescript
// 프리셋 목록 조회
ipcMain.handle('preset:list', async (event, projectPath: string) => {
  // .claude/presets/ 및 ~/.claude/presets/ 읽기
});

// 프리셋 상세 조회
ipcMain.handle('preset:get', async (event, source: 'project' | 'user', presetType: PresetType, presetId: string, projectPath?: string) => {
  // 프리셋 파일 읽기 및 파싱
});

// 프리셋 생성
ipcMain.handle('preset:create', async (event, source: 'project' | 'user', presetType: PresetType, preset: AgentPreset, projectPath?: string) => {
  // YAML 파일에 프리셋 추가
});

// 프리셋 수정
ipcMain.handle('preset:update', async (event, source: 'project' | 'user', presetType: PresetType, preset: AgentPreset, projectPath?: string) => {
  // YAML 파일에서 프리셋 업데이트
});

// 프리셋 삭제
ipcMain.handle('preset:delete', async (event, source: 'project' | 'user', presetType: PresetType, presetId: string, projectPath?: string) => {
  // YAML 파일에서 프리셋 제거
});
```

### Preload API (`src/preload/apis/preset.ts`)

```typescript
export interface PresetAPI {
  listPresets: (projectPath: string) => Promise<PresetListItem[]>;
  getPreset: (source: 'project' | 'user', presetType: PresetType, presetId: string, projectPath?: string) => Promise<AgentPreset | null>;
  createPreset: (source: 'project' | 'user', presetType: PresetType, preset: AgentPreset, projectPath?: string) => Promise<{success: boolean; error?: string}>;
  updatePreset: (source: 'project' | 'user', presetType: PresetType, preset: AgentPreset, projectPath?: string) => Promise<{success: boolean; error?: string}>;
  deletePreset: (source: 'project' | 'user', presetType: PresetType, presetId: string, projectPath?: string) => Promise<{success: boolean; error?: string}>;
}
```

### UI 컴포넌트

#### PresetsPage (`src/pages/PresetsPage.tsx`)

Preset 관리 전용 페이지

**기능**:
- Tool/Permission/Combined Preset 카테고리별 목록
- Preset 생성/수정/삭제
- Preset 복제 기능

#### PresetSelector (`src/components/agent/PresetSelector.tsx`)

Agent 생성/수정 시 Preset 선택 컴포넌트

**Props**:
```typescript
interface PresetSelectorProps {
  projectPath: string;
  presetType: PresetType;
  onPresetSelect: (preset: AgentPreset) => void;
}
```

## 워크플로우

### 1. Preset 생성 워크플로우

```
1. Presets 페이지 접근
   ↓
2. 프리셋 타입 선택 (Tool/Permission/Combined)
   ↓
3. 프리셋 정보 입력
   - ID, Name, Description
   - allowedTools (Tool/Combined)
   - permissions (Permission/Combined)
   ↓
4. 저장 위치 선택 (Project/User)
   ↓
5. 프리셋 저장
```

### 2. Agent 생성 시 Preset 사용

```
1. AgentsPage에서 "New Agent" 클릭
   ↓
2. Agent 기본 정보 입력 (필수)
   → name: Agent 고유 식별자
   → description: Agent 역할 및 목적
   ↓
3. (선택) Combined Preset 적용
   → allowedTools와 permissions 자동 입력
   ↓
4. 또는 개별적으로 설정
   → Tool Preset 적용 (allowedTools만)
   → Permission Preset 적용 (permissions만)
   ↓
5. 필요시 추가 수정
   → Preset으로 채워진 도구/권한을 수정 가능
   ↓
6. Agent 저장
```

**중요**: name과 description은 Preset에서 제공되지 않으므로 반드시 직접 입력해야 합니다.

## 구현 단계

### Phase 1: Preset 인프라
- [ ] Preset 타입 정의 (`src/types/preset.ts`)
- [ ] YAML 파서 (js-yaml 라이브러리 사용)
- [ ] Preset IPC 핸들러 (`src/ipc/handlers/presetHandlers.ts`)
- [ ] Preset API 노출 (`src/preload/apis/preset.ts`)

### Phase 2: Preset UI
- [ ] PresetsPage 구현 (Preset 관리 전용 페이지)
- [ ] PresetSelector 컴포넌트 (Agent 생성/수정에서 사용)
- [ ] Preset 카드 컴포넌트 (목록 표시용)
- [ ] Preset 에디터 컴포넌트 (생성/수정용)

### Phase 3: Agent 통합
- [ ] AgentsPage에 PresetSelector 통합
- [ ] Preset 적용 로직 (allowedTools, permissions 자동 입력)
- [ ] Preset과 Agent 연결 (어떤 Preset으로 생성되었는지 기록)

### Phase 4: 기본 Preset 제공
- [ ] `.claude/presets/tools.yaml` 기본 프리셋 생성
- [ ] `.claude/presets/permissions.yaml` 기본 프리셋 생성
- [ ] `.claude/presets/combined.yaml` 기본 프리셋 생성
- [ ] 문서 및 사용 가이드

## 파일 구조

```
.claude/
└── presets/
    ├── tools.yaml         # 도구 프리셋
    ├── permissions.yaml   # 권한 프리셋
    └── combined.yaml      # 통합 프리셋

~/.claude/
└── presets/
    ├── tools.yaml
    ├── permissions.yaml
    └── combined.yaml

src/
├── types/
│   └── preset.ts          # Preset 타입 정의
├── ipc/
│   └── handlers/
│       └── presetHandlers.ts  # Preset IPC 핸들러
├── preload/
│   └── apis/
│       └── preset.ts      # Preset API
├── pages/
│   ├── PresetsPage.tsx    # Preset 관리 페이지
│   └── AgentsPage.tsx     # (PresetSelector 통합)
└── components/
    └── agent/
        └── PresetSelector.tsx  # Preset 선택 컴포넌트
```

## 장점

1. **일관성**: 동일한 역할의 Agent는 동일한 도구와 권한 사용
2. **빠른 생성**: 검증된 프리셋으로 빠르게 Agent 생성
3. **안전성**: 실수로 과도한 권한 부여 방지
4. **유지보수**: 프리셋 수정 시 여러 Agent에 영향 가능
5. **재사용**: 프로젝트 간 프리셋 공유 (사용자 레벨)

## 향후 확장

1. **Preset 템플릿 마켓플레이스**: 커뮤니티 프리셋 공유
2. **Preset 버전 관리**: 프리셋 변경 이력 추적
3. **Preset 검증**: 안전하지 않은 권한 조합 경고
4. **Preset 추천**: Agent 역할 기반 프리셋 자동 추천
5. **Preset 분석**: 가장 많이 사용되는 프리셋 통계
