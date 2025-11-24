# LangGraph POC Implementation Plan

## 목표

최소 기능으로 LangGraph를 통한 워크플로우 실행을 검증합니다.

**범위**:
- 2-3개 Task를 순차적으로 실행
- 기본 상태 관리 및 모니터링
- 간단한 UI 표시

**제외**:
- 복잡한 의존성 처리
- 조건부 분기
- 병렬 실행
- 고급 시각화

## 구현 단계

### Step 1: 환경 설정 및 의존성 추가

**작업**:
```bash
# LangGraph 의존성 추가
npm install @langchain/langgraph @langchain/core
```

**파일**:
- `package.json`: 의존성 추가
- `tsconfig.json`: 설정 확인

**검증**:
- `npm run build` 성공
- TypeScript 타입 체크 통과

### Step 2: 기본 LangGraph Engine 구현

**파일**: `src/services/LangGraphEngine.ts`

```typescript
import { StateGraph, Annotation, END } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';
import type { ProcessManager } from './ProcessManager';
import type { AgentTracker } from './AgentTracker';
import type { Task } from '../types/task';

// State 정의
const WorkflowStateAnnotation = Annotation.Root({
  workflowId: Annotation<string>,
  projectPath: Annotation<string>,
  currentTask: Annotation<string>,
  completedTasks: Annotation<string[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  results: Annotation<Record<string, any>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  logs: Annotation<string[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
});

type WorkflowState = typeof WorkflowStateAnnotation.State;

export class LangGraphEngine {
  private processManager: ProcessManager;
  private agentTracker: AgentTracker;
  private checkpointer = new MemorySaver();

  constructor(processManager: ProcessManager, agentTracker: AgentTracker) {
    this.processManager = processManager;
    this.agentTracker = agentTracker;
  }

  /**
   * Build a simple sequential graph from tasks
   */
  buildSimpleGraph(tasks: Task[]): CompiledStateGraph {
    const graph = new StateGraph(WorkflowStateAnnotation);

    // Add nodes for each task
    for (const task of tasks) {
      graph.addNode(task.id, async (state: WorkflowState) => {
        console.log(`Executing task: ${task.id}`);

        // Register execution
        const sessionId = `${state.workflowId}-${task.id}`;
        await this.agentTracker.registerExecution(sessionId, {
          taskId: task.id,
          agentName: task.assigned_agent,
          projectPath: state.projectPath,
        });

        try {
          // Execute Claude CLI
          const result = await this.executeClaudeTask(task, state);

          // Update tracker
          await this.agentTracker.updateStatus(sessionId, 'completed');

          return {
            completedTasks: [task.id],
            results: { [task.id]: result },
            logs: [`Task ${task.id} completed successfully`],
          };
        } catch (error) {
          await this.agentTracker.updateStatus(sessionId, 'failed');
          throw error;
        }
      });
    }

    // Add sequential edges
    if (tasks.length > 0) {
      graph.addEdge('__start__', tasks[0].id);
      for (let i = 0; i < tasks.length - 1; i++) {
        graph.addEdge(tasks[i].id, tasks[i + 1].id);
      }
      graph.addEdge(tasks[tasks.length - 1].id, END);
    }

    return graph.compile({ checkpointer: this.checkpointer });
  }

  /**
   * Execute a single Claude task
   */
  private async executeClaudeTask(task: Task, state: WorkflowState): Promise<any> {
    // Build query from task
    const query = this.buildQueryFromTask(task, state);

    // Execute via ProcessManager
    const execution = await this.processManager.executeCommand({
      projectPath: state.projectPath,
      query,
      sessionId: `${state.workflowId}-${task.id}`,
    });

    // Wait for completion
    return new Promise((resolve, reject) => {
      execution.on('complete', (result) => resolve(result));
      execution.on('error', (error) => reject(error));
    });
  }

  /**
   * Build query string from task
   */
  private buildQueryFromTask(task: Task, state: WorkflowState): string {
    let query = task.description;

    // Add context from previous results if available
    if (task.dependencies && task.dependencies.length > 0) {
      const prevResults = task.dependencies
        .map((depId) => state.results[depId])
        .filter(Boolean);

      if (prevResults.length > 0) {
        query += '\n\nPrevious results:\n';
        query += JSON.stringify(prevResults, null, 2);
      }
    }

    return query;
  }

  /**
   * Start workflow execution
   */
  async startWorkflow(
    workflowId: string,
    projectPath: string,
    tasks: Task[]
  ): Promise<WorkflowState> {
    const graph = this.buildSimpleGraph(tasks);

    const initialState: WorkflowState = {
      workflowId,
      projectPath,
      currentTask: tasks[0]?.id || '',
      completedTasks: [],
      results: {},
      logs: ['Workflow started'],
    };

    const config = {
      configurable: { thread_id: workflowId },
    };

    // Invoke graph
    const finalState = await graph.invoke(initialState, config);

    return finalState;
  }

  /**
   * Get current workflow state
   */
  async getWorkflowState(workflowId: string): Promise<WorkflowState | null> {
    const config = { configurable: { thread_id: workflowId } };
    const state = await this.checkpointer.get(config);
    return state?.channel_values as WorkflowState | null;
  }

  /**
   * Resume workflow from checkpoint
   */
  async resumeWorkflow(workflowId: string): Promise<WorkflowState> {
    // Get checkpoint
    const checkpoint = await this.checkpointer.get({
      configurable: { thread_id: workflowId },
    });

    if (!checkpoint) {
      throw new Error(`No checkpoint found for workflow: ${workflowId}`);
    }

    // Resume execution
    // ... implementation
    throw new Error('Not implemented yet');
  }
}
```

