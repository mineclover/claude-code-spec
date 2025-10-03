# Executions Feature - Implementation Status & Tasks

## Overview

Executions 기능은 Claude CLI의 병렬 실행과 실시간 스트리밍을 지원하는 핵심 기능입니다. ProcessManager를 통해 여러 실행을 동시에 관리하고, 각 실행의 상태를 모니터링하며, 스트림 이벤트를 처리합니다.

**핵심 아키텍처:**
- **ProcessManager**: 병렬 실행 관리 (최대 10개)
- **ClaudeClient**: 개별 프로세스 실행 및 스트림 파싱
- **StreamParser**: JSONL 스트림 파싱 (line-by-line)
- **ExecutionsPage**: 실행 목록 및 제어
- **ExecutionDetailPage**: 개별 실행 상세 뷰

---

## 현재 구현 상태 ✅

### 1. 병렬 실행 시스템 ✅
- [x] **ProcessManager**: 여러 실행을 sessionId로 관리
- [x] **동시 실행 제한**: 최대 10개 병렬 실행 지원
- [x] **세션 ID 추출**: system:init 이벤트에서 sessionId 자동 추출
- [x] **실행 상태 관리**: pending → running → completed/failed/killed
- [x] **비동기 sessionId 처리**: Promise 기반 sessionId 대기

**구현 위치:**
- `/Users/junwoobang/project/claude-code-spec/src/services/ProcessManager.ts`
- sessionId는 system:init 이벤트에서 추출되며, 이후 모든 이벤트에 전파됨

### 2. 스트리밍 처리 ✅
- [x] **StreamParser**: 줄 단위 JSON 파싱
- [x] **ANSI 이스케이프 제거**: 터미널 제어 문자 제거
- [x] **불완전한 JSON 감지**: 중괄호/대괄호 매칭 검증
- [x] **버퍼 관리**: 불완전한 줄 보관 후 다음 청크와 결합
- [x] **에러 핸들링**: 파싱 실패 시 에러 콜백 호출

**구현 위치:**
- `/Users/junwoobang/project/claude-code-spec/src/lib/StreamParser.ts`
- `processChunk()`: 버퍼 기반 줄 단위 처리
- `parseLine()`: JSON 파싱 및 에러 검증

### 3. 이벤트 기반 업데이트 ✅
- [x] **실시간 이벤트 전파**: IPC를 통한 renderer 업데이트
- [x] **executions:updated**: ProcessManager 상태 변경 시 브로드캐스트
- [x] **claude:stream**: 개별 스트림 이벤트 전달 (sessionId 포함)
- [x] **claude:started/complete/error**: 프로세스 생명주기 이벤트

**구현 위치:**
- `/Users/junwoobang/project/claude-code-spec/src/ipc/handlers/claudeHandlers.ts`
- ProcessManager에 변경 리스너 등록
- BrowserWindow.getAllWindows()로 모든 창에 브로드캐스트

### 4. 프로세스 제어 ✅
- [x] **Kill Execution**: 개별 실행 종료
- [x] **Cleanup Execution**: 완료된 실행 제거
- [x] **Kill All**: 모든 활성 실행 일괄 종료
- [x] **Cleanup All**: 모든 완료 실행 일괄 제거
- [x] **상태별 필터링**: Active/All 토글

**구현 위치:**
- `/Users/junwoobang/project/claude-code-spec/src/components/execution/ExecutionsList.tsx`
- ProcessManager의 killExecution(), cleanupExecution() 메서드 활용

### 5. UI 컴포넌트 ✅
- [x] **ExecutionsList**: 실행 목록 (접기/펴기, 필터링)
- [x] **ExecutionDetailPage**: 개별 실행 상세 페이지
- [x] **StreamOutput**: 스트림 이벤트 렌더링
- [x] **실시간 스탯**: running/pending/completed/failed 카운트
- [x] **실행 시간**: startTime/endTime 기반 duration 표시

**구현 위치:**
- `/Users/junwoobang/project/claude-code-spec/src/pages/ExecutionsPage.tsx`
- `/Users/junwoobang/project/claude-code-spec/src/pages/ExecutionDetailPage.tsx`
- `/Users/junwoobang/project/claude-code-spec/src/components/execution/ExecutionsList.tsx`

