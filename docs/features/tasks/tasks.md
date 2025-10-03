# Tasks Feature - Implementation Status & Analysis

## 개요

Tasks는 Claude CLI 실행을 위한 작업 명세 시스템으로, 의존성 분석과 컨텍스트 최적화를 통해 효율적인 Execute를 가능하게 합니다. 본 문서는 현재 구현 상태, 검증 결과, 개선점을 종합적으로 분석합니다.

**주요 파일:**
- UI: `/Users/junwoobang/project/claude-code-spec/src/pages/TasksPage.tsx`
- Types: `/Users/junwoobang/project/claude-code-spec/src/types/task.ts`
- IPC Handlers: `/Users/junwoobang/project/claude-code-spec/src/ipc/handlers/taskHandlers.ts`
- Parser: `/Users/junwoobang/project/claude-code-spec/src/lib/taskParser.ts`
- Components: `/Users/junwoobang/project/claude-code-spec/src/components/task/`

---

## 현재 구현 상태

### ✅ 구현 완료

#### 1. 기본 CRUD 작업
- [x] **작업 목록 조회** (`listTasks`)
  - 파일: `taskHandlers.ts:56-94`
  - `.claude/tasks/*.md` 파일 스캔
  - Frontmatter 파싱하여 메타데이터 추출
  - 최신 업데이트 순 정렬

- [x] **작업 상세 조회** (`getTask`)
  - 파일: `taskHandlers.ts:97-110`
  - Markdown 파일 전체 내용 반환

- [x] **작업 생성** (`createTask`)
  - 파일: `taskHandlers.ts:113-135`
  - 중복 체크 (파일 존재 여부)
  - `.claude/tasks/` 디렉토리 자동 생성

- [x] **작업 수정** (`updateTask`)
  - 파일: `taskHandlers.ts:138-152`
  - 기존 파일 덮어쓰기

- [x] **작업 삭제** (`deleteTask`)
  - 파일: `taskHandlers.ts:155-169`
  - 파일 시스템에서 완전 삭제

#### 2. UI 컴포넌트
- [x] **2단 레이아웃**
  - 좌측: 작업 목록 사이드바 (320px 고정)
  - 우측: 작업 상세/편집 영역

- [x] **작업 목록 표시**
  - 파일: `TasksPage.tsx:211-254`
  - 제목, 상태, 영역, 메타정보 표시
  - 선택된 작업 하이라이트
  - 빈 상태 및 로딩 상태 처리

- [x] **작업 상세 뷰**
  - 파일: `TasksPage.tsx:457-461`
  - Markdown 원본 미리보기 (`<pre>` 태그)

- [x] **작업 편집 폼**
  - 파일: `TasksPage.tsx:288-456`
  - 모든 필드 입력 지원:
    - Title (필수)
    - Work Area (WorkAreaSelector 통합)
    - Assigned Agent (AgentSelector 통합)
    - Reviewer
    - Status (드롭다운)
    - Description (Textarea)
    - References (동적 리스트)
    - Success Criteria (동적 리스트)

#### 3. 상태 관리
- [x] **상태 타입**
  - `pending`, `in_progress`, `completed`, `cancelled`
  - UI에서 드롭다운으로 선택 가능
  - 상태별 색상 구분 (CSS 클래스)

- [x] **편집/생성 모드 분리**
  - `isEditing`: 편집 모드 플래그
  - `isCreating`: 신규 생성 플래그
  - 모드별 다른 UI 표시

#### 4. 데이터 파싱
- [x] **Markdown → Task 객체**
  - 파일: `taskParser.ts:6-64`
  - Frontmatter 파싱 (YAML 형식)
  - 섹션 파싱 (References, Success Criteria, Description, Review Notes)
  - 정규식 기반 추출

- [x] **Task 객체 → Markdown**
  - 파일: `taskParser.ts:69-96`
  - Frontmatter 생성
  - 섹션별 포맷팅
  - 빈 섹션 제외 (선택적 출력)

#### 5. 통합 컴포넌트
- [x] **WorkAreaSelector**
  - 파일: `WorkAreaSelector.tsx`
  - 카테고리별 그룹화된 드롭다운
  - `.claude/work-areas.json` 기반
  - 선택된 영역 배지 표시

