# Task Creation Guide

## Task의 목적

Task는 **실행 가능한 작업 단위**입니다. Agent가 이해하고 수행할 수 있도록 명확하게 정의되어야 합니다.

## Task 생성 체크리스트

### 1. 명확한 제목 ✓
- [ ] 무엇을 하는지 한눈에 파악 가능
- [ ] 동사로 시작 (Add, Fix, Refactor, Update, Remove, etc.)
- [ ] 구체적인 대상 명시

**예시:**
- ✅ "Add filtering feature to ExecutionsPage"
- ✅ "Fix session ID validation in TasksPage"
- ❌ "UI improvements" (너무 모호)
- ❌ "Bugs" (구체적이지 않음)

### 2. 적절한 Work Area 선택 ✓
- [ ] Work Area 드롭다운에서 선택
- [ ] 작업의 성격에 맞는 영역 선택
- [ ] 계층 구조 유지 (Category/Subcategory)

**사용 가능한 Work Areas** (`.claude/work-areas.json`):

**Frontend (3개)**:
- `Frontend/Pages` - 페이지 컴포넌트
- `Frontend/Components` - 재사용 컴포넌트
- `Frontend/Contexts` - React Context 및 상태 관리

**Backend (3개)**:
- `Backend/IPC` - IPC 핸들러
- `Backend/Lib` - 유틸리티 라이브러리
- `Backend/Process` - 프로세스 관리 및 실행

**Infra (2개)**:
- `Infra/Build` - 빌드 설정
- `Infra/Deploy` - 배포 설정

**Docs (3개)**:
- `Docs/Features` - 기능 문서
- `Docs/Architecture` - 아키텍처 문서
- `Docs/Guides` - 사용 가이드

**Test (2개)**:
- `Test/Unit` - 유닛 테스트
- `Test/Integration` - 통합 테스트

**Work Area 선택 가이드:**
- Task가 주로 수정할 파일들의 위치를 고려
- 여러 영역에 걸쳐 있다면 가장 핵심적인 영역 선택
- 새로운 Work Area가 필요하면 `.claude/work-areas.json` 편집

### 3. 상세한 Description ✓
- [ ] 배경 (Why): 왜 필요한가?
- [ ] 목표 (What): 무엇을 만들 것인가?
- [ ] 접근 방법 (How): 어떻게 구현할 것인가?

**템플릿:**
```markdown
## Description

[한 문장 요약]

**배경:**
- [현재 상황/문제점]
- [이 작업이 필요한 이유]

**목표:**
- [달성하고자 하는 결과]
- [기대 효과]

**접근 방법:**
- [구현 방법 개요]
- [주요 변경 사항]
- [고려 사항]
```

### 4. 유용한 References ✓
- [ ] 실제 존재하는 파일 경로
- [ ] 관련 문서 URL
- [ ] 참고할 코드 위치

**예시:**
```markdown
## References

- src/pages/ExecutionsPage.tsx - 수정할 메인 파일
- src/components/execution/ExecutionsList.tsx - 참고 컴포넌트
- docs/features/execute/filtering.md - 기능 명세
- https://react.dev/reference/react/useMemo - useMemo 문서
```

### 5. 측정 가능한 Success Criteria ✓
- [ ] 최소 3개 이상
- [ ] 객관적으로 확인 가능
- [ ] 체크리스트 형식 (`- [ ]`)

**좋은 예:**
```markdown
## Success Criteria

- [ ] Status dropdown이 4개 옵션(All, Running, Completed, Failed)을 표시
- [ ] Date range picker로 시작일과 종료일을 선택 가능
- [ ] Session ID 검색 input에 부분 일치 검색 작동
- [ ] 모든 필터를 초기화하는 "Clear Filters" 버튼 존재
- [ ] 필터링 결과가 0개일 때 "No results found" 메시지 표시
- [ ] 필터 변경 시 URL query parameter에 반영 (새로고침 시 유지)
```

**나쁜 예:**
```markdown
## Success Criteria

- [ ] 잘 작동함
- [ ] 사용자가 만족함
- [ ] 버그 없음
```

### 6. 적절한 Agent 할당 ✓

**Agent 선택 기준:**

| Agent | 적합한 작업 | 비고 |
|-------|------------|------|
| **claude-sonnet-4** | 일반 개발, 기능 추가, 버그 수정 | 균형잡힌 성능 (기본) |
| **claude-opus-4** | 복잡한 아키텍처, 리팩토링, 리뷰 | 고급 추론 능력 |
| **claude-haiku-4** | 간단한 수정, 반복 작업, 문서 작성 | 빠른 응답 |
| **task-creator** | Task 생성 | Task 생성 전문 |
| **커스텀 agent** | 특정 도구/권한 필요 작업 | 프로젝트별 정의 |

**할당 예시:**
```yaml
# 일반 기능 추가
assigned_agent: claude-sonnet-4
reviewer: claude-opus-4

# 복잡한 리팩토링
assigned_agent: claude-opus-4
reviewer: human:senior-dev@company.com

# 문서 업데이트
assigned_agent: claude-haiku-4
reviewer: claude-sonnet-4
```

### 7. Status 관리 ✓

- `pending`: 아직 시작 안 함
- `in_progress`: 현재 진행 중
- `completed`: 완료됨
- `cancelled`: 취소됨

**상태 전환 흐름:**
```
pending → in_progress → completed
         ↓
      cancelled
```

## Task 작성 예시

### 예시 1: 기능 추가

