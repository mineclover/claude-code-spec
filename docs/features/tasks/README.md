# Tasks - Execute를 위한 작업 명세 시스템

Tasks는 Claude CLI 실행 시 필요한 의존성, 컨텍스트, 작업 영역을 사전에 정의하여 효율적인 Execute를 가능하게 하는 시스템입니다.

## 목적

Tasks는 다음을 위해 존재합니다:

1. **의존성 분석**: 작업 수행에 필요한 파일 및 문서 의존성 명시
2. **컨텍스트 배정**: Execute 시 Claude에게 전달할 컨텍스트 사전 정의
3. **작업 영역 할당**: 명확한 작업 범위 설정으로 불필요한 컨텍스트 차단
4. **Execute 최적화**: 사전 정의된 Task를 Execute에 전달하여 효율적 실행

## 핵심 개념

### Tasks → Execute 워크플로우

```
1. Task 정의
   ├─ 의존성 명시 (References)
   ├─ 작업 영역 설정 (Area)
   ├─ 성공 기준 작성 (Success Criteria)
   └─ 에이전트 할당 (Assigned Agent)

2. Execute 실행
   ├─ Task 선택
   ├─ 컨텍스트 자동 구성 (References 기반)
   ├─ 작업 범위 제한 (Area 기반)
   └─ Claude CLI 실행

3. 결과 검증
   ├─ Success Criteria 확인
   └─ 리뷰어 검토
```

### Task vs 일반 Execute

| 구분 | 일반 Execute | Task 기반 Execute |
|------|-------------|------------------|
| 컨텍스트 | 수동 지정 | 자동 구성 (References) |
| 작업 범위 | 불명확 | 명확 (Area 제한) |
| 의존성 | 사용자가 파악 | 사전 분석됨 |
| 재실행 | 매번 설정 필요 | Task 재사용 |
| 검증 | 수동 확인 | Success Criteria 기반 |

## 파일 구조

Tasks는 프로젝트의 `.claude/tasks/` 디렉토리에 마크다운 파일로 저장됩니다:

```
project/
└── .claude/
    └── tasks/
        ├── task-001.md
        ├── task-002.md
        └── task-003.md
```

## Task 마크다운 스키마

### Frontmatter

```yaml
---
id: task-001                    # 고유 ID
title: Task Title               # 작업 제목
area: Backend/Authentication    # 작업 영역 (컨텍스트 제한 범위)
assigned_agent: claude-sonnet-4 # 할당된 에이전트
reviewer: claude-opus-4         # 리뷰어 (에이전트 또는 human:email)
status: pending                 # pending | in_progress | completed | cancelled
created: 2025-10-03T00:00:00Z   # 생성 시간 (ISO 8601)
updated: 2025-10-03T00:00:00Z   # 수정 시간 (ISO 8601)
---
```

### 본문 섹션

#### References (의존성 정의)

**목적**: Execute 시 Claude에게 전달할 컨텍스트 파일 및 문서를 명시

작업 수행에 필요한 모든 의존성을 나열합니다:

```markdown
## References
# 프로젝트 내부 파일 (컨텍스트로 자동 로드됨)
- /docs/api-spec.md
- /src/auth/existing-auth.ts
- /src/types/user.ts

# 외부 문서 (참조용, URL만 전달)
- https://jwt.io/introduction

# 디렉토리 전체 (하위 파일 포함)
- /src/auth/**
```

**Execute 시 동작**:
- 나열된 파일들이 자동으로 컨텍스트에 포함
- Area와 결합하여 불필요한 파일 차단
- 의존성 순환 체크

#### Success Criteria
작업 완료 기준을 체크리스트 형태로 정의:

```markdown
## Success Criteria
- [ ] JWT 토큰 생성 및 검증 구현
- [ ] 비밀번호 해싱 적용
- [ ] 단위 테스트 작성 (커버리지 80% 이상)
- [ ] API 문서 작성
```

#### Description
작업에 대한 상세 설명:

```markdown
## Description
사용자 로그인 및 회원가입을 위한 RESTful API를 구현합니다.
JWT 기반 인증을 사용하며, bcrypt로 비밀번호를 해싱합니다.

구현 사항:
1. POST /api/auth/signup - 회원가입
2. POST /api/auth/login - 로그인
3. POST /api/auth/logout - 로그아웃
4. GET /api/auth/me - 현재 사용자 정보
```

#### Review Notes
리뷰어가 작업 완료 후 작성하는 검토 내용:

