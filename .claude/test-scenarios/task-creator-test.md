# Task Creator Agent 테스트 시나리오

## 목적

task-creator agent가 프로젝트를 분석하고 적절한 Task를 생성하는지 검증합니다.

## 사전 준비

1. **Agent 등록 확인**
   ```bash
   ls -la .claude/agents/task-creator.md
   ```

2. **Context 문서 확인**
   ```bash
   ls -la .claude/context/
   # project-architecture.md
   # coding-conventions.md
   # task-creation-guide.md
   ```

3. **MCP 설정 확인**
   ```bash
   cat .claude/.mcp-dev.json | jq '.mcpServers | keys'
   # serena가 활성화되어 있어야 함
   ```

## 테스트 시나리오

### 시나리오 1: 단순 기능 추가

**요청:**
```
@task-creator

ExecutionsPage에 검색 기능을 추가해주세요.
사용자가 Session ID로 실행 내역을 검색할 수 있어야 합니다.
```

**기대 결과:**
- Task 파일이 `.claude/tasks/task-{timestamp}.md` 형식으로 생성됨
- Title: "Add session ID search to ExecutionsPage" 형태
- Area: "Frontend/Pages"
- assigned_agent: "claude-sonnet-4" (단순 기능이므로)
- References: ExecutionsPage.tsx, ExecutionsList.tsx 등 관련 파일 포함
- Success Criteria: 최소 3개 이상, 구체적으로 작성됨

**검증 방법:**
```bash
# 생성된 Task 확인
ls -lt .claude/tasks/ | head -1

# Task 내용 검토
cat .claude/tasks/task-*.md
```

### 시나리오 2: 복잡한 리팩토링

**요청:**
```
@task-creator

IPC 핸들러들의 에러 처리 코드가 중복되고 있습니다.
공통 에러 핸들링 로직을 만들어서 모든 핸들러에 적용해주세요.
```

**기대 결과:**
- Title: "Refactor IPC handlers to use centralized error handling" 형태
- Area: "Backend/IPC"
- assigned_agent: "claude-opus-4" (복잡한 리팩토링이므로)
- Description에 배경, 목표, 접근 방법이 상세히 작성됨
- References: 여러 IPC 핸들러 파일들 나열
- Success Criteria: 리팩토링 후 동작 검증 항목 포함

### 시나리오 3: 문서 작성

**요청:**
```
@task-creator

Agents 기능에 대한 사용자 가이드 문서를 작성해주세요.
초보자도 쉽게 따라할 수 있어야 합니다.
```

**기대 결과:**
- Title: "Create user guide for Agents feature" 형태
- Area: "Docs/Features"
- assigned_agent: "claude-haiku-4" (문서 작성이므로)
- References: AgentsPage.tsx, tool-groups.md 등 참고 자료
- Success Criteria: 목차, 예시 코드, 스크린샷 포함 여부 등

### 시나리오 4: 버그 수정

**요청:**
```
@task-creator

TasksPage에서 Task 삭제 시 확인 다이얼로그가 나타나지 않습니다.
이 버그를 수정해주세요.
```

**기대 결과:**
- Title: "Fix task deletion confirmation dialog not showing" 형태
- Area: "Frontend/Pages"
- assigned_agent: "claude-sonnet-4"
- Description에 버그 재현 방법 포함
- Success Criteria: 테스트 방법 명시

## 품질 평가 기준

각 생성된 Task를 다음 기준으로 평가합니다:

### 1. 명확성 (5점)
- [ ] 제목만 봐도 무엇을 하는지 알 수 있음
- [ ] Description이 구체적임
- [ ] 전문 용어 사용이 적절함

### 2. 실행 가능성 (5점)
- [ ] Agent가 실제로 수행 가능한 작업으로 분해됨
- [ ] 필요한 정보가 모두 포함됨
- [ ] 작업 범위가 적절함 (너무 크지도, 작지도 않음)

### 3. 측정 가능성 (5점)
- [ ] Success Criteria가 3개 이상
- [ ] 각 기준이 객관적으로 확인 가능
- [ ] 체크리스트 형식 (`- [ ]`)으로 작성됨

### 4. 컨텍스트 (5점)
- [ ] 배경 (Why) 설명이 충분함
- [ ] 목표 (What) 가 명확함
- [ ] 접근 방법 (How) 이 제시됨

### 5. References (5점)
- [ ] 관련 파일 경로가 정확함
- [ ] 참고 문서 URL 포함
- [ ] 실제 존재하는 파일만 나열

**총점: 25점 만점**
- 20점 이상: 우수
- 15-19점: 양호
- 10-14점: 개선 필요
- 10점 미만: 재작성 필요

## 개선 포인트 도출

각 시나리오 테스트 후 다음을 기록합니다:

1. **잘된 점**
   - 어떤 부분이 기대에 부합했는가?
   - 특히 인상적인 부분은?

2. **개선이 필요한 점**
   - 어떤 부분이 부족한가?
   - 무엇을 추가/수정해야 하는가?

3. **Agent 조정 사항**
   - allowedTools 변경 필요?
   - Permissions 조정 필요?
   - 지시사항 보완 필요?

## 실행 방법

### 터미널에서 직접 실행

```bash
cd /Users/junwoobang/project/claude-code-spec

# 시나리오 1 실행
claude -p "@task-creator ExecutionsPage에 Session ID 검색 기능 추가" \
  --output-format stream-json \
  --mcp-config .claude/.mcp-dev.json \
  --strict-mcp-config

# 생성된 Task 확인
ls -lt .claude/tasks/ | head -5
cat .claude/tasks/task-$(ls -t .claude/tasks/ | head -1 | sed 's/task-//' | sed 's/.md//')*.md
```

### Controller UI에서 실행

1. Execute 페이지로 이동
2. Query 입력:
   ```
   @task-creator ExecutionsPage에 Session ID 검색 기능 추가
   ```
3. Execute 버튼 클릭
4. 스트림 응답 확인
5. Tasks 페이지에서 생성된 Task 확인

## 결과 기록 템플릿

```markdown
## 테스트 결과: [시나리오명]

**실행 일시:** 2024-XX-XX HH:MM:SS
**Agent:** task-creator
**요청:** [요청 내용]

### 생성된 Task

**파일:** `.claude/tasks/task-XXXXXXXXX.md`

**메타데이터:**
- title: [...]
- area: [...]
- assigned_agent: [...]
- reviewer: [...]

**Description 요약:**
[...]

**References:**
- [...]

**Success Criteria:**
- [...]

### 품질 평가

| 항목 | 점수 | 비고 |
|------|------|------|
| 명확성 | /5 | [...] |
| 실행 가능성 | /5 | [...] |
| 측정 가능성 | /5 | [...] |
| 컨텍스트 | /5 | [...] |
| References | /5 | [...] |
| **총점** | **/25** | |

### 개선 사항

**잘된 점:**
- [...]

**개선이 필요한 점:**
- [...]

**Agent 조정 계획:**
- [...]
```

## 다음 단계

1. 각 시나리오 실행
2. 결과 기록 및 평가
3. Agent 조정
4. 재테스트
5. 최종 검증