- [x] **AgentSelector**
  - 파일: `AgentSelector.tsx`
  - 기본 에이전트 옵션 (sonnet-4, opus-4, haiku-4)
  - 프로젝트/사용자 에이전트 그룹화
  - 에이전트 정보 표시 (description, tools, permissions)

#### 6. 유효성 검증
- [x] **필수 필드 검증**
  - 파일: `TasksPage.tsx:107-110`
  - Title 필드 필수 체크
  - 토스트 메시지로 에러 표시

- [x] **타임스탬프 관리**
  - 파일: `TasksPage.tsx:113-126`
  - 생성 시: 새 타임스탬프 설정
  - 수정 시: updated만 갱신, created 유지

#### 7. IPC 통신
- [x] **Preload API 노출**
  - 파일: `task.ts:26-44`
  - `window.taskAPI` 전역 객체
  - 모든 CRUD 메서드 노출

- [x] **타입 안전성**
  - 파일: `window.d.ts:27`
  - TypeScript 타입 정의
  - Promise 기반 비동기 API

---

## 검증 결과

### ✅ 정상 작동 확인

#### 1. 파일 시스템 작업
- **디렉토리 생성**: `.claude/tasks/` 자동 생성 (재귀적)
- **파일 읽기/쓰기**: UTF-8 인코딩으로 정상 처리
- **파일 삭제**: 안전하게 삭제 (에러 처리 포함)

#### 2. UI 인터랙션
- **작업 선택**: 클릭 및 키보드 입력 (Enter, Space) 지원
- **폼 편집**: 모든 입력 필드 정상 작동
- **동적 리스트**: References/Success Criteria 추가/제거 정상
- **키보드 단축키**: Enter 키로 항목 추가 가능

#### 3. 데이터 일관성
- **파싱 정확도**: Frontmatter 및 섹션 파싱 정확
- **타임스탬프**: ISO 8601 형식 준수
- **상태 전환**: 모든 상태 간 전환 가능

#### 4. 에러 처리
- **파일 없음**: null 반환 및 토스트 메시지
- **중복 생성**: 에러 메시지 반환
- **파싱 실패**: 적절한 에러 처리 (throw Error)

---

## 누락된 기능

### ❌ Execute 통합 (핵심 기능)

**상태**: ❌ 미구현
**우선순위**: 🔴 높음

Tasks의 핵심 목적인 Execute 통합이 구현되지 않았습니다.

**필요한 구현:**
1. **ExecutionsPage에 Task 선택 UI 추가**
   - 파일: `src/pages/ExecutionsPage.tsx`
   - Task 드롭다운 또는 선택 모달

2. **Task → Execute 자동 변환**
   - Task의 References를 컨텍스트로 자동 로드
   - Area 설정을 권한 필터로 적용
   - Description을 프롬프트로 사용

3. **Claude CLI 명령어 구성**
   ```bash
   claude -p "{task.description}" \
     --context {task.references} \
     --area {task.area} \
     --agent {task.assigned_agent}
   ```

**영향:**
- 현재 Tasks는 독립적인 메모 시스템에 불과
- Execute와의 연계가 없어 핵심 가치 미달성

### ❌ 작업 진행률 추적

**상태**: ❌ 미구현
**우선순위**: 🟠 중간

Success Criteria를 체크박스로 표시하여 진행 상황을 시각화하는 기능이 없습니다.

**현재 상태:**
- Success Criteria는 단순 문자열 배열
- 체크 여부 추적 불가

**필요한 구현:**
```typescript
// Task 타입 확장
interface SuccessCriterion {
  text: string;
  completed: boolean;
}

// UI에 체크박스 추가
{successCriteria.map((criterion, index) => (
  <div key={index}>
    <input
      type="checkbox"
      checked={criterion.completed}
      onChange={() => toggleCriterion(index)}
    />
    <span>{criterion.text}</span>
  </div>
))}
```

### ❌ Review Notes 편집 UI

**상태**: ❌ 미구현
**우선순위**: 🟠 중간

Review Notes 섹션이 데이터 모델에는 있지만 UI에서 편집할 수 없습니다.

**현재 상태:**
- `Task` 타입에 `reviewNotes?: string` 필드 존재
- 파서에서 파싱은 지원 (`taskParser.ts:55-58`)
- UI에 입력 필드 없음

