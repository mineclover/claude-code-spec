# Work Areas

## 개요

Work Area는 작업(Task)을 계층적으로 분류하고 관리하는 시스템입니다. 일관된 작업 영역 정의를 통해 Task의 컨텍스트를 명확히 하고, 필터링 및 검색을 용이하게 합니다.

## 목적

1. **일관된 분류**: 프로젝트 전체에서 일관된 작업 영역 분류
2. **컨텍스트 최적화**: 작업 영역에 따른 필요 컨텍스트 자동 제한
3. **필터링 지원**: 작업 영역별 작업 필터링 및 검색
4. **팀 협업**: 팀원 간 작업 영역 용어 통일

## 데이터 구조

### Work Area Config

`.claude/work-areas.json`:

```json
{
  "areas": [
    {
      "id": "frontend-pages",
      "category": "Frontend",
      "subcategory": "Pages",
      "displayName": "Frontend/Pages",
      "description": "페이지 컴포넌트"
    },
    {
      "id": "backend-ipc",
      "category": "Backend",
      "subcategory": "IPC",
      "displayName": "Backend/IPC",
      "description": "IPC 핸들러"
    }
  ]
}
```

### Work Area 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | 고유 식별자 (예: `frontend-pages`) |
| `category` | string | 메인 카테고리 (예: `Frontend`) |
| `subcategory` | string | 서브 카테고리 (예: `Pages`) |
| `displayName` | string | 표시 이름 (예: `Frontend/Pages`) |
| `description` | string | 작업 영역 설명 |

## 기본 Work Areas

프로젝트는 다음 5개 카테고리의 13개 Work Area를 제공합니다:

### Frontend (3개)

- **Frontend/Pages**: 페이지 컴포넌트
- **Frontend/Components**: 재사용 컴포넌트
- **Frontend/Contexts**: React Context 및 상태 관리

### Backend (3개)

- **Backend/IPC**: IPC 핸들러
- **Backend/Lib**: 유틸리티 라이브러리
- **Backend/Process**: 프로세스 관리 및 실행

### Infra (2개)

- **Infra/Build**: 빌드 설정
- **Infra/Deploy**: 배포 설정

### Docs (3개)

- **Docs/Features**: 기능 문서
- **Docs/Architecture**: 아키텍처 문서
- **Docs/Guides**: 사용 가이드

### Test (2개)

- **Test/Unit**: 유닛 테스트
- **Test/Integration**: 통합 테스트

## UI 컴포넌트

### WorkAreaSelector

Task 생성 및 편집 시 Work Area를 선택하는 드롭다운 컴포넌트입니다.

**특징:**
- 카테고리별로 그룹화된 옵션
- 선택된 Work Area 배지 표시
- 프로젝트별 Work Area 설정 자동 로드

**사용 예:**

```typescript
import { WorkAreaSelector } from '../components/task/WorkAreaSelector';

<WorkAreaSelector
  projectPath={projectPath}
  selectedArea={area}
  onAreaChange={setArea}
/>
```

## IPC API

### getWorkAreas

프로젝트의 모든 Work Area 목록을 가져옵니다.

```typescript
const areas = await window.workAreaAPI.getWorkAreas(projectPath);
```

**반환값:**
```typescript
WorkArea[]
```

### updateWorkAreas

프로젝트의 Work Area 설정을 업데이트합니다.

```typescript
const result = await window.workAreaAPI.updateWorkAreas(projectPath, areas);
```

**반환값:**
```typescript
{ success: boolean; error?: string }
```

## Task와의 통합

### Task에서 Work Area 사용

Task의 `area` 필드에 Work Area의 `displayName`을 저장합니다:

```yaml
---
id: task-123
title: Add user authentication page
area: Frontend/Pages  # Work Area displayName
assigned_agent: claude-sonnet-4
---
```

### 컨텍스트 제한

Work Area에 따라 필요한 컨텍스트를 자동으로 제한할 수 있습니다:

- **Frontend/Pages** → `src/pages/**` 파일에 집중
- **Backend/IPC** → `src/ipc/handlers/**` 파일에 집중
- **Docs/Features** → `docs/features/**` 파일에 집중

## Work Area 커스터마이징

### 새 Work Area 추가

1. `.claude/work-areas.json` 파일 편집
2. `areas` 배열에 새 Work Area 추가
3. UI에서 자동으로 반영됨

**예시:**

```json
{
  "areas": [
    {
      "id": "mobile-screens",
      "category": "Mobile",
      "subcategory": "Screens",
      "displayName": "Mobile/Screens",
      "description": "모바일 화면 컴포넌트"
    }
  ]
}
```

### 프로젝트별 커스터마이징

각 프로젝트는 자체 `.claude/work-areas.json` 파일을 가질 수 있습니다:

- **프로젝트 A**: 웹 앱 → Frontend/Backend/Docs
- **프로젝트 B**: 모바일 앱 → Mobile/Native/Docs
- **프로젝트 C**: CLI 도구 → CLI/Lib/Docs

## 모범 사례

### 1. 계층 구조 유지

2단계 계층 구조를 권장합니다:
- ✅ `Category/Subcategory` (예: `Frontend/Pages`)
- ❌ `Category/Sub1/Sub2` (너무 깊음)
- ❌ `Category` (너무 얕음)

### 2. 명확한 네이밍

Work Area 이름은 명확하고 구체적이어야 합니다:
- ✅ `Frontend/Components` - 명확함
- ❌ `UI/Stuff` - 모호함
- ✅ `Backend/IPC` - 구체적
- ❌ `Backend/Misc` - 불명확

### 3. 설명 작성

각 Work Area에 명확한 설명을 작성합니다:
```json
{
  "id": "frontend-contexts",
  "description": "React Context 및 상태 관리"  // 구체적
}
```

### 4. 일관성 유지

프로젝트 전체에서 일관된 Work Area를 사용합니다:
- 새 Task 생성 시 기존 Work Area 선택
- 필요 시에만 새 Work Area 추가

## 향후 계획

### 1. Work Area 템플릿

프로젝트 타입별 Work Area 템플릿 제공:
- Web Application
- Mobile Application
- CLI Tool
- Library/Package

### 2. 자동 컨텍스트 매핑

Work Area에 따른 자동 컨텍스트 파일 매핑:
```json
{
  "id": "frontend-pages",
  "contextPatterns": [
    "src/pages/**",
    "src/components/**",
    "docs/features/**"
  ]
}
```

### 3. Work Area 기반 필터링

- ExecutionsPage에서 Work Area 필터
- 통계 및 분석에서 Work Area별 그룹화

### 4. Work Area 통계

- 각 Work Area별 Task 수
- 완료율 및 진행 상황
- 평균 작업 시간

## 관련 문서

- [Task Management](./tasks.md) - Task 관리 가이드
- [Agent System](./agents.md) - Agent 시스템 개요
- [Context Optimization](../claude-context/usage/context-optimization.md) - 컨텍스트 최적화 전략
