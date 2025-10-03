# Implementation Plan - Prioritized Roadmap

**Date**: 2025-10-04
**Based on**: Feature Documentation Review Summary

---

## 우선순위 개요

| 우선순위 | 작업 수 | 예상 기간 | 영향도 | 설명 |
|---------|--------|----------|--------|------|
| **P0** | 4 | 1-2일 | Critical | 보안 취약점, 크리티컬 버그 |
| **P1** | 4 | 2-3주 | High | 핵심 기능 (Execute 통합) |
| **P2** | 5 | 1주 | Medium | 문서, UX 개선 |
| **Future** | 48 | - | Low | 제거/보류된 over-engineered 기능 |

---

## P0: 즉시 수정 필요 (Critical)

### 🔴 P0-1: MCP Configs 보안 취약점
**파일**: `src/main/mcp-configs.ts`
**Issue**: `--dangerously-skip-permissions` 사용
**Impact**: 모든 보안 검사 우회, 악의적 MCP 서버 노출

**현재 코드**:
```typescript
// generateUsageScript()
const script = `claude --mcp-config "${configPath}" --dangerously-skip-permissions -p "query"`;
```

**수정 방안**:
```typescript
const script = `claude --mcp-config "${configPath}" --strict-mcp-config -p "query"`;
// .claude/settings.json의 permission patterns 사용
```

**작업 항목**:
- [ ] `generateUsageScript()` 함수 수정
- [ ] `--dangerously-skip-permissions` 플래그 제거
- [ ] `--strict-mcp-config` 플래그 추가
- [ ] 문서 업데이트 (사용법 변경)
- [ ] 테스트: 생성된 스크립트 실행 확인

**예상 시간**: 2시간
**담당 영역**: MCP Configs

---

### 🔴 P0-2: Executions 메모리 누수
**파일**: `src/pages/ExecutionDetailPage.tsx:42`
**Issue**: useEffect cleanup 함수 누락
**Impact**: 페이지 이동 시 메모리 누수 발생

**현재 코드**:
```typescript
useEffect(() => {
  const unsubscribe = window.claudeAPI.onStreamData(handleStreamData);
  // cleanup 함수 없음 - 메모리 누수!
}, []);
```

**수정 방안**:
```typescript
useEffect(() => {
  const unsubscribe = window.claudeAPI.onStreamData(handleStreamData);
  return () => unsubscribe(); // 추가
}, []);
```

**작업 항목**:
- [ ] useEffect에 cleanup 함수 추가
- [ ] 다른 useEffect 검토 (동일 패턴 있는지)
- [ ] 메모리 프로파일링 테스트 (DevTools)
- [ ] 여러 페이지 이동 시 메모리 사용량 확인

**예상 시간**: 1시간
**담당 영역**: Executions

---

### 🔴 P0-3: Executions 레이스 컨디션
**파일**: `src/main/ProcessManager.ts:95`
**Issue**: sessionId Promise가 무한 대기 가능
**Impact**: 실행이 무한정 멈출 수 있음

**문제 상황**:
```typescript
// system:init 이벤트가 리스너 등록 전에 발생하면?
this.sessionIdPromise = new Promise((resolve) => {
  // 이 resolve가 영원히 호출되지 않을 수 있음
});
```

**수정 방안 (Option 1 - 동기식 sessionId 생성)**:
```typescript
// sessionId를 미리 생성하고 system:init에서 검증만
private sessionId: string = crypto.randomUUID();

// system:init 이벤트 수신 시
onStreamData((event) => {
  if (event.type === 'system' && event.subtype === 'init') {
    // sessionId 일치 확인만
    if (event.session_id !== this.sessionId) {
      console.warn('SessionId mismatch!');
    }
  }
});
```

**수정 방안 (Option 2 - Timeout 추가)**:
```typescript
const sessionId = await Promise.race([
  this.sessionIdPromise,
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('SessionId timeout')), 5000)
  )
]);
```

**작업 항목**:
- [ ] 수정 방안 결정 (Option 1 추천 - 더 안전)
- [ ] ProcessManager.ts 리팩토링
- [ ] 에러 핸들링 추가
- [ ] 통합 테스트 (여러 실행 동시 시작)

**예상 시간**: 3-4시간
**담당 영역**: Executions

---

### 🔴 P0-4: Executions 고아 프로세스
**파일**: `src/main.ts`
**Issue**: 앱 종료 시 Claude CLI 프로세스 정리 안됨
**Impact**: 백그라운드에 프로세스 계속 실행