**검증**:
- TypeScript 컴파일 성공
- 단위 테스트 작성 및 통과

### Step 3: IPC 핸들러 추가

**파일**: `src/ipc/handlers/langGraphHandlers.ts`

```typescript
import { LangGraphEngine } from '../../services/LangGraphEngine';
import { getAgentTracker } from './agentTrackerHandlers';
import { processManager } from '@context-action/code-api';
import type { IpcRouter } from '../IpcRouter';
import type { Task } from '../../types/task';

let langGraphEngine: LangGraphEngine | null = null;

export function getLangGraphEngine(): LangGraphEngine {
  if (!langGraphEngine) {
    const agentTracker = getAgentTracker();
    langGraphEngine = new LangGraphEngine(processManager, agentTracker);
  }
  return langGraphEngine;
}

export function registerLangGraphHandlers(router: IpcRouter): void {
  // Start workflow
  router.handle(
    'startWorkflow',
    async ({
      workflowId,
      projectPath,
      tasks,
    }: {
      workflowId: string;
      projectPath: string;
      tasks: Task[];
    }) => {
      const engine = getLangGraphEngine();
      const finalState = await engine.startWorkflow(workflowId, projectPath, tasks);
      return { success: true, state: finalState };
    }
  );

  // Get workflow state
  router.handle('getWorkflowState', async (workflowId: string) => {
    const engine = getLangGraphEngine();
    const state = await engine.getWorkflowState(workflowId);
    return state;
  });

  // Resume workflow
  router.handle('resumeWorkflow', async (workflowId: string) => {
    const engine = getLangGraphEngine();
    const finalState = await engine.resumeWorkflow(workflowId);
    return { success: true, state: finalState };
  });
}
```

**파일**: `src/ipc/IpcRouter.ts` (수정)

```typescript
// Register LangGraph handlers
import { registerLangGraphHandlers } from './handlers/langGraphHandlers';

// In setupIpcHandlers():
registerLangGraphHandlers(router);
```

**검증**:
- IPC 핸들러 등록 확인
- Renderer에서 호출 가능 확인

### Step 4: Preload API 추가