```markdown
## Review Notes
(작업 완료 후 리뷰어가 작성)

### 검토 결과
- ✅ 모든 성공 기준 충족
- ✅ 코드 품질 양호
- ⚠️ 에러 핸들링 개선 필요

### 개선 제안
1. 비밀번호 복잡도 검증 추가
2. Rate limiting 적용 고려
```

## 완전한 예시

```markdown
---
id: task-001
title: 사용자 인증 API 구현
area: src/auth
assigned_agent: claude-sonnet-4
reviewer: claude-opus-4
status: in_progress
created: 2025-10-03T09:00:00Z
updated: 2025-10-03T14:30:00Z
---

## References
# 의존성: Execute 시 자동으로 컨텍스트에 포함됨
- /docs/api-spec.md
- /docs/architecture/auth-flow.md
- /src/types/user.ts
- /src/types/auth.ts
- /src/middleware/auth.ts
- /src/utils/jwt.ts
- /src/utils/password.ts
- /tests/auth.test.ts

# 참고 문서 (URL만 전달)
- https://jwt.io/introduction
- https://www.npmjs.com/package/bcrypt

## Success Criteria
- [ ] JWT 토큰 생성 및 검증 구현
- [ ] 비밀번호 해싱 적용 (bcrypt, rounds=10)
- [ ] 단위 테스트 작성 (커버리지 80% 이상)
- [ ] API 문서 작성
- [ ] 에러 핸들링 구현
- [ ] Rate limiting 적용

## Description
사용자 로그인 및 회원가입을 위한 RESTful API를 구현합니다.

### 작업 범위 (Area)
`src/auth` 디렉토리 내 모든 인증 관련 코드
- Execute 시 이 디렉토리 외부의 컨텍스트는 자동 차단
- 필요한 외부 의존성은 References에 명시

### 구현 API 목록
1. POST /api/auth/signup - 회원가입
2. POST /api/auth/login - 로그인
3. POST /api/auth/logout - 로그아웃
4. GET /api/auth/me - 현재 사용자 정보
5. POST /api/auth/refresh - 토큰 갱신

### 기술 스택
- Express.js
- JWT (jsonwebtoken)
- bcrypt
- TypeScript
- Jest (테스트)

### 보안 고려사항
- 비밀번호는 bcrypt로 해싱 (salt rounds: 10)
- JWT 토큰 만료 시간: 1시간
- Refresh token 사용 (만료 시간: 7일)
- Rate limiting: 5회/분

### Execute 시 전달될 컨텍스트
```
프롬프트: "task-001 작업을 수행해주세요"

자동 포함:
- Task Description 전문
- References에 명시된 모든 파일 내용
- Area 범위 내 관련 파일

자동 차단:
- Area 외부 파일 (References 제외)
- .env, secrets 등 민감 정보
```

## Review Notes
(작업 완료 후 리뷰어가 작성)
```

## 사용 방법

### 워크플로우: Task 정의 → Execute

#### 1단계: 의존성 분석 및 Task 생성

1. **Tasks 탭 접근**: 좌측 네비게이션에서 Tasks (✅) 클릭
2. **새 작업 생성**: "+ New" 버튼 클릭
3. **의존성 분석**: 작업 수행에 필요한 모든 파일 나열
   ```markdown
   ## References
   - /src/auth/user-service.ts  # 기존 구현 참고
   - /src/types/user.ts         # 타입 정의
   - /docs/api-spec.md          # API 명세
   ```
4. **작업 영역 설정**: Area 필드로 컨텍스트 범위 제한
   ```yaml
   area: src/auth  # 이 디렉토리만 접근 허용
   ```
5. **성공 기준 정의**: 명확한 완료 조건 작성
6. **저장**: `.claude/tasks/task-XXX.md`로 저장

#### 2단계: Task 기반 Execute

1. **Execute 탭 이동**: 좌측 네비게이션에서 Execute 클릭
2. **Task 선택**: Recent Sessions 하단의 Task 드롭다운에서 작업 선택
3. **자동 컨텍스트 구성**:
   - Task의 References 파일들이 자동으로 컨텍스트에 포함
   - Area 설정에 따라 불필요한 파일 차단
   - Description이 프롬프트로 사용됨
4. **Execute 실행**: "Execute" 버튼 클릭
5. **실시간 모니터링**: StreamOutput으로 진행 상황 확인

#### 3단계: 결과 검증 및 리뷰

1. **Success Criteria 확인**: 체크리스트 기반 완료 여부 검토
2. **리뷰어 검토**: 지정된 리뷰어가 산출물 검토
3. **Review Notes 작성**: 리뷰 결과 및 개선사항 기록
4. **상태 업데이트**: completed로 변경