```yaml
---
id: task-1699520400000
title: Add status filter dropdown to ExecutionsPage
area: Frontend/Pages
assigned_agent: claude-sonnet-4
reviewer: claude-opus-4
status: pending
created: 2024-01-15T10:30:00Z
updated: 2024-01-15T10:30:00Z
---

## Description

ExecutionsPage에 실행 상태별 필터링을 위한 dropdown을 추가합니다.

**배경:**
- 현재 모든 실행 내역이 한 번에 표시되어 원하는 항목을 찾기 어려움
- 사용자가 특정 상태(Running, Completed, Failed)의 실행만 보고 싶어함

**목표:**
- Status dropdown 추가 (All, Running, Completed, Failed)
- 선택한 상태에 맞는 항목만 필터링하여 표시
- URL query parameter로 필터 상태 유지 (새로고침 대응)

**접근 방법:**
- ExecutionsPage에 status state 추가
- ExecutionsList 컴포넌트에 filter prop 전달
- useMemo로 필터링 로직 최적화
- useSearchParams로 URL 동기화

## References

- src/pages/ExecutionsPage.tsx
- src/components/execution/ExecutionsList.tsx
- src/types/execution.ts

## Success Criteria

- [ ] Status dropdown이 헤더에 표시됨
- [ ] 4개 옵션(All, Running, Completed, Failed) 선택 가능
- [ ] 선택한 상태에 맞는 항목만 리스트에 표시
- [ ] URL에 ?status=running 형태로 반영
- [ ] 새로고침해도 필터 상태 유지
- [ ] "All" 선택 시 모든 항목 표시
```

### 예시 2: 버그 수정

```yaml
---
id: task-1699520500000
title: Fix task deletion confirmation dialog not showing
area: Frontend/Pages
assigned_agent: claude-sonnet-4
reviewer: claude-haiku-4
status: pending
created: 2024-01-15T11:00:00Z
updated: 2024-01-15T11:00:00Z
---

## Description

TasksPage에서 Delete 버튼 클릭 시 확인 다이얼로그가 표시되지 않는 버그를 수정합니다.

**배경:**
- 사용자가 실수로 Task를 삭제할 위험이 있음
- 확인 다이얼로그가 의도된 동작이지만 작동하지 않음

**목표:**
- Delete 버튼 클릭 시 반드시 확인 다이얼로그 표시
- 사용자가 "확인"을 선택해야만 삭제 진행

**접근 방법:**
- handleDelete 함수의 confirm() 호출 확인
- 이벤트 핸들러 바인딩 검증
- 브라우저 호환성 확인

## References

- src/pages/TasksPage.tsx:149 (handleDelete 함수)

## Success Criteria

- [ ] Delete 버튼 클릭 시 "Are you sure?" 다이얼로그 표시
- [ ] "취소" 클릭 시 삭제되지 않음
- [ ] "확인" 클릭 시에만 삭제 진행
- [ ] 모든 브라우저(Chrome, Safari, Firefox)에서 작동
```

### 예시 3: 리팩토링

```yaml
---
id: task-1699520600000
title: Refactor IPC handlers to use centralized error handling
area: Backend/IPC
assigned_agent: claude-opus-4
reviewer: human:tech-lead@company.com
status: pending
created: 2024-01-15T12:00:00Z
updated: 2024-01-15T12:00:00Z
---

## Description

IPC 핸들러들의 중복된 에러 핸들링 코드를 통합하여 일관성을 높입니다.

**배경:**
- 각 핸들러마다 try-catch 패턴이 반복됨
- 에러 로깅 방식이 핸들러마다 다름
- 유지보수성 저하 및 일관성 부족

**목표:**
- 공통 에러 핸들링 wrapper 함수 생성
- 모든 핸들러에 적용
- 표준화된 에러 응답 형식

**접근 방법:**
- `src/ipc/errorHandler.ts` 생성
- `wrapHandler()` HOF(Higher-Order Function) 구현
- 각 핸들러에서 wrapper 적용
- 에러 타입별 분기 처리 (FileNotFoundError, ValidationError, etc.)

## References

- src/ipc/handlers/agentHandlers.ts
- src/ipc/handlers/taskHandlers.ts
- src/ipc/handlers/sessionHandlers.ts
- docs/architecture/error-handling.md

## Success Criteria

- [ ] src/ipc/errorHandler.ts 파일 생성됨
- [ ] wrapHandler 함수가 에러를 catch하고 표준 형식으로 반환
- [ ] 모든 IPC 핸들러에서 wrapHandler 사용
- [ ] 에러 로그가 일관된 형식으로 출력
- [ ] 기존 기능이 모두 정상 작동 (회귀 테스트)
- [ ] 에러 응답 타입이 { success: false, error: string } 형식
```

## 피해야 할 안티패턴

### ❌ 너무 큰 Task

```yaml
title: Implement entire authentication system
```
→ 여러 개의 작은 Task로 분리

### ❌ 모호한 요구사항

```yaml
description: Make it better
```
→ 구체적인 개선사항 명시

### ❌ 측정 불가능한 Success Criteria

```yaml
successCriteria:
  - Works well
  - Looks good
```
→ 객관적으로 확인 가능한 기준

### ❌ 참고 자료 없음

```yaml
references: []
```
→ 관련 파일/문서 경로 추가

## Task 검토 체크리스트

작성한 Task를 다음 질문으로 검토하세요:

1. **명확성**: 다른 사람이 읽어도 무엇을 해야 할지 알 수 있는가?
2. **실행 가능성**: Agent가 실제로 수행할 수 있는 작업인가?
3. **측정 가능성**: 완료 여부를 객관적으로 판단할 수 있는가?
4. **적절한 범위**: 너무 크지도, 작지도 않은가? (1-3일 내 완료)
5. **컨텍스트**: 충분한 배경 정보와 참고 자료가 있는가?

모든 질문에 "예"라고 답할 수 있다면 좋은 Task입니다! ✅