### 6. 세션 이어가기 (Resume) ✅
- [x] **Recent Sessions**: 프로젝트별 최근 세션 목록
- [x] **Resume 버튼**: 선택한 세션 이어서 실행
- [x] **SessionManager 연동**: 세션 메타데이터 저장/로드
- [x] **페이지네이션**: 5개씩 세션 목록 표시
- [x] **캐싱**: 세션 목록 캐싱으로 빠른 로드

**구현 위치:**
- ExecutionsPage의 Recent Sessions 섹션
- `handleResumeSession()`: sessionId를 executeClaudeCommand에 전달
- ClaudeClient에서 `--resume` 플래그 자동 추가

---

## 검증 완료 항목 ✅

### 병렬 실행 검증
```typescript
// ExecutionsPage.tsx - Execute 버튼은 프로젝트 경로와 쿼리만 검사
<button
  onClick={handleExecute}
  disabled={!projectPath || !query}  // ✅ 실행 중 여부와 무관
>
  Execute
</button>
```

### 스트림 구독 검증
```typescript
// ExecutionDetailPage.tsx - useRef로 sessionId 추적, 한 번만 등록
useEffect(() => {
  currentSessionIdRef.current = sessionId || null;
}, [sessionId]);

useEffect(() => {
  const handleStream = (data: { sessionId: string; data: StreamEvent }) => {
    if (data.sessionId === currentSessionIdRef.current) {  // ✅ ref로 필터링
      setEvents((prev) => [...prev, data.data]);
    }
  };

  window.claudeAPI.onClaudeStream(handleStream);  // ✅ 한 번만 등록
}, []);  // ✅ 의존성 배열 비어있음
```

### ProcessManager 상태 관리 검증
```typescript
// ProcessManager.ts - 실행 생명주기
async startExecution(params: StartExecutionParams): Promise<string> {
  // 1. sessionId Promise 생성
  const sessionIdPromise = new Promise<string>(resolve => { resolveSessionId = resolve });

  // 2. system:init에서 sessionId 추출 시 resolve
  onStream: (event) => {
    if (isSystemInitEvent(event)) {
      resolveSessionId(event.session_id);  // ✅ Promise 해결
      this.executions.set(newSessionId, tempExecution);  // ✅ Map에 저장
      this.notifyExecutionsChanged();  // ✅ UI 업데이트
    }
  }

  // 3. sessionId 반환 (대기)
  return await sessionIdPromise;  // ✅ 비동기 대기
}
```

---

## 누락된 기능 ❌

### 1. 세션 히스토리 내비게이션 ❌
**문제:** ExecutionDetailPage에서 이전/다음 실행으로 이동 불가

**제안:**
```typescript
// ExecutionDetailPage.tsx에 추가
const navigateToAdjacent = (direction: 'prev' | 'next') => {
  const executions = getAllExecutions().sort((a, b) => b.startTime - a.startTime);
  const currentIndex = executions.findIndex(e => e.sessionId === sessionId);
  const targetIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex >= 0 && targetIndex < executions.length) {
    navigate(`/executions/${executions[targetIndex].sessionId}`);
  }
};
```

### 2. 실행 필터링/검색 ❌
**문제:** 실행이 많을 때 원하는 실행 찾기 어려움

**제안:**
- 프로젝트별 필터
- 상태별 필터 (현재는 Active/All만)
- 쿼리 텍스트 검색
- 날짜 범위 필터
- 모델별 필터 (sonnet/opus)

### 3. 실행 그룹화/태깅 ❌
**문제:** 관련된 실행들을 그룹으로 관리 불가

**제안:**
- 실행에 태그 추가 (feature, bugfix, experiment 등)
- 태그별 필터링
- 그룹명으로 묶기

### 4. 에러 복구 전략 ❌
**문제:** 실행 실패 시 자동 재시도나 복구 메커니즘 없음

**제안:**
- 실패한 실행 자동 재시도 옵션
- 에러 로그 상세 분석
- 실패 원인별 가이드

---

## 개선점 🔧

### 1. 프로세스 관리 강화

#### 1.1 좀비 프로세스 방지
**현재 상태:** 프로세스 종료 후 cleanup이 수동
```typescript
// ProcessManager.ts
killExecution(sessionId: string): void {
  execution.client.kill();
  execution.status = 'killed';
  execution.endTime = Date.now();
  // ❌ 프로세스 종료 확인 없음
}
```