### Task 수정 및 재실행

동일한 작업을 반복할 때:

1. 기존 Task 선택 (References 및 설정 재사용)
2. 필요시 의존성 추가/제거
3. Execute로 즉시 실행 (설정 재입력 불필요)

### Task 삭제

1. 작업 목록에서 삭제할 작업 클릭
2. "Delete" 버튼 클릭
3. 확인 대화상자에서 확인

## 작업 상태

- **pending**: 대기 중 (아직 시작하지 않음)
- **in_progress**: 진행 중
- **completed**: 완료
- **cancelled**: 취소됨

## 리뷰어 지정

리뷰어는 두 가지 형태로 지정할 수 있습니다:

### AI 에이전트
```yaml
reviewer: claude-opus-4
reviewer: claude-sonnet-4
```

### 사람
```yaml
reviewer: human:john@example.com
reviewer: human:alice
```

## 작업 영역 (Area)

작업 영역은 계층적 구조로 정의할 수 있습니다:

```yaml
area: Backend/Authentication
area: Frontend/UI/Components
area: DevOps/CI-CD
area: Documentation
area: Testing/Integration
```

## 모범 사례

### 1. 의존성 완전성 확보

**잘못된 예** (불완전한 의존성):
```markdown
## References
- /src/auth/login.ts
```

**올바른 예** (모든 의존성 명시):
```markdown
## References
# 직접 의존성
- /src/auth/login.ts
- /src/auth/user-service.ts

# 타입 의존성
- /src/types/user.ts
- /src/types/auth.ts

# 설정 및 유틸
- /src/config/jwt-config.ts
- /src/utils/password.ts

# 테스트 (참고용)
- /tests/auth/login.test.ts

# 문서 (참고용)
- /docs/api-spec.md
```

**왜 중요한가**:
- 불완전한 의존성 → Execute 시 컨텍스트 부족 → 잘못된 구현
- 완전한 의존성 → 한 번에 올바른 컨텍스트 구성

### 2. Area로 컨텍스트 범위 제한

**잘못된 예** (범위가 너무 넓음):
```yaml
area: src  # 전체 소스 코드 접근 가능
```

**올바른 예** (명확한 범위 설정):
```yaml
area: src/auth  # 인증 관련 코드만 접근
```

**효과**:
- 불필요한 컨텍스트 차단 → 토큰 절약
- 작업 범위 명확화 → 실수 방지
- 빠른 실행 → 필요한 파일만 로드

### 3. 계층적 의존성 분석

프로젝트 구조에 맞춰 의존성을 계층별로 정리:

```markdown
## References
# Layer 1: 타입 정의
- /src/types/user.ts
- /src/types/auth.ts

# Layer 2: 유틸리티
- /src/utils/jwt.ts
- /src/utils/password.ts

# Layer 3: 서비스
- /src/services/user-service.ts
- /src/services/auth-service.ts

# Layer 4: API
- /src/api/auth-routes.ts

# Layer 5: 테스트
- /tests/auth/*.ts
```

### 4. 성공 기준의 검증 가능성

**잘못된 예**:
```markdown
- [ ] 코드를 잘 작성한다
- [ ] 성능을 개선한다
```

**올바른 예**:
```markdown
- [ ] 로그인 API 응답 시간 < 200ms
- [ ] 단위 테스트 커버리지 85% 이상
- [ ] JWT 토큰 만료 시간 1시간으로 설정
- [ ] bcrypt salt rounds 10으로 설정
```

### 5. Task 재사용 패턴

유사한 작업을 반복할 때:

```bash
# 1. 기존 Task 복사
cp .claude/tasks/task-001.md .claude/tasks/task-002.md

# 2. 메타데이터만 수정
# - id: task-002
# - title: 새로운 제목
# - area: 새로운 영역

# 3. References는 유지하고 필요한 것만 추가/제거

# 4. Execute 시 즉시 실행 가능
```

### 6. 적절한 에이전트 선택

| 작업 유형 | 추천 에이전트 | 이유 |
|----------|-------------|------|
| 복잡한 알고리즘 구현 | claude-opus-4 | 높은 품질, 깊은 사고 |
| 일반 CRUD API | claude-sonnet-4 | 빠른 처리, 적절한 품질 |
| 리팩토링 | claude-opus-4 | 전체 구조 이해 필요 |
| 테스트 코드 작성 | claude-sonnet-4 | 패턴화된 작업 |
| 문서 작성 | claude-sonnet-4 | 빠른 작성 |