**수정 방안**:
```typescript
// src/main.ts
import { getProcessManager } from './services/ProcessManager';

app.on('will-quit', async (event) => {
  event.preventDefault(); // 정리 완료까지 종료 대기

  const processManager = getProcessManager();
  await processManager.killAllProcesses();

  app.exit(0);
});
```

**작업 항목**:
- [ ] ProcessManager에 `killAllProcesses()` 메서드 추가
- [ ] `app.on('will-quit')` 핸들러 구현
- [ ] 각 프로세스 graceful shutdown (SIGTERM → SIGKILL)
- [ ] 테스트: 앱 종료 시 프로세스 완전 정리 확인

**예상 시간**: 2-3시간
**담당 영역**: Executions, Main Process

---

**P0 총 예상 시간**: 8-10시간 (1-2일)

---

## P1: 핵심 기능 구현 (High Priority)

### 🟠 P1-1: Tasks Execute 통합
**현재 상태**: 0% (미구현)
**우선순위**: 최상위 - 프로젝트의 핵심 목적
**Impact**: Tasks가 단순 TODO 리스트에서 컨텍스트 최적화 도구로 전환

**목표**: Task를 선택하여 Claude CLI 실행 가능

**구현 범위**:
1. **Execute 버튼 추가** (TasksPage.tsx)
   ```typescript
   <button onClick={() => executeTask(selectedTask)}>
     Execute with Claude
   </button>
   ```

2. **Task → Claude 명령 변환**
   ```typescript
   // Task의 references, work area 기반으로 컨텍스트 구성
   const command = buildClaudeCommand({
     prompt: task.description,
     references: task.references, // 파일 경로들
     workArea: task.workArea,     // 컨텍스트 제한용
     agent: task.assignedAgent    // Agent 설정 적용
   });
   ```

3. **ProcessManager 통합**
   ```typescript
   const execution = await processManager.executeTask(task);
   // ExecutionDetailPage로 이동
   navigate(`/executions/${execution.sessionId}`);
   ```

4. **컨텍스트 최적화**
   - Work Area → 파일 패턴 매핑
   - References → `--include` 플래그
   - Description → `-p` 프롬프트

**작업 항목**:
- [ ] TasksPage에 Execute 버튼 추가
- [ ] `buildClaudeCommand()` 유틸리티 함수 작성
- [ ] ProcessManager에 `executeTask(task)` 메서드 추가
- [ ] Task execution → Execution 기록 연동
- [ ] 실행 중 Task 상태 업데이트 (pending → in_progress)
- [ ] 완료 시 Task 상태 업데이트 (completed/failed)
- [ ] 에러 핸들링 및 사용자 피드백
- [ ] Work Area context mapping 구현 (향후 확장 가능하게)

**예상 시간**: 2-3일 (16-24시간)
**담당 영역**: Tasks, Executions

---

### 🟠 P1-2: Agents Execute 통합
**현재 상태**: 0% (미구현)
**우선순위**: P1-1 직후
**Impact**: Agent 정의가 실제로 사용 가능해짐

**목표**: Task 실행 시 assigned Agent 설정 적용

**구현 범위**:
1. **Agent → Claude 플래그 변환**
   ```typescript
   const flags = buildAgentFlags(agent);
   // --allowed-tools Read,Write,Edit
   // --permission "read:src/**"
   // --mcp-config .claude/.mcp-dev.json
   ```

2. **TasksPage에서 Agent 활용**
   ```typescript
   if (task.assignedAgent) {
     const agent = await window.agentAPI.getAgent(task.assignedAgent);
     command.applyAgentSettings(agent);
   }
   ```

3. **Agent 검증**
   - Tool 권한 확인
   - Permission 패턴 검증
   - MCP 서버 활성화 확인

**작업 항목**:
- [ ] `buildAgentFlags()` 유틸리티 함수
- [ ] Tool Groups → `--allowed-tools` 변환
- [ ] Permissions → `--permission` 플래그들
- [ ] Agent validation (실행 전 확인)
- [ ] Agent presets 삭제 (deprecated)
- [ ] AgentsPage에서 "Test Agent" 버튼 (선택사항)

**예상 시간**: 1-2일 (8-16시간)
**담당 영역**: Agents, Tasks, Executions

---