**파일**: `src/preload/apis/langGraph.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import type { Task } from '../../types/task';

export interface LangGraphAPI {
  startWorkflow: (
    workflowId: string,
    projectPath: string,
    tasks: Task[]
  ) => Promise<{ success: boolean; state: any }>;
  getWorkflowState: (workflowId: string) => Promise<any>;
  resumeWorkflow: (workflowId: string) => Promise<{ success: boolean; state: any }>;
}

export function exposeLangGraphAPI(): void {
  const api: LangGraphAPI = {
    startWorkflow: (workflowId: string, projectPath: string, tasks: Task[]) =>
      ipcRenderer.invoke('langgraph:startWorkflow', { workflowId, projectPath, tasks }),

    getWorkflowState: (workflowId: string) =>
      ipcRenderer.invoke('langgraph:getWorkflowState', workflowId),

    resumeWorkflow: (workflowId: string) =>
      ipcRenderer.invoke('langgraph:resumeWorkflow', workflowId),
  };

  contextBridge.exposeInMainWorld('langGraphAPI', api);
}
```

**파일**: `src/preload.ts` (수정)

```typescript
import { exposeLangGraphAPI } from './preload/apis/langGraph';

// Expose APIs
exposeLangGraphAPI();
```

**파일**: `src/types/api/langGraph.ts`

```typescript
import type { LangGraphAPI } from '../../preload/apis/langGraph';

declare global {
  interface Window {
    langGraphAPI: LangGraphAPI;
  }
}

export {};
```

**검증**:
- `window.langGraphAPI` 접근 가능
- TypeScript 타입 체크 통과

### Step 5: 기본 UI 추가

**파일**: `src/pages/LangGraphTestPage.tsx`

```typescript
import { useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import type { Task } from '../types/task';
import styles from './LangGraphTestPage.module.css';

export const LangGraphTestPage: React.FC = () => {
  const { projectPath } = useProject();
  const [workflowId, setWorkflowId] = useState('');
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartTest = async () => {
    if (!projectPath) {
      alert('Please select a project first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create test tasks
      const testTasks: Task[] = [
        {
          id: 'task-001',
          title: 'Test Task 1',
          description: 'List files in src/ directory',
          assigned_agent: 'claude-sonnet-4',
          status: 'pending',
          area: 'Test',
        },
        {
          id: 'task-002',
          title: 'Test Task 2',
          description: 'Count TypeScript files',
          assigned_agent: 'claude-sonnet-4',
          status: 'pending',
          area: 'Test',
        },
      ];

      const wfId = `test-${Date.now()}`;
      setWorkflowId(wfId);

      const result = await window.langGraphAPI.startWorkflow(wfId, projectPath, testTasks);

      setState(result.state);
      alert('Workflow completed successfully!');
    } catch (err) {
      setError((err as Error).message);
      console.error('Workflow error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGetState = async () => {
    if (!workflowId) {
      alert('No workflow ID');
      return;
    }

    setLoading(true);
    try {
      const currentState = await window.langGraphAPI.getWorkflowState(workflowId);
      setState(currentState);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1>LangGraph POC Test</h1>

      <div className={styles.controls}>
        <button onClick={handleStartTest} disabled={loading || !projectPath}>
          {loading ? 'Running...' : 'Start Test Workflow'}
        </button>

        {workflowId && (
          <button onClick={handleGetState} disabled={loading}>
            Get Current State
          </button>
        )}
      </div>

      {error && (
        <div className={styles.error}>
          <h3>Error:</h3>
          <pre>{error}</pre>
        </div>
      )}

      {state && (
        <div className={styles.state}>
          <h3>Workflow State:</h3>
          <pre>{JSON.stringify(state, null, 2)}</pre>
        </div>
      )}

      {workflowId && (
        <div className={styles.info}>
          <strong>Workflow ID:</strong> {workflowId}
        </div>
      )}
    </div>
  );
};
```

**파일**: `src/pages/LangGraphTestPage.module.css`