**필요한 구현:**
```tsx
<div className={styles.formGroup}>
  <label htmlFor="review-notes">Review Notes:</label>
  <textarea
    id="review-notes"
    value={reviewNotes}
    onChange={(e) => setReviewNotes(e.target.value)}
    placeholder="Reviewer's notes..."
  />
</div>
```

### ❌ Task ID 자동 생성 개선

**상태**: ⚠️ 부분 구현
**우선순위**: 🟢 낮음

현재 Task ID가 타임스탬프 기반이지만 가독성이 떨어집니다.

**현재 구현:**
```typescript
// TasksPage.tsx:89
const taskId = `task-${Date.now()}`; // task-1704441600000
```

**개선 방안:**
```typescript
// Option 1: Slug 기반
const taskId = slugify(title); // task-user-authentication-api

// Option 2: 순차 번호
const taskId = `task-${String(nextId).padStart(3, '0')}`; // task-001

// Option 3: 날짜 + 순번
const taskId = `task-${format(new Date(), 'yyyyMMdd')}-${seq}`; // task-20250103-01
```

### ❌ 작업 템플릿

**상태**: ❌ 미구현
**우선순위**: 🟢 낮음

자주 사용하는 작업 패턴을 템플릿으로 저장하는 기능이 없습니다.

**제안 구현:**
```typescript
interface TaskTemplate {
  id: string;
  name: string;
  area: string;
  defaultReferences: string[];
  defaultCriteria: string[];
}

// UI: "From Template" 버튼
<button onClick={() => loadTemplate('crud-api')}>
  Load Template
</button>
```

### ❌ 작업 검색 및 필터링

**상태**: ❌ 미구현
**우선순위**: 🟡 중간

작업이 많아지면 검색 및 필터링이 필요합니다.

**필요한 기능:**
- 제목/설명으로 검색
- 상태별 필터 (pending, in_progress, etc.)
- 영역별 필터 (Area)
- 에이전트별 필터

---

## 개선점

### 1. UI/UX 개선

#### 1.1. 작업 목록 가독성
**파일**: `TasksPage.tsx:225-251`

**현재 문제:**
- 작업 메타정보가 세로로 나열되어 공간 낭비
- Agent와 Reviewer 정보가 분리되어 있음

**개선 방안:**
```tsx
// Before
<div className={styles.taskMeta}>
  <span>Agent: {task.assigned_agent}</span>
  {task.reviewer && <span>Reviewer: {task.reviewer}</span>}
</div>

// After (가로 배치)
<div className={styles.taskMeta}>
  <span className={styles.metaItem}>
    <User size={12} /> {task.assigned_agent}
  </span>
  {task.reviewer && (
    <span className={styles.metaItem}>
      <CheckCircle size={12} /> {task.reviewer}
    </span>
  )}
  <span className={styles.metaItem}>
    <Clock size={12} /> {formatDate(task.updated)}
  </span>
</div>
```

#### 1.2. 편집 폼 레이아웃
**파일**: `TasksPage.tsx:288-456`

**현재 문제:**
- 모든 필드가 세로로 나열되어 스크롤이 많음
- 관련 필드 그룹화 부족

**개선 방안:**
```tsx
{/* 메타정보 그룹 (2열) */}
<div className={styles.formRow}>
  <div className={styles.formCol}>
    <label>Title *</label>
    <input {...} />
  </div>
  <div className={styles.formCol}>
    <label>Status</label>
    <select {...} />
  </div>
</div>

{/* 할당 정보 그룹 (2열) */}
<div className={styles.formRow}>
  <AgentSelector {...} />
  <div className={styles.formCol}>
    <label>Reviewer</label>
    <input {...} />
  </div>
</div>
```

#### 1.3. Preview 모드 개선
**파일**: `TasksPage.tsx:457-461`

**현재 문제:**
- 단순 `<pre>` 태그로 Markdown 원본 표시
- 가독성 떨어짐

**개선 방안:**
```tsx
// Markdown 렌더링 라이브러리 사용
import ReactMarkdown from 'react-markdown';

<div className={styles.preview}>
  <ReactMarkdown>{taskContent}</ReactMarkdown>
</div>

// 또는 섹션별 구조화된 뷰
<div className={styles.structuredPreview}>
  <section>
    <h3>Description</h3>
    <p>{task.description}</p>
  </section>
  <section>
    <h3>References</h3>
    <ul>
      {task.references.map(ref => <li key={ref}>{ref}</li>)}
    </ul>
  </section>
  {/* ... */}
</div>
```