### 🟠 P1-3: Memory Editor Region Pattern 버그
**파일**: `src/lib/MarkdownEditor.ts`
**Issue**: Region pattern에 공백 여부 불일치
**Impact**: Region relocation 실패 가능

**문제**:
```typescript
// 코드는 공백 없는 패턴 매칭
<!-- MEMORY_START:xyz -->

// 하지만 일부 문서는 공백 있음
<!-- MEMORY_START: xyz -->
```

**수정 방안**:
```typescript
// 정규식에서 공백 선택적으로 처리
const pattern = /<!-- MEMORY_START:\s*(\w+) -->/g;
//                                  ^^^ 공백 0개 이상
```

**작업 항목**:
- [ ] 정규식 패턴 수정 (공백 허용)
- [ ] 기존 문서들 스캔하여 패턴 통일 여부 확인
- [ ] 양쪽 패턴 모두 테스트
- [ ] 문서화 (표준 형식 명시)

**예상 시간**: 1-2시간
**담당 영역**: Memory Editor

---

### 🟠 P1-4: Memory Editor Item ID Collision
**파일**: `src/lib/MarkdownEditor.ts`
**Issue**: Item ID가 region 내에서만 유니크, 전역 충돌 가능
**Impact**: Cross-region item 링크 깨짐

**수정 방안**:
```typescript
// Option 1: Region prefix 추가
const itemId = `${regionName}-${itemName}`;
// "references-project-arch" 형식

// Option 2: Global uniqueness 검사
const allItemIds = new Set();
regions.forEach(region => {
  region.items.forEach(item => {
    if (allItemIds.has(item.id)) {
      throw new Error(`Duplicate item ID: ${item.id}`);
    }
    allItemIds.add(item.id);
  });
});
```

**작업 항목**:
- [ ] ID 생성 전략 결정
- [ ] Item ID validation 구현
- [ ] 기존 CLAUDE.md ID 충돌 검사
- [ ] 충돌 시 사용자 알림

**예상 시간**: 2-3시간
**담당 영역**: Memory Editor

---

**P1 총 예상 시간**: 2-3주

---

## P2: 문서 및 UX 개선 (Medium Priority)

### 🟡 P2-1: Tool Groups 단순화
**현재**: 7개 그룹 (all, read-only, edit, execution, mcp, task-management, other)
**목표**: 4-5개 그룹으로 단순화

**제안**:
1. **all** - 모든 도구 (특수 케이스)
2. **file-ops** - Read, Write, Edit, Grep, Glob (기존 read-only + edit 통합)
3. **execution** - Bash, TodoWrite, Task
4. **mcp** - serena, magic, playwright 등
5. **other** - NotebookEdit, SlashCommand, KillShell, BashOutput

**작업 항목**:
- [ ] `src/types/toolGroups.ts` 수정
- [ ] TOOL_GROUPS 재정의 (7개 → 5개)
- [ ] ToolSelector UI 업데이트
- [ ] 기존 Agent들의 allowedTools 마이그레이션 (선택사항)
- [ ] 문서 업데이트

**예상 시간**: 4시간
**담당 영역**: Agents

---

### 🟡 P2-2: 경량 Syntax Highlighting
**현재**: Plain textarea (MCP Configs, Memory Editor)
**목표**: Lightweight JSON/Markdown highlighting

**제안**: Prism.js 사용 (5KB, Monaco 대비 2MB+ 절약)

**구현**:
```typescript
import Prism from 'prismjs';
import 'prismjs/components/prism-json';

const highlighted = Prism.highlight(
  jsonContent,
  Prism.languages.json,
  'json'
);
```

**작업 항목**:
- [ ] Prism.js 패키지 추가
- [ ] MCP Configs: JSON highlighting
- [ ] Memory Editor: Markdown highlighting (JSON 모드)
- [ ] CSS 테마 적용
- [ ] 번들 사이즈 확인

**예상 시간**: 1일 (8시간)
**담당 영역**: MCP Configs, Memory Editor

---

### 🟡 P2-3: Agents 문서 정리
**작업**: deprecated presets.md 삭제 및 문서 통합

**작업 항목**:
- [ ] `docs/features/agents/presets.md` 삭제 (558줄)
- [ ] README.md에 중요 내용 통합 (필요시)
- [ ] Tool count 문서화 (81 → 94 수정)
- [ ] MCP server detection 상태 명시

**예상 시간**: 1-2시간
**담당 영역**: Docs

---

