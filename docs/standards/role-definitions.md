# Role Definitions (역할 정의서)

## 시스템 역할 표준화

모든 컴포넌트와 Agent의 역할을 명확히 정의하여 일관된 동작을 보장합니다.

---

## 1. Core System Roles (핵심 시스템 역할)

### 1.1 TaskLifecycleManager

**역할**: Task의 전체 생명주기를 관리하는 중앙 관리자

**책임**:
- Task 상태 전이 검증 및 실행
- Task 의존성 해결
- 실행 가능한 Task 식별
- 다음 실행할 Task 선택
- Task 완료 처리

**입력**:
- Task ID
- 상태 전이 요청
- 프로젝트 경로

**출력**:
- 상태 업데이트 결과
- 실행 가능 Task 목록
- Task 통계

**규칙**:
- 모든 상태 전이는 검증 후 실행
- 의존성이 해결되지 않은 Task는 실행 불가
- 상태 변경 시 히스토리 기록

---

### 1.2 TaskValidator

**역할**: Task 정의의 유효성을 검증

**책임**:
- Task 파일 구조 검증
- 필수 필드 존재 여부 확인
- References 유효성 검사
- Success Criteria 형식 검증

**입력**:
- Task 마크다운 콘텐츠
- 프로젝트 경로

**출력**:
- 검증 결과 (valid: boolean)
- 에러 목록
- 경고 목록

**규칙**:
- 에러가 하나라도 있으면 invalid
- 경고는 valid일 수 있음
- 파일 참조는 실제 존재 여부 확인

---

### 1.3 AgentPoolManager

**역할**: Agent 인스턴스의 풀 관리

**책임**:
- Agent 정의 로드 및 캐싱
- Agent 인스턴스 생성 및 재사용
- Agent 상태 추적 (idle/busy)
- Agent 할당 및 해제

**입력**:
- Agent 이름
- 프로젝트 경로

**출력**:
- Agent 인스턴스
- Agent 통계
- Pool 상태

**규칙**:
- Agent는 싱글톤으로 관리 (이름당 1개 인스턴스)
- Busy Agent는 완료 시까지 재할당 불가
- 프로젝트별로 Agent Pool 격리

---

### 1.4 TaskRouter

**역할**: Task를 적절한 Agent에 라우팅하고 실행

**책임**:
- Task에 할당된 Agent 가져오기
- Agent 컨텍스트 구성
- ProcessManager를 통한 실행
- 실행 완료 후 Agent 해제

**입력**:
- Task 객체
- 실행 옵션 (model, mcpConfig)

**출력**:
- Session ID
- 실행 결과

**규칙**:
- Agent가 busy면 대기 또는 에러
- Task 정보를 Agent 프롬프트에 포함
- 실행 완료/실패 시 Agent 상태 업데이트

---

### 1.5 ProcessManager

**역할**: Claude CLI 프로세스 실행 및 관리

**책임**:
- 병렬 프로세스 실행
- 프로세스 상태 추적
- 출력 스트림 파싱
- 프로세스 종료 및 정리

**입력**:
- 실행 파라미터 (projectPath, query, model 등)
- 콜백 함수

**출력**:
- Session ID
- 실시간 스트림 이벤트
- 실행 완료 알림

**규칙**:
- 동시 실행 개수 제한 (maxConcurrent)
- 실행 이력 유지 (maxHistorySize)
- 자동 정리 (autoCleanupInterval)

---

### 1.6 StreamParser

**역할**: Claude CLI의 stream-json 출력 파싱

**책임**:
- JSONL 형식 파싱
- 불완전한 JSON 버퍼링
- ANSI 코드 제거
- 이벤트 콜백 호출

**입력**:
- stdout 청크
- 에러 핸들러

**출력**:
- 파싱된 StreamEvent 객체

**규칙**:
- 줄 단위로 파싱 (\\n 또는 \\r\\n)
- 파싱 실패 시 에러 콜백 호출
- 버퍼 오버플로우 감지

---

## 2. Central Management Roles (중앙 관리 역할)

### 2.1 CentralDatabase

**역할**: 모든 프로젝트의 통합 데이터 저장소

**책임**:
- 프로젝트 상태 저장/조회
- 보고서 저장 및 아카이빙
- Agent 실행 기록 관리
- 시스템 메트릭 집계

**입력**:
- 프로젝트 업데이트
- 보고서
- 실행 기록

**출력**:
- 조회 결과
- 통계 데이터

**규칙**:
- ~/.claude/central-management/ 에 저장
- 일별 보고서 아카이빙
- 트랜잭션 보장