```css
.container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.controls {
  display: flex;
  gap: 1rem;
  margin: 2rem 0;
}

.controls button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border-radius: 6px;
  border: none;
  background: #2563eb;
  color: white;
  cursor: pointer;
}

.controls button:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.error {
  margin: 2rem 0;
  padding: 1rem;
  background: #fee;
  border: 1px solid #f00;
  border-radius: 6px;
}

.state {
  margin: 2rem 0;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.state pre {
  overflow: auto;
  max-height: 400px;
}

.info {
  margin: 1rem 0;
  padding: 0.5rem;
  background: #e3f2fd;
  border-radius: 4px;
}
```

**파일**: `src/App.tsx` (수정)

```typescript
import { LangGraphTestPage } from './pages/LangGraphTestPage';

// In Routes:
<Route path="/langgraph-test" element={<LangGraphTestPage />} />
```

**파일**: `src/components/layout/Layout.tsx` (수정)

```typescript
// Add nav link
<Link
  to="/langgraph-test"
  className={`${styles.navItem} ${isActive('/langgraph-test') ? styles.active : ''}`}
>
  <span className={styles.icon}>🧪</span>
  <span>LangGraph Test</span>
</Link>
```

**검증**:
- UI에서 "LangGraph Test" 페이지 접근
- "Start Test Workflow" 버튼 클릭
- 워크플로우 실행 및 완료 확인
- State 표시 확인

### Step 6: 통합 테스트

**시나리오 1: 단순 순차 실행**
```
1. LangGraphTestPage 접근
2. "Start Test Workflow" 클릭
3. 2개 Task 순차 실행 확인
4. 최종 State 확인
5. AgentTracker에서 실행 기록 확인
6. CentralDashboard에서 프로젝트 통계 확인
```

**시나리오 2: 상태 조회**
```
1. 워크플로우 실행 후 Workflow ID 저장
2. "Get Current State" 클릭
3. State 정보 표시 확인
```

**시나리오 3: 에러 핸들링**
```
1. 잘못된 Task 설정으로 워크플로우 시작
2. 에러 메시지 표시 확인
3. AgentTracker에서 'failed' 상태 확인
```

## 예상 소요 시간

- **Step 1**: 30분 (의존성 추가, 빌드 확인)
- **Step 2**: 3-4시간 (LangGraphEngine 구현)
- **Step 3**: 1-2시간 (IPC 핸들러)
- **Step 4**: 1시간 (Preload API)
- **Step 5**: 2-3시간 (UI 구현)
- **Step 6**: 2시간 (통합 테스트 및 버그 수정)

**총 예상 시간**: 10-13시간 (약 1.5-2일)

## 성공 기준

✅ **필수**:
- LangGraph를 통한 2개 Task 순차 실행 성공
- 각 Task의 실행 상태 추적 가능
- UI에서 최종 State 확인 가능
- 기존 AgentTracker와 통합 동작

✅ **선택**:
- Checkpoint 저장 및 조회 가능
- 실행 중 에러 발생 시 적절한 에러 핸들링
- CentralDashboard에 LangGraph 실행 기록 표시

## 다음 단계

POC 성공 후:
1. **피드백 수집**: 설계 및 구현에 대한 검토
2. **Phase 2 진행**: Claude Adapter 고도화, Monitoring 강화
3. **Phase 3 진행**: React Flow 기반 시각화
4. **Phase 4 진행**: 고급 기능 (조건부 분기, 병렬 실행)

## 주의사항

### 1. LangGraph 버전 호환성
- `@langchain/langgraph`의 최신 API를 사용
- Breaking changes 주의

### 2. Electron 환경
- Node.js 모듈이므로 Main process에서만 사용
- Renderer에서는 IPC를 통해 접근

### 3. 기존 시스템 영향
- WorkflowEngine은 그대로 유지
- Task 파일 구조 변경 없음
- 점진적 마이그레이션 가능

---

**작성일**: 2025-11-24
**버전**: 1.0.0