### 🟡 P2-4: Work Areas Context Mapping 설계
**현재**: Work Area 선택만 가능, 실제 context 제한 없음
**목표**: Future feature 설계 문서 작성

**작업 항목**:
- [ ] Work Area → File patterns 매핑 스키마 설계
- [ ] Context restriction 전략 문서화
- [ ] Execute 통합 시 구현 방안 명시
- [ ] tasks.md 업데이트

**예상 시간**: 2-3시간
**담당 영역**: Work Areas, Docs

---

### 🟡 P2-5: Over-engineering 정리
**작업**: 48개 over-engineered features를 Future Consideration으로 명확히 표시

**작업 항목**:
- [ ] 각 tasks.md에 "Future Consideration" 섹션 추가
- [ ] 제거/보류된 기능 목록 명시
- [ ] 우선순위 재조정 (P2 → Future)
- [ ] README 업데이트 (현재 scope 명확화)

**예상 시간**: 2-3시간
**담당 영역**: Docs

---

**P2 총 예상 시간**: 1주 (3-4일)

---

## 실행 순서

### Week 1: P0 + P1-1 시작
```
Day 1-2: P0 완료 (보안 + 버그 수정)
  - MCP security fix (2h)
  - Memory leak fix (1h)
  - Race condition fix (4h)
  - Orphaned processes (3h)

Day 3-5: P1-1 Tasks Execute 통합 시작
  - Execute 버튼 UI (4h)
  - buildClaudeCommand() (8h)
  - ProcessManager 통합 (8h)
```

### Week 2: P1-1 완료 + P1-2 시작
```
Day 6-8: P1-1 완료
  - Context optimization (8h)
  - 상태 업데이트 (4h)
  - 테스트 및 버그 수정 (8h)

Day 9-10: P1-2 Agents Execute 통합
  - buildAgentFlags() (8h)
  - Agent validation (4h)
```

### Week 3: P1-3, P1-4, P2
```
Day 11: P1-3, P1-4 (Memory Editor 버그)
  - Region pattern (2h)
  - Item ID collision (3h)

Day 12-15: P2 작업
  - Tool Groups 단순화 (4h)
  - Syntax highlighting (8h)
  - 문서 정리 (8h)
```

---

## 성공 지표

### P0 완료 후
- [ ] 보안 취약점 0개
- [ ] Critical 버그 0개
- [ ] 앱 종료 시 프로세스 완전 정리

### P1 완료 후
- [ ] Tasks에서 Execute 가능
- [ ] Agent 설정이 실제 적용됨
- [ ] Memory Editor 버그 0개
- [ ] 핵심 기능 100% 작동

### P2 완료 후
- [ ] 문서 일관성 100%
- [ ] Tool Groups 5개로 단순화
- [ ] JSON/Markdown highlighting 적용
- [ ] Over-engineered features 명확히 분리

---

## 제거/보류된 기능 (Future)

다음 48개 기능은 **현재 로드맵에서 제외**되었습니다:

### Tasks (8개)
- Templates, Virtual Scrolling, Concurrent Edits
- Search, Drag & Drop, Multi-Select
- Custom Fields, Dependencies

### Agents (7개)
- Permission Templates, Duplication, Import/Export
- History View, Advanced UI, Testing
- (Tool Groups는 단순화, 제거 아님)

### Executions (12개)
- Comparison View, Grouping, Circular Buffer
- Search, Re-run Mods, Templates
- Auto-retry, Scheduling, Collaboration
- CI/CD Export, Diff Viewer, Performance Monitoring

### Work Areas (6개)
- Statistics, Icons/Colors, Custom Areas
- Templates, Search, History

### MCP Configs (8개)
- Monaco Editor, Drag & Drop, Templates
- Visual Builder, Comparison, Statistics
- Import/Export, Testing

### Memory Editor (7개)
- Inline Editing, Drag & Drop, Search
- Undo/Redo, Monaco Editor, Live Preview
- Templates

---

## 다음 단계

1. **P0 즉시 시작** - 보안 취약점 및 크리티컬 버그
2. **P1 순차 진행** - Execute 통합 (핵심 가치)
3. **P2 병렬 가능** - 문서/UX 개선
4. **Future 재평가** - 사용자 피드백 수집 후 결정

이 계획은 **프로젝트의 핵심 가치 (Claude CLI 컨텍스트 최적화)**에 집중하고, over-engineering을 제거하며, 안정성을 우선시합니다.