---

### 2.2 AgentTracker

**역할**: 실행 중인 Agent 추적 및 모니터링

**책임**:
- Agent 실행 등록
- 실행 상태 업데이트
- Zombie 프로세스 감지
- Health check 수행

**입력**:
- 실행 시작/종료 이벤트
- PID, Session ID

**출력**:
- 활성 실행 목록
- Zombie 프로세스 목록

**규칙**:
- ProcessManager와 통합
- 5분마다 health check
- 응답 없는 프로세스 자동 정리

---

### 2.3 CentralReporter (Agent)

**역할**: 주기적으로 모든 프로젝트의 상태를 수집하여 보고

**책임**:
- 등록된 모든 프로젝트 스캔
- Task 통계 수집
- Agent 상태 수집
- 중앙 DB에 보고서 제출

**입력**:
- 프로젝트 목록
- 수집 주기 설정

**출력**:
- Periodic Report

**규칙**:
- 매 1시간마다 자동 실행
- 프로젝트별로 독립적으로 수집
- 에러 발생 시 해당 프로젝트만 스킵

---

### 2.4 ProgressCalculator

**역할**: Task 진척도 자동 계산

**책임**:
- Success Criteria 기반 계산
- 실행 시간 기반 추정
- 파일 변경 기반 계산
- 종합 진척도 산출

**입력**:
- Task 객체
- Session ID (optional)

**출력**:
- ProgressReport (percent, confidence, method)

**규칙**:
- Success Criteria가 최우선
- 여러 방법으로 계산 후 최댓값 선택
- Confidence score 제공

---

### 2.5 ReportValidator

**역할**: 중앙 시스템에 제출되는 보고서 검증

**책임**:
- 보고서 형식 검증
- 필수 필드 확인
- 데이터 타입 검증
- 비즈니스 룰 검증

**입력**:
- Report 객체

**출력**:
- 검증 결과
- 에러 목록

**규칙**:
- 타입별 검증 규칙 적용
- Invalid report는 거부
- 검증 실패 시 로그 기록

---

## 3. Agent Roles (Agent 역할)

### 3.1 task-generator (Agent)

**역할**: 프로젝트를 분석하여 구조화된 Task 생성

**책임**:
- CLAUDE.md 분석
- 코드베이스 구조 파악
- Task 파일 생성 (workflow/tasks/)
- Task 간 의존성 정의

**허용 도구**:
- Read, Glob, Grep
- Serena MCP (코드 분석)
- Write (workflow/tasks/ 만)

**출력**:
- task-XXX.md 파일들

**규칙**:
- 코드는 수정하지 않음 (Task 정의만)
- Task 크기: Small to Medium
- 명확한 Success Criteria 포함

---

### 3.2 central-reporter (Agent)

**역할**: 주기적 상태 수집 및 중앙 보고

**책임**:
- 프로젝트 목록 조회
- 각 프로젝트의 Task/Agent 상태 수집
- 통계 계산
- Periodic Report 생성

**허용 도구**:
- Read (프로젝트 파일)
- Glob (Task/Agent 파일 목록)
- centralAPI (보고서 제출)

**출력**:
- Periodic Report

**규칙**:
- 1시간마다 자동 실행
- 에러 발생 시 재시도 (최대 3회)
- 보고서는 CentralDatabase에 저장

---

### 3.3 workflow-orchestrator (Agent)

**역할**: 자동화된 워크플로우 실행 및 관리

**책임**:
- 다음 Task 선택
- Task 실행
- 완료 검증
- 다음 Task로 진행

**허용 도구**:
- taskAPI (Task 관리)
- claudeAPI (Task 실행)
- centralAPI (진척 보고)

**출력**:
- 워크플로우 실행 결과

**규칙**:
- 의존성 해결된 Task만 실행
- 실패 시 재시도 (최대 3회)
- 블로커 발생 시 중단 및 보고

---

## 4. UI Component Roles (UI 컴포넌트 역할)

### 4.1 TasksPage

**역할**: Task 관리 인터페이스

**책임**:
- Task 목록 표시
- Task CRUD 작업
- Task 통계 표시
- Task Generator 실행

**입력**:
- 프로젝트 경로 (Context)

**출력**:
- Task 목록 UI
- Task 상세 UI

**규칙**:
- 프로젝트 선택 필수
- Task 선택 시 상세 표시
- Execute 시 권한 확인

---

### 4.2 CentralDashboardPage

**역할**: 중앙 관리 대시보드