### 2. 코드 품질 개선

#### 2.1. 중복 코드 제거
**파일**: `TasksPage.tsx:173-199`

**문제:**
Cancel 핸들러에서 Task 상태 복원 로직이 중복됩니다.

**개선 방안:**
```typescript
// 상태 복원 함수 분리
const restoreTaskState = useCallback((content: string) => {
  const task = parseTaskMarkdown(content);
  setTitle(task.title);
  setArea(task.area);
  setAssignedAgent(task.assigned_agent);
  setReviewer(task.reviewer);
  setStatus(task.status);
  setDescription(task.description);
  setReferences(task.references || []);
  setSuccessCriteria(task.successCriteria || []);
}, []);

// loadTask와 handleCancel에서 재사용
const loadTask = useCallback((taskId: string) => {
  // ...
  restoreTaskState(content);
}, [restoreTaskState]);

const handleCancel = () => {
  if (!isCreating && taskContent) {
    restoreTaskState(taskContent);
  }
  setIsEditing(false);
};
```

#### 2.2. 타입 안전성 강화
**파일**: `taskParser.ts:17-24`

**문제:**
Frontmatter 파싱 시 타입 캐스팅이 불안전합니다.

```typescript
// Before (unsafe)
metadata[key.trim() as keyof TaskMetadata] = value as any;

// After (safe)
const parseMetadata = (frontmatter: string): TaskMetadata => {
  const lines = frontmatter.split('\n');
  const metadata: Partial<TaskMetadata> = {};

  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    const trimmedKey = key.trim();
    const value = valueParts.join(':').trim();

    switch (trimmedKey) {
      case 'id':
      case 'title':
      case 'area':
      case 'assigned_agent':
      case 'reviewer':
        metadata[trimmedKey] = value;
        break;
      case 'status':
        if (['pending', 'in_progress', 'completed', 'cancelled'].includes(value)) {
          metadata.status = value as Task['status'];
        }
        break;
      case 'created':
      case 'updated':
        metadata[trimmedKey] = value;
        break;
    }
  }

  // 필수 필드 검증
  if (!metadata.id || !metadata.title) {
    throw new Error('Missing required fields: id, title');
  }

  return metadata as TaskMetadata;
};
```

#### 2.3. 에러 처리 개선
**파일**: `taskHandlers.ts:90-93`

**문제:**
에러 발생 시 빈 배열 반환하여 실패 여부를 알 수 없습니다.

```typescript
// Before
} catch (error) {
  console.error('[TaskHandlers] Failed to list tasks:', error);
  return [];
}

// After
} catch (error) {
  console.error('[TaskHandlers] Failed to list tasks:', error);
  throw new Error(`Failed to list tasks: ${error.message}`);
}

// UI에서 처리
try {
  const tasks = await window.taskAPI.listTasks(projectPath);
  setTasks(tasks);
} catch (error) {
  toast.error(`Failed to load tasks: ${error.message}`);
  setTasks([]);
}
```

### 3. 성능 개선

#### 3.1. 파일 읽기 최적화
**파일**: `taskHandlers.ts:64-79`

**문제:**
모든 Task 파일을 순차적으로 읽어 느립니다.

**개선 방안:**
```typescript
// Before (순차)
for (const file of taskFiles) {
  const content = await fs.readFile(filePath, 'utf-8');
  // ...
}

// After (병렬)
const taskPromises = taskFiles.map(async (file) => {
  const filePath = path.join(tasksPath, file);
  const content = await fs.readFile(filePath, 'utf-8');
  const metadata = parseFrontmatter(content);

  return {
    id: metadata.id || file.replace('.md', ''),
    title: metadata.title || 'Untitled',
    // ...
  };
});

const tasks = await Promise.all(taskPromises);
```

#### 3.2. Frontmatter 파싱 최적화
**파일**: `taskHandlers.ts:34-49`

**문제:**
정규식 매칭이 비효율적입니다.

**개선 방안:**
```typescript
// YAML 파서 라이브러리 사용
import yaml from 'js-yaml';

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  try {
    return yaml.load(match[1]) as Record<string, string>;
  } catch (error) {
    console.error('Failed to parse YAML frontmatter:', error);
    return {};
  }
}
```