**개선안:**
```typescript
async killExecution(sessionId: string): Promise<void> {
  execution.client.kill();

  // ✅ 프로세스 종료 대기
  await new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (!execution.client.isRunning()) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);

    // 5초 타임아웃
    setTimeout(() => {
      clearInterval(checkInterval);
      console.error('Process kill timeout');
      resolve();
    }, 5000);
  });

  execution.status = 'killed';
  execution.endTime = Date.now();
}
```

#### 1.2 프로세스 상태 검증
**문제:** pid가 있어도 실제 프로세스가 죽었을 수 있음

**개선안:**
```typescript
// ProcessManager에 추가
verifyProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);  // Signal 0은 프로세스 존재 확인만
    return true;
  } catch {
    return false;
  }
}

// 주기적 검증
setInterval(() => {
  for (const execution of this.getActiveExecutions()) {
    if (execution.pid && !this.verifyProcessAlive(execution.pid)) {
      execution.status = 'failed';
      execution.endTime = Date.now();
      this.notifyExecutionsChanged();
    }
  }
}, 30000);  // 30초마다
```

### 2. 스트림 파싱 개선

#### 2.1 대용량 스트림 처리
**문제:** 이벤트 배열이 무한정 증가
```typescript
// ProcessManager.ts - events 배열이 메모리 증가
execution.events.push(event);  // ❌ 제한 없음
```

**개선안:**
```typescript
// 순환 버퍼 구현
class CircularEventBuffer {
  private buffer: StreamEvent[] = [];
  private maxSize: number = 1000;
  private droppedCount: number = 0;

  push(event: StreamEvent): void {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
      this.droppedCount++;
    }
    this.buffer.push(event);
  }

  getAll(): StreamEvent[] {
    return [...this.buffer];
  }

  getStats(): { total: number; dropped: number } {
    return { total: this.buffer.length, dropped: this.droppedCount };
  }
}
```

#### 2.2 JSON 파싱 오류 처리 강화
**문제:** 불완전한 JSON 감지는 하지만 복구 시도 없음

**개선안:**
```typescript
// StreamParser.ts
private multiLineBuffer: string[] = [];

private parseLine(line: string): void {
  try {
    const event = JSON.parse(line);
    this.onEvent(event);
    this.multiLineBuffer = [];  // 성공 시 버퍼 초기화
  } catch (error) {
    // 여러 줄로 분리된 JSON일 수 있음
    this.multiLineBuffer.push(line);

    // 최대 5줄까지 시도
    if (this.multiLineBuffer.length <= 5) {
      const combined = this.multiLineBuffer.join('');
      try {
        const event = JSON.parse(combined);
        this.onEvent(event);
        this.multiLineBuffer = [];  // 성공 시 초기화
        return;
      } catch {
        // 계속 버퍼에 추가
      }
    } else {
      // 5줄 넘으면 포기하고 에러 처리
      this.onError?.(`Failed to parse multi-line JSON: ${this.multiLineBuffer[0]}`);
      this.multiLineBuffer = [];
    }
  }
}
```

### 3. UI/UX 개선

#### 3.1 실행 목록 가상화
**문제:** 실행이 많을 때 렌더링 성능 저하

**개선안:**
```typescript
// react-window 사용
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={displayedExecutions.length}
  itemSize={100}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <ExecutionItem execution={displayedExecutions[index]} />
    </div>
  )}
</FixedSizeList>
```

#### 3.2 실시간 토큰 사용량 표시
**문제:** ResultEvent에서만 토큰 정보 확인 가능

**개선안:**
```typescript
// ExecutionDetailPage에 추가
const [cumulativeTokens, setCumulativeTokens] = useState({
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheCreation: 0
});

useEffect(() => {
  const assistantEvents = events.filter(isAssistantEvent);
  const total = assistantEvents.reduce((acc, event) => ({
    input: acc.input + event.message.usage.input_tokens,
    output: acc.output + event.message.usage.output_tokens,
    cacheRead: acc.cacheRead + (event.message.usage.cache_read_input_tokens || 0),
    cacheCreation: acc.cacheCreation + (event.message.usage.cache_creation_input_tokens || 0),
  }), { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 });

  setCumulativeTokens(total);
}, [events]);
```

#### 3.3 실행 비교 뷰
**문제:** 여러 실행의 성능 비교 불가

**개선안:**
- 사이드바이사이드 비교 뷰
- 토큰 사용량 비교 차트
- 실행 시간 비교
- 동일 쿼리의 여러 실행 비교

### 4. 에러 처리 개선