**책임**:
- 전체 프로젝트 상태 표시
- 활성 Agent 목록
- 최근 보고서
- 시스템 메트릭

**입력**:
- CentralDatabase 조회

**출력**:
- 통합 대시보드 UI

**규칙**:
- 실시간 업데이트 (IPC 구독)
- 프로젝트 클릭 시 상세 뷰
- 알림 표시 (경고/에러)

---

### 4.3 WorkflowPage

**역할**: 워크플로우 실행 모니터링

**책임**:
- 워크플로우 시작/중지
- Task 실행 순서 표시
- 실시간 진척도 업데이트
- 의존성 그래프 시각화

**입력**:
- 프로젝트 경로
- 워크플로우 상태

**출력**:
- 워크플로우 모니터링 UI

**규칙**:
- 한 프로젝트당 하나의 워크플로우
- 실행 중에는 중지만 가능
- 완료 시 통계 표시

---

## 5. Interaction Rules (상호작용 규칙)

### 5.1 Task 생성 플로우

```
User/Agent → TasksPage.createTask()
           → taskAPI.createTask()
           → IPC: task:createTask
           → TaskHandlers.createTask()
           → TaskValidator.validateTaskContent()
           → fs.writeFile()
           → Success
```

**규칙**:
- 생성 전 검증 필수
- ID 중복 체크
- 파일 쓰기 권한 확인

---

### 5.2 Task 실행 플로우

```
User → TasksPage.executeTask()
     → taskAPI.executeTask()
     → IPC: task:executeTask
     → TaskHandlers.executeTask()
     → AgentPoolManager.loadAgentDefinitions()
     → TaskRouter.routeTask()
     → AgentPoolManager.getAgent()
     → ProcessManager.startExecution()
     → StreamParser.processChunk()
     → UI Update (real-time)
     → Task Completion
     → AgentPoolManager.markAgentIdle()
```

**규칙**:
- Agent가 busy면 대기 또는 에러
- 실행 전 의존성 확인
- 실시간 스트림 업데이트
- 완료 시 Agent 해제

---

### 5.3 중앙 보고 플로우

```
Task Event → TaskLifecycleManager
          → centralAPI.submitReport()
          → IPC: central:submitReport
          → CentralHandlers.submitReport()
          → ReportValidator.validate()
          → CentralDatabase.saveReport()
          → CentralDashboardPage update
```

**규칙**:
- 모든 중요 이벤트는 보고
- 보고서 검증 필수
- 실시간 대시보드 업데이트

---

## 6. Responsibility Matrix (책임 매트릭스)

| 기능 | TaskLifecycle | AgentPool | TaskRouter | ProcessMgr | Central |
|-----|--------------|-----------|------------|------------|---------|
| Task 상태 관리 | ✅ Primary | | | | ✅ Monitor |
| Agent 할당 | | ✅ Primary | ✅ Request | | |
| Task 실행 | | | ✅ Primary | ✅ Execute | |
| 진척도 추적 | ✅ Calculate | | | | ✅ Collect |
| 보고서 생성 | | | | | ✅ Primary |
| 프로세스 관리 | | | | ✅ Primary | ✅ Track |

**범례**:
- ✅ Primary: 주 책임자
- ✅ Request: 요청자
- ✅ Execute: 실행자
- ✅ Monitor: 모니터링
- ✅ Collect: 수집
- ✅ Calculate: 계산
- ✅ Track: 추적

---

## 7. Conflict Resolution Rules (충돌 해결 규칙)

### 7.1 Agent Busy 충돌

**상황**: Task 실행 요청 시 Agent가 이미 busy

**해결**:
1. 대기 (queue에 추가) - 기본
2. 다른 Agent 사용 (가능한 경우)
3. 에러 반환 (즉시 실행 필요 시)

**선택 기준**: TaskRouter 설정

---

### 7.2 Task 의존성 충돌

**상황**: Task A가 Task B에 의존하는데 B가 완료 안됨

**해결**:
1. Task A는 pending 유지
2. Task B 완료 후 A 실행
3. B 실패 시 A도 blocked 상태

**규칙**: TaskLifecycleManager가 자동 처리

---

### 7.3 상태 전이 충돌

**상황**: 잘못된 상태 전이 시도 (예: completed → pending)

**해결**:
1. 검증 실패 → 에러 반환
2. 유효한 전이만 허용
3. 로그 기록

**규칙**: 명시적 허용만 가능

---

모든 컴포넌트와 Agent는 이 역할 정의를 준수해야 합니다.