### 4. 접근성 개선

#### 4.1. 키보드 내비게이션
**파일**: `TasksPage.tsx:230-237`

**현재 구현:**
- Enter/Space만 지원
- 화살표 키 미지원

**개선 방안:**
```typescript
const handleKeyDown = (e: React.KeyboardEvent, taskId: string, index: number) => {
  switch (e.key) {
    case 'Enter':
    case ' ':
      e.preventDefault();
      handleTaskClick(taskId);
      break;
    case 'ArrowDown':
      e.preventDefault();
      focusNextTask(index);
      break;
    case 'ArrowUp':
      e.preventDefault();
      focusPreviousTask(index);
      break;
    case 'Delete':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleDelete(taskId);
      }
      break;
  }
};
```

#### 4.2. ARIA 속성 추가
**파일**: `TasksPage.tsx:226-238`

**개선 방안:**
```tsx
<div
  key={task.id}
  className={`${styles.taskItem} ${selectedTaskId === task.id ? styles.selected : ''}`}
  onClick={() => handleTaskClick(task.id)}
  onKeyPress={handleKeyPress}
  role="button"
  tabIndex={0}
  aria-label={`Task: ${task.title}`}
  aria-pressed={selectedTaskId === task.id}
  aria-describedby={`task-status-${task.id}`}
>
  {/* ... */}
  <span
    id={`task-status-${task.id}`}
    className={`${styles.taskStatus} ${styles[task.status]}`}
  >
    {task.status}
  </span>
</div>
```

---

## 버그 및 이슈

### 🐛 버그 1: Created 타임스탬프 오버라이드
**파일**: `TasksPage.tsx:121`

**문제:**
```typescript
created: isCreating ? now : parseTaskMarkdown(taskContent).created,
```
수정 시 `taskContent`가 빈 문자열일 수 있어 파싱 실패 가능성

**재현:**
1. 새 작업 생성
2. 저장 없이 편집 모드 진입
3. 저장 시도 → 파싱 에러

**해결 방안:**
```typescript
const task: Task = {
  id: selectedTaskId,
  title,
  area,
  assigned_agent: assignedAgent,
  reviewer,
  status,
  created: isCreating ? now : (parseTaskMarkdown(taskContent).created || now),
  updated: now,
  references,
  successCriteria,
  description,
};
```

### 🐛 버그 2: References URL 필터링
**파일**: `taskParser.ts:36-39`

**문제:**
URL과 파일 경로를 구분하지 않고 모두 references에 포함

**영향:**
- Execute 시 URL을 파일로 읽으려 시도할 수 있음
- 컨텍스트 구성 시 혼란

**해결 방안:**
```typescript
// Task 타입 확장
interface Task {
  // ...
  references: string[];      // 파일 경로만
  externalLinks: string[];   // URL만
}

// 파싱 시 구분
const referencesMatch = body.match(/## References\n([\s\S]*?)(?=\n## |$)/);
if (referencesMatch) {
  const lines = referencesMatch[1]
    .split('\n')
    .filter((line) => line.trim().startsWith('-'))
    .map((line) => line.trim().substring(1).trim());

  sections.references = lines.filter(line => !line.startsWith('http'));
  sections.externalLinks = lines.filter(line => line.startsWith('http'));
}
```

### ⚠️ 이슈 1: 대용량 파일 처리
**파일**: `taskHandlers.ts:66`

**문제:**
모든 파일을 메모리에 로드하여 대용량 Task 목록 시 성능 저하

**영향:**
- 100개 이상의 Task 파일 시 UI 느려짐
- 메모리 사용량 증가

**해결 방안:**
1. **페이지네이션 구현**
```typescript
router.handle<{ projectPath: string; page: number; limit: number }, TaskListItem[]>(
  'listTasks',
  async ({ projectPath, page = 1, limit = 20 }) => {
    const allTasks = await loadAllTasks(projectPath);
    const start = (page - 1) * limit;
    const end = start + limit;
    return allTasks.slice(start, end);
  }
);
```

2. **가상 스크롤링**
```tsx
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={tasks.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <TaskItem task={tasks[index]} />
    </div>
  )}
</FixedSizeList>
```

### ⚠️ 이슈 2: 동시 편집 방지
**파일**: `TasksPage.tsx:103-148`