#### 4.1 에러 카테고리화
**현재:** 모든 에러가 문자열로 처리
```typescript
errors: string[]  // ❌ 구조화되지 않음
```

**개선안:**
```typescript
interface ExecutionError {
  type: 'parse' | 'process' | 'network' | 'permission' | 'unknown';
  message: string;
  timestamp: number;
  recoverable: boolean;
  suggestions?: string[];
}

errors: ExecutionError[]
```

#### 4.2 에러 복구 가이드
```typescript
// ErrorRecoveryGuide.tsx
const getRecoverySuggestions = (error: ExecutionError): string[] => {
  switch (error.type) {
    case 'permission':
      return [
        'Check .claude/settings.json permissions',
        'Add required permission to allowedTools',
        'Use --dangerously-skip-permissions for testing'
      ];
    case 'network':
      return [
        'Check internet connection',
        'Verify API key is valid',
        'Check API rate limits'
      ];
    case 'process':
      return [
        'Check if Claude CLI is installed',
        'Verify project path exists',
        'Check disk space'
      ];
    default:
      return ['Review logs for more details'];
  }
};
```

### 5. 성능 최적화

#### 5.1 이벤트 디바운싱
**문제:** executions:updated가 너무 자주 발생

**개선안:**
```typescript
// ProcessManager.ts
private notifyDebounced = debounce(() => {
  if (this.executionsChangeListener) {
    this.executionsChangeListener();
  }
}, 100);

private notifyExecutionsChanged(): void {
  this.notifyDebounced();
}
```

#### 5.2 세션 목록 증분 로딩
**문제:** 페이지 변경 시 전체 세션 메타데이터 재로드

**개선안:**
```typescript
// ExecutionsPage.tsx
const [sessionsCache, setSessionsCache] = useState<Map<string, SessionWithMetadata>>(new Map());

const loadRecentSessions = async (page: number) => {
  const result = await window.claudeSessionsAPI.getProjectSessionsPaginated(
    projectPath,
    page,
    SESSIONS_PAGE_SIZE,
  );

  // 캐시에 없는 것만 메타데이터 로드
  const newSessions = result.sessions.filter(s => !sessionsCache.has(s.sessionId));
  const newMetadata = await Promise.all(
    newSessions.map(s => window.claudeSessionsAPI.getSessionMetadata(projectPath, s.sessionId))
  );

  // 캐시 업데이트
  const newCache = new Map(sessionsCache);
  newSessions.forEach((s, i) => {
    newCache.set(s.sessionId, { ...s, ...newMetadata[i] });
  });
  setSessionsCache(newCache);
};
```

---

## 버그 및 이슈 🐛

### 1. 메모리 누수 위험
**위치:** ExecutionDetailPage.tsx, ExecutionsPage.tsx

**문제:**
- 이벤트 리스너가 컴포넌트 언마운트 시 제거되지 않음
- events 배열이 무한정 증가

**해결:**
```typescript
useEffect(() => {
  const unsubscribe = window.claudeAPI.onClaudeStream(handleStream);

  return () => {
    if (unsubscribe) unsubscribe();  // ✅ cleanup
  };
}, []);
```

### 2. Race Condition
**위치:** ProcessManager.ts - startExecution()

**문제:**
- system:init 이벤트가 execute() 호출 전에 도착하면?
- sessionIdPromise가 영원히 resolve 안 될 수 있음

**현재 코드:**
```typescript
const process = client.execute(query);  // 비동기 spawn
// system:init이 이미 도착했을 수도...
const finalSessionId = await sessionIdPromise;  // ❌ 무한 대기 가능
```

**해결:**
```typescript
// 타임아웃 추가
const sessionIdPromise = new Promise<string>((resolve, reject) => {
  resolveSessionId = resolve;

  // 10초 타임아웃
  setTimeout(() => {
    reject(new Error('Timeout waiting for session ID from system:init'));
  }, 10000);
});

try {
  const finalSessionId = await sessionIdPromise;
  return finalSessionId;
} catch (error) {
  // 타임아웃 시 임시 ID 생성
  const tempId = `temp-${Date.now()}`;
  if (tempExecution) {
    tempExecution.sessionId = tempId;
    this.executions.set(tempId, tempExecution);
  }
  throw error;
}
```

### 3. 프로세스 고아화 (Orphaned Process)
**위치:** ClaudeClient.ts, ProcessManager.ts