### 7. 리뷰 프로세스 최적화

```markdown
## Review Notes
### 검토 항목
- [ ] 모든 Success Criteria 충족 확인
- [ ] References에 명시된 파일 변경사항 확인
- [ ] Area 범위 외 변경사항 없는지 확인
- [ ] 테스트 통과 확인

### 검토 결과
✅ 성공 기준 모두 충족
✅ 코드 품질 양호
⚠️ 개선 제안: 에러 메시지 다국어 지원

### 후속 작업
- task-002: 다국어 지원 추가
```

## API 사용 (프로그래밍)

Tasks는 IPC API를 통해 프로그래밍 방식으로도 관리할 수 있습니다:

```typescript
// 작업 목록 조회
const tasks = await window.taskAPI.listTasks(projectPath);

// 작업 상세 조회
const taskContent = await window.taskAPI.getTask(projectPath, 'task-001');

// 작업 생성
await window.taskAPI.createTask(projectPath, 'task-002', markdownContent);

// 작업 수정
await window.taskAPI.updateTask(projectPath, 'task-001', updatedContent);

// 작업 삭제
await window.taskAPI.deleteTask(projectPath, 'task-001');
```

## 파싱 및 생성

Task 마크다운은 `taskParser` 모듈을 통해 파싱 및 생성됩니다:

```typescript
import { parseTaskMarkdown, generateTaskMarkdown } from './lib/taskParser';

// 마크다운 → Task 객체
const task = parseTaskMarkdown(markdownContent);

// Task 객체 → 마크다운
const markdown = generateTaskMarkdown(task);
```

## 데이터 모델

```typescript
interface Task {
  // Metadata
  id: string;
  title: string;
  area: string;
  assigned_agent: string;
  reviewer: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created: string; // ISO 8601
  updated: string; // ISO 8601

  // Content
  references: string[];
  successCriteria: string[];
  description: string;
  reviewNotes?: string;
}
```

## 향후 계획

### Execute 통합 강화
- [ ] **Task 선택 UI**: Execute 페이지에 Task 드롭다운 추가
- [ ] **자동 컨텍스트 구성**: Task의 References를 읽어 자동으로 파일 로드
- [ ] **Area 기반 필터링**: Area 외부 파일 자동 차단
- [ ] **프롬프트 생성**: Task Description을 기반으로 프롬프트 자동 생성
- [ ] **실시간 진행률**: Success Criteria 기반 진행률 표시

### 의존성 분석 자동화
- [ ] **의존성 자동 탐지**: 코드 분석을 통한 의존성 자동 추출
- [ ] **의존성 그래프**: 파일 간 의존 관계 시각화
- [ ] **순환 의존성 감지**: 잘못된 의존성 구조 경고
- [ ] **최적화 제안**: 불필요한 의존성 제거 제안

### 컨텍스트 최적화
- [ ] **컨텍스트 크기 예측**: Execute 전 예상 토큰 사용량 표시
- [ ] **동적 컨텍스트 조정**: Area 범위를 동적으로 확장/축소
- [ ] **캐싱**: 자주 사용되는 References 캐싱
- [ ] **증분 로딩**: 필요한 파일만 점진적으로 로드

### 작업 관리
- [ ] **작업 템플릿**: 자주 사용하는 패턴을 템플릿으로 저장
- [ ] **작업 간 의존성**: Task A 완료 후 Task B 실행
- [ ] **자동 상태 전이**: Success Criteria 충족 시 자동 completed
- [ ] **작업 체인**: 여러 Task를 순차적으로 실행

### 협업 기능
- [ ] **팀 할당**: 여러 명에게 작업 할당
- [ ] **댓글 시스템**: Task에 댓글 추가
- [ ] **변경 이력**: Task 수정 내역 추적
- [ ] **알림**: 작업 상태 변경 시 알림

### 통합 기능
- [ ] **Git 연동**: 커밋 메시지에 Task ID 자동 추가
- [ ] **PR 연동**: PR과 Task 연결
- [ ] **이슈 트래커**: GitHub Issues, Jira 연동
- [ ] **CI/CD**: Task 기반 자동 테스트 실행

### 분석 및 리포팅
- [ ] **작업 통계**: 완료율, 평균 소요 시간
- [ ] **토큰 사용량 분석**: Task별 컨텍스트 크기 통계
- [ ] **에이전트 성능**: 에이전트별 성공률 분석
- [ ] **리뷰 품질**: 리뷰어별 검토 시간 및 피드백 통계