**문제:**
여러 창에서 동일한 Task를 동시에 편집하면 나중에 저장한 것이 이전 변경을 덮어씀

**해결 방안:**
```typescript
// 파일 수정 시간 체크
const handleSave = async () => {
  const currentFileContent = await window.taskAPI.getTask(projectPath, selectedTaskId);
  const currentTask = parseTaskMarkdown(currentFileContent);

  if (currentTask.updated > task.updated) {
    const confirm = window.confirm(
      'This task has been modified by another process. Overwrite?'
    );
    if (!confirm) return;
  }

  // 저장 진행...
};
```

---

## 다음 단계

### 우선순위 1: Execute 통합 (핵심)
**예상 작업량**: 3-5일

**작업 항목:**
1. [ ] ExecutionsPage에 Task 선택 드롭다운 추가
2. [ ] Task → Claude CLI 명령어 변환 로직 구현
3. [ ] References 파일 자동 로드 메커니즘
4. [ ] Area 기반 권한 필터 적용
5. [ ] Execute 결과와 Task 연동 (상태 자동 업데이트)

**구현 파일:**
- `src/pages/ExecutionsPage.tsx` (UI)
- `src/services/TaskExecutor.ts` (새 파일, 변환 로직)
- `src/services/ProcessManager.ts` (통합)

### 우선순위 2: 진행률 추적
**예상 작업량**: 1-2일

**작업 항목:**
1. [ ] Success Criteria 데이터 구조 변경 (string[] → object[])
2. [ ] 체크박스 UI 구현
3. [ ] 진행률 계산 로직 (완료/전체)
4. [ ] 작업 목록에 진행률 표시 (프로그레스 바)

**구현 파일:**
- `src/types/task.ts` (타입 확장)
- `src/pages/TasksPage.tsx` (UI 업데이트)
- `src/lib/taskParser.ts` (파싱 로직 수정)

### 우선순위 3: UI/UX 개선
**예상 작업량**: 2-3일

**작업 항목:**
1. [ ] 작업 목록 레이아웃 개선 (아이콘, 가로 배치)
2. [ ] 편집 폼 2열 레이아웃
3. [ ] Markdown 미리보기 렌더링
4. [ ] 검색 및 필터 기능
5. [ ] 키보드 단축키 강화

**구현 파일:**
- `src/pages/TasksPage.tsx`
- `src/pages/TasksPage.module.css`
- `src/components/task/TaskSearch.tsx` (새 파일)

### 우선순위 4: 버그 수정
**예상 작업량**: 1일

**작업 항목:**
1. [ ] Created 타임스탬프 오버라이드 버그 수정
2. [ ] References URL/파일 구분 로직
3. [ ] 동시 편집 감지 및 경고

**구현 파일:**
- `src/lib/taskParser.ts`
- `src/pages/TasksPage.tsx`

### 우선순위 5: 성능 최적화
**예상 작업량**: 1-2일

**작업 항목:**
1. [ ] 병렬 파일 읽기
2. [ ] YAML 파서 라이브러리 도입
3. [ ] 가상 스크롤링 (react-window)
4. [ ] 캐싱 전략

**구현 파일:**
- `src/ipc/handlers/taskHandlers.ts`
- `src/pages/TasksPage.tsx`

---

## 결론

Tasks 기능은 **기본 CRUD 작업과 UI는 완전히 구현**되었으나, **핵심 목적인 Execute 통합이 누락**되어 있습니다. 현재 상태로는 독립적인 작업 관리 도구로만 기능하며, 컨텍스트 최적화라는 본래 목표를 달성하지 못하고 있습니다.

**주요 성과:**
- ✅ 안정적인 파일 시스템 작업
- ✅ 완전한 CRUD API
- ✅ 직관적인 2단 레이아웃 UI
- ✅ 통합 컴포넌트 (WorkAreaSelector, AgentSelector)

**개선 필요:**
- 🔴 Execute 통합 (최우선)
- 🟠 진행률 추적
- 🟡 검색 및 필터
- 🟢 성능 최적화

**다음 단계:**
Execute 통합을 최우선으로 진행하여 Tasks → Execute 워크플로우를 완성하고, 이후 진행률 추적 및 UI/UX 개선을 순차적으로 진행할 것을 권장합니다.