**문제:**
- Electron 앱 종료 시 spawn된 프로세스가 계속 실행됨
- 사용자가 강제 종료하면 cleanup 안 됨

**해결:**
```typescript
// Main process에 추가
import { app } from 'electron';

app.on('before-quit', async (e) => {
  e.preventDefault();

  console.log('Cleaning up processes before quit...');

  // 모든 실행 종료
  processManager.killAll();

  // 프로세스 종료 대기 (최대 5초)
  await new Promise(resolve => setTimeout(resolve, 5000));

  app.exit(0);
});
```

### 4. IPC 직렬화 오류
**위치:** claudeHandlers.ts - get-execution

**문제:**
- ExecutionInfo에 ClaudeClient 객체가 포함됨
- ClaudeClient는 직렬화 불가 (ChildProcess 포함)

**현재 해결됨:** ✅
```typescript
router.handle('get-execution', async (_, sessionId: string) => {
  const execution = processManager.getExecution(sessionId);

  // ✅ client 제외하고 반환
  return {
    sessionId: execution.sessionId,
    projectPath: execution.projectPath,
    // ... client 제외
  };
});
```

---

## 다음 단계 (우선순위별) 📋

### P0 - 즉시 수정 필요
1. **메모리 누수 수정** (1-2시간)
   - 이벤트 리스너 cleanup 함수 추가
   - CircularEventBuffer 구현

2. **Race Condition 수정** (2-3시간)
   - sessionIdPromise 타임아웃 추가
   - 에러 처리 강화

3. **프로세스 고아화 방지** (1-2시간)
   - app.on('before-quit') 핸들러 추가
   - 프로세스 종료 확인 로직

### P1 - 안정성 개선 (1-2일)
4. **프로세스 상태 검증** (3-4시간)
   - pid 검증 로직 추가
   - 주기적 상태 체크

5. **에러 처리 개선** (4-5시간)
   - ExecutionError 타입 정의
   - 에러 카테고리화
   - 복구 가이드 UI

6. **JSON 파싱 강화** (2-3시간)
   - 멀티라인 JSON 처리
   - 복구 로직 추가

### P2 - 기능 추가 (3-5일)
7. **실행 필터링/검색** (1일)
   - 프로젝트별, 상태별, 날짜별 필터
   - 쿼리 텍스트 검색

8. **실시간 토큰 모니터링** (4-5시간)
   - 누적 토큰 계산
   - 실시간 차트

9. **세션 히스토리 내비게이션** (2-3시간)
   - 이전/다음 실행 이동
   - 키보드 단축키

### P3 - 성능 최적화 (2-3일)
10. **가상 스크롤링** (4-5시간)
    - react-window 적용
    - 대량 실행 목록 처리

11. **디바운싱/메모이제이션** (3-4시간)
    - 이벤트 업데이트 디바운싱
    - 컴포넌트 메모이제이션

12. **세션 캐싱 개선** (3-4시간)
    - 증분 로딩
    - 백그라운드 갱신

### P4 - 고급 기능 (1주일+)
13. **실행 비교 뷰** (2-3일)
    - 사이드바이사이드 비교
    - 성능 메트릭 차트

14. **실행 그룹화/태깅** (2-3일)
    - 태그 시스템
    - 그룹 관리

15. **자동 재시도** (1-2일)
    - 실패 시 재시도 정책
    - 백오프 전략

---

## 테스트 계획 🧪

### 단위 테스트
```typescript
// ProcessManager.test.ts
describe('ProcessManager', () => {
  it('should handle concurrent executions', async () => {
    const manager = new ProcessManager();
    const promises = Array.from({ length: 5 }, (_, i) =>
      manager.startExecution({
        projectPath: '/test',
        query: `query-${i}`,
      })
    );

    const sessionIds = await Promise.all(promises);
    expect(sessionIds).toHaveLength(5);
    expect(new Set(sessionIds).size).toBe(5);  // 모두 고유해야 함
  });

  it('should reject when max concurrent reached', async () => {
    const manager = new ProcessManager();
    manager.setMaxConcurrent(2);

    // 2개 실행
    await manager.startExecution({ projectPath: '/test', query: 'q1' });
    await manager.startExecution({ projectPath: '/test', query: 'q2' });

    // 3번째는 에러
    await expect(
      manager.startExecution({ projectPath: '/test', query: 'q3' })
    ).rejects.toThrow('Maximum concurrent executions');
  });
});
```

### 통합 테스트
```typescript
// Executions.integration.test.ts
describe('Executions Integration', () => {
  it('should complete full execution lifecycle', async () => {
    // 1. 실행 시작
    const result = await window.claudeAPI.executeClaudeCommand(
      '/test/project',
      'test query'
    );
    expect(result.success).toBe(true);
    const sessionId = result.sessionId!;

    // 2. 실행 정보 조회
    const execution = await window.claudeAPI.getExecution(sessionId);
    expect(execution.status).toBe('running');

    // 3. 스트림 이벤트 수신 대기
    await new Promise(resolve => {
      window.claudeAPI.onClaudeComplete((data) => {
        if (data.sessionId === sessionId) {
          resolve(data);
        }
      });
    });

    // 4. 완료 상태 확인
    const completed = await window.claudeAPI.getExecution(sessionId);
    expect(completed.status).toBe('completed');

    // 5. Cleanup
    await window.claudeAPI.cleanupExecution(sessionId);
    const cleaned = await window.claudeAPI.getExecution(sessionId);
    expect(cleaned).toBeNull();
  });
});
```

### E2E 테스트
```typescript
// Executions.e2e.test.ts (Playwright)
test('parallel executions', async ({ page }) => {
  await page.goto('/');

  // 프로젝트 선택
  await page.fill('#project-path', '/test/project');

  // 3개 실행 시작
  for (let i = 0; i < 3; i++) {
    await page.fill('#query', `Test query ${i}`);
    await page.click('button:has-text("Execute")');
    await page.waitForTimeout(500);
  }

  // 실행 목록 확인
  const executions = await page.locator('.execution-item').count();
  expect(executions).toBe(3);

  // 모두 running 상태
  const runningCount = await page.locator('.status-running').count();
  expect(runningCount).toBe(3);

  // Kill All
  await page.click('button:has-text("Kill All")');
  await page.waitForTimeout(1000);

  // 모두 killed 상태
  const killedCount = await page.locator('.status-killed').count();
  expect(killedCount).toBe(3);
});
```

---

## 참고 자료 📚

### 주요 파일
- ProcessManager: `/Users/junwoobang/project/claude-code-spec/src/services/ProcessManager.ts`
- ClaudeClient: `/Users/junwoobang/project/claude-code-spec/src/lib/ClaudeClient.ts`
- StreamParser: `/Users/junwoobang/project/claude-code-spec/src/lib/StreamParser.ts`
- IPC Handlers: `/Users/junwoobang/project/claude-code-spec/src/ipc/handlers/claudeHandlers.ts`
- ExecutionsPage: `/Users/junwoobang/project/claude-code-spec/src/pages/ExecutionsPage.tsx`
- ExecutionDetailPage: `/Users/junwoobang/project/claude-code-spec/src/pages/ExecutionDetailPage.tsx`

### 관련 커밋
- [27d2c37] fix: Implement proper parallel execution and stream subscription
- [42817bf] feat: Enhance execution monitoring UI with comprehensive controls
- [c9582e8] refactor: Replace polling with event-driven executions monitoring
- [9ee4e40] fix: Add missing 'claude:' prefix to ProcessManager IPC handlers

### 데이터 흐름
```
User Action (ExecutionsPage)
  ↓
IPC: claude:execute
  ↓
ProcessManager.startExecution()
  ↓
ClaudeClient.execute()
  ↓
spawn('claude', args)
  ↓
stdout → StreamParser → Events
  ↓
IPC: claude:stream (sessionId, event)
  ↓
ExecutionDetailPage (ref 필터링)
  ↓
StreamOutput 렌더링
```

### 상태 머신
```
pending → running → completed
                  → failed
                  → killed
```

---

## 결론 ✨

Executions 기능은 **병렬 실행, 실시간 스트리밍, 프로세스 제어**의 핵심 기능이 모두 구현되었습니다.

**강점:**
- ProcessManager의 깔끔한 추상화
- 이벤트 기반 아키텍처
- sessionId 기반 추적
- 풍부한 UI 컴포넌트

**개선 필요:**
- 메모리 누수 방지
- Race condition 처리
- 프로세스 고아화 방지
- 에러 처리 강화

P0~P1 작업을 완료하면 프로덕션 수준의 안정성을 확보할 수 있으며, P2~P4 작업으로 사용자 경험을 크게 향상시킬 수 있습니다.
