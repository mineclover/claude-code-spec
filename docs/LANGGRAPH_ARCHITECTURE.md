# LangGraph Integration Architecture

## 개요

LangGraph를 lifecycle 엔진으로 사용하고, 기존 Task 시스템을 별도로 관리하는 하이브리드 아키텍처.

## 아키텍처 레이어

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Renderer                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  React UI Components                                  │  │
│  │  - WorkflowPage (기존)                                │  │
│  │  - LangGraphVisualizerPage (신규)                     │  │
│  │  - TasksPage (기존)                                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕ IPC
┌─────────────────────────────────────────────────────────────┐
│                     Electron Main Process                    │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Task Management Layer (기존)                         │ │
│  │  - TaskManager: CRUD operations                       │ │
│  │  - AgentManager: Agent definitions                    │ │
│  │  - File-based storage (workflow/tasks/*.md)           │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  LangGraph Adapter Layer (신규)                       │ │
│  │  - TaskToGraphConverter: Task → Graph                 │ │
│  │  - GraphStateManager: State management                │ │
│  │  - CheckpointStore: Persistence                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  LangGraph Engine (신규)                              │ │
│  │  - StateGraph: Graph definition                       │ │
│  │  - Nodes: Claude execution nodes                      │ │
│  │  - Edges: Conditional routing                         │ │
│  │  - Checkpointer: State persistence                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Claude Adapter (신규)                                │ │
│  │  - ClaudeNode: LangGraph node wrapper                 │ │
│  │  - ProcessManager: Claude CLI execution (기존)       │ │
│  │  - AgentTracker: Execution tracking (기존)           │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Monitoring & Persistence                             │ │
│  │  - CentralDatabase (기존)                            │ │
│  │  - SessionAnalyzer (기존)                            │ │
│  │  - LangGraphStateStore (신규)                        │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 핵심 설계 원칙

### 1. Separation of Concerns
- **Task Management**: 파일 기반, 인간 친화적, CRUD 작업
- **Execution Engine**: LangGraph, 실행 흐름 및 상태 관리
- **Monitoring**: AgentTracker + CentralDatabase, 통합 모니터링

### 2. Gradual Integration
- 기존 WorkflowEngine과 병행 운영 가능
- LangGraph 기반 워크플로우를 점진적으로 추가
- 기존 시스템에 영향 없이 실험 가능

### 3. State-First Design
- LangGraph의 강력한 상태 관리 활용
- Checkpoint를 통한 중단/재개 지원
- 모든 상태 변경 추적 가능

## 컴포넌트 상세 설계

### 1. TaskToGraphConverter

Tasks를 LangGraph의 StateGraph로 변환합니다.

**입력**: Task[] (markdown 파일에서 로드)
**출력**: StateGraph 정의

**변환 로직**:
```typescript
interface GraphNode {
  id: string;           // task.id
  type: 'claude' | 'conditional' | 'human';
  config: {
    agent: string;      // task.assigned_agent
    prompt: string;     // task.description
    context: string[];  // task.references
  };
}

interface GraphEdge {
  from: string;
  to: string;
  condition?: (state: WorkflowState) => boolean;
}

class TaskToGraphConverter {
  convert(tasks: Task[]): StateGraph {
    // 1. Task 의존성 분석
    const dependencies = this.analyzeDependencies(tasks);

    // 2. Node 생성
    const nodes = tasks.map(task => this.createNode(task));

    // 3. Edge 생성 (의존성 기반)
    const edges = this.createEdges(dependencies);

    // 4. StateGraph 구성
    return this.buildStateGraph(nodes, edges);
  }
}
```

### 2. Claude Adapter

Claude CLI를 LangGraph Node로 래핑합니다.

```typescript
interface ClaudeNodeInput {
  sessionId: string;
  agent: string;
  prompt: string;
  context: string[];
  previousState?: any;
}

interface ClaudeNodeOutput {
  success: boolean;
  result?: any;
  error?: string;
  logs: string[];
}

class ClaudeNode {
  async execute(input: ClaudeNodeInput, state: WorkflowState): Promise<ClaudeNodeOutput> {
    // 1. AgentTracker에 실행 등록
    await this.agentTracker.registerExecution(input.sessionId, {
      taskId: state.currentTask,
      agentName: input.agent,
      projectPath: state.projectPath,
    });

    // 2. Claude CLI 실행
    const execution = await this.processManager.executeCommand({
      projectPath: state.projectPath,
      query: this.buildQuery(input),
      agent: input.agent,
    });

    // 3. 실행 모니터링
    execution.on('stream', (event) => {
      this.agentTracker.updateHeartbeat(input.sessionId);
      state.logs.push(event);
    });

    // 4. 결과 반환
    const result = await execution.wait();
    await this.agentTracker.updateStatus(input.sessionId,
      result.success ? 'completed' : 'failed'
    );

    return {
      success: result.success,
      result: result.output,
      logs: state.logs,
    };
  }
}
```

### 3. LangGraph StateGraph 정의

```typescript
interface WorkflowState {
  // Workflow metadata
  workflowId: string;
  projectPath: string;

  // Execution state
  currentTask: string;
  completedTasks: string[];
  failedTasks: string[];

  // Data flow
  context: Record<string, any>;
  results: Record<string, any>;

  // Monitoring
  logs: StreamEvent[];
  startTime: number;
  lastUpdateTime: number;
}

class LangGraphWorkflowEngine {
  buildGraph(tasks: Task[]): StateGraph<WorkflowState> {
    const graph = new StateGraph<WorkflowState>({
      channels: {
        workflowId: { value: (x, y) => y ?? x },
        currentTask: { value: (x, y) => y ?? x },
        completedTasks: { value: (x, y) => [...x, ...y] },
        context: { value: (x, y) => ({ ...x, ...y }) },
        results: { value: (x, y) => ({ ...x, ...y }) },
        logs: { value: (x, y) => [...x, ...y] },
      },
    });

    // Add nodes
    for (const task of tasks) {
      graph.addNode(task.id, async (state) => {
        const claudeNode = new ClaudeNode(
          this.processManager,
          this.agentTracker
        );

        const result = await claudeNode.execute({
          sessionId: `${state.workflowId}-${task.id}`,
          agent: task.assigned_agent,
          prompt: task.description,
          context: task.references || [],
        }, state);

        return {
          completedTasks: [task.id],
          results: { [task.id]: result },
          logs: result.logs,
        };
      });
    }

    // Add edges (based on dependencies)
    graph.addEdge('__start__', tasks[0].id);
    for (let i = 0; i < tasks.length - 1; i++) {
      graph.addEdge(tasks[i].id, tasks[i + 1].id);
    }
    graph.addEdge(tasks[tasks.length - 1].id, '__end__');

    return graph.compile({
      checkpointer: new MemorySaver(),
    });
  }
}
```

### 4. 시각화 컴포넌트

React Flow를 사용한 그래프 시각화:

```typescript
interface GraphVisualizerProps {
  workflowId: string;
  projectPath: string;
}

const LangGraphVisualizer: React.FC<GraphVisualizerProps> = ({
  workflowId,
  projectPath,
}) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [state, setState] = useState<WorkflowState | null>(null);

  useEffect(() => {
    // Load graph structure
    loadGraphStructure();

    // Subscribe to state updates
    const unsubscribe = window.langGraphAPI.subscribeToState(
      workflowId,
      (newState) => {
        setState(newState);
        updateNodeStyles(newState);
      }
    );

    return unsubscribe;
  }, [workflowId]);

  const updateNodeStyles = (state: WorkflowState) => {
    setNodes((nodes) =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          status: getNodeStatus(node.id, state),
        },
        style: {
          ...node.style,
          backgroundColor: getNodeColor(node.id, state),
        },
      }))
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.graphView}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={customNodeTypes}
          fitView
        >
          <Controls />
          <Background />
          <MiniMap />
        </ReactFlow>
      </div>

      <div className={styles.statePanel}>
        <h3>Current State</h3>
        <StateInspector state={state} />
      </div>

      <div className={styles.logsPanel}>
        <h3>Execution Logs</h3>
        <LogViewer logs={state?.logs || []} />
      </div>
    </div>
  );
};
```

## 데이터 흐름

### 1. Workflow 시작

```
User (UI)
  → IPC: startLangGraphWorkflow(projectPath, taskIds)
  → TaskManager: loadTasks(taskIds)
  → TaskToGraphConverter: convert(tasks)
  → LangGraphEngine: buildGraph(tasks)
  → LangGraphEngine: compile() & invoke()
  → ClaudeNode: execute()
  → ProcessManager: executeCommand()
  → AgentTracker: registerExecution()
```

### 2. 실시간 상태 업데이트

```
LangGraphEngine (state change)
  → GraphStateManager: updateState()
  → IPC Event: langgraph:state-update
  → React Component: setState()
  → ReactFlow: updateNodes()
```

### 3. Checkpoint & Resume

```
LangGraphEngine (checkpoint)
  → CheckpointStore: save(state)
  → LangGraphStateStore: persist()

Resume:
  → LangGraphStateStore: load(workflowId)
  → LangGraphEngine: resume(checkpoint)
  → Continue from last state
```

## 시각화 기능

### 1. Graph Structure View
- **Node 표시**: Task별 상태 (pending/running/completed/failed)
- **Edge 표시**: 의존성 관계 및 조건부 분기
- **Layout**: 계층적 또는 Force-directed layout

### 2. Real-time Execution State
- **현재 실행 중인 Node 하이라이트**
- **완료된 Node는 초록색**
- **실패한 Node는 빨간색**
- **Progress bar**: 전체 진행률

### 3. Data Flow Visualization
- **Node 클릭 시 입력/출력 표시**
- **State 변경 이력 타임라인**
- **Context 데이터 inspector**

### 4. Debugging Interface
- **각 Node의 실행 로그**
- **State snapshot at each step**
- **Replay 기능**: 이전 상태로 되돌리기
- **Breakpoint 설정**: 특정 Node에서 일시 중지

## 구현 계획

### Phase 1: 기본 LangGraph 통합 (1-2주)

**목표**: LangGraph 기본 구조 구축 및 단순 워크플로우 실행

**작업**:
1. LangGraph 의존성 추가 (`@langchain/langgraph`)
2. `LangGraphWorkflowEngine` 클래스 구현
3. `TaskToGraphConverter` 구현 (단순 순차 실행)
4. `ClaudeNode` 기본 구현
5. IPC 핸들러 추가 (`langgraph:start`, `langgraph:getState`)

**테스트**:
- 2-3개 Task를 순차적으로 실행하는 워크플로우
- 각 Task 완료 시 상태 업데이트 확인

### Phase 2: Claude Adapter & Monitoring (1주)

**목표**: Claude 실행과 기존 모니터링 시스템 통합

**작업**:
1. `ClaudeNode`에 AgentTracker 통합
2. Stream 이벤트를 LangGraph State로 매핑
3. CentralDatabase에 LangGraph 실행 기록
4. Checkpoint 메커니즘 구현

**테스트**:
- 실행 중단 후 재개 기능
- AgentTracker 대시보드에서 LangGraph 실행 확인

### Phase 3: 시각화 (2주)

**목표**: Graph 구조 및 실행 상태 시각화

**작업**:
1. React Flow 의존성 추가
2. `LangGraphVisualizerPage` 컴포넌트 구현
3. Graph 구조를 ReactFlow format으로 변환
4. 실시간 상태 업데이트 구독
5. StateInspector 및 LogViewer 컴포넌트

**테스트**:
- 복잡한 의존성 그래프 시각화
- 실행 중 실시간 업데이트 확인

### Phase 4: 고급 기능 (2-3주)

**목표**: 조건부 분기, Human-in-the-loop, 병렬 실행

**작업**:
1. 조건부 Edge 구현 (Task 결과에 따른 분기)
2. Human-in-the-loop Node (승인 대기)
3. 병렬 실행 지원 (독립적인 Task 동시 실행)
4. Retry 및 Error handling
5. 고급 시각화 (데이터 플로우, 디버깅)

**테스트**:
- 복잡한 워크플로우 시나리오
- 에러 발생 시 Retry 동작
- Human approval 흐름

## 기술 스택

### Backend (Main Process)
- **LangGraph**: `@langchain/langgraph` (^0.0.20)
- **LangChain Core**: `@langchain/core` (^0.1.0)
- **기존**: ProcessManager, AgentTracker, CentralDatabase

### Frontend (Renderer)
- **React Flow**: `reactflow` (^11.10.0) - Graph 시각화
- **기존**: React 19, TypeScript

### Storage
- **Checkpoint**: LangGraph MemorySaver (메모리)
- **Persistence**: 파일 기반 (JSON) - 추후 SQLite 고려

## 마이그레이션 전략

### 기존 시스템과의 병행 운영

```typescript
// WorkflowPage에서 엔진 선택
enum WorkflowEngineType {
  LEGACY = 'legacy',      // 기존 WorkflowEngine
  LANGGRAPH = 'langgraph', // 새로운 LangGraph
}

interface WorkflowConfig {
  engine: WorkflowEngineType;
  // ... other config
}

// 점진적 마이그레이션
if (config.engine === 'langgraph') {
  // Use LangGraph engine
  await langGraphEngine.start(tasks);
} else {
  // Use legacy engine
  await workflowEngine.start(tasks);
}
```

### 호환성 유지
- Task 파일 포맷 변경 없음
- Agent 정의 변경 없음
- 기존 API 유지
- 새로운 API는 별도 네임스페이스 (`langGraphAPI`)

## 성능 고려사항

### 1. State Size 관리
- 큰 데이터는 State에 직접 저장하지 않고 참조만 저장
- Logs는 별도 스토리지에 저장하고 State에는 요약만

### 2. Checkpoint 빈도
- 각 Node 완료 시 자동 checkpoint
- 대용량 워크플로우는 선택적 checkpoint

### 3. IPC 최적화
- State 전체를 매번 전송하지 않고 변경된 부분만 전송
- Debounce 적용으로 과도한 업데이트 방지

## 확장 가능성

### 1. 다양한 Node 타입
- **Claude Node**: 기본
- **Tool Node**: MCP 서버 호출
- **Human Node**: 사용자 승인 대기
- **Conditional Node**: 분기 로직
- **Parallel Node**: 병렬 실행

### 2. 외부 시스템 연동
- **Webhook**: 워크플로우 이벤트 외부 전송
- **API**: 외부 API 호출 Node
- **Database**: 직접 DB 쿼리 Node

### 3. 고급 패턴
- **Subgraph**: 재사용 가능한 워크플로우 컴포넌트
- **Dynamic Graph**: 실행 중 그래프 구조 변경
- **Multi-Agent**: 여러 Agent 간 협업

## 보안 고려사항

### 1. Checkpoint 암호화
- 민감한 데이터가 포함된 State는 암호화 저장

### 2. Agent 권한
- LangGraph 실행 시에도 Agent의 권한 설정 준수
- File access, Tool access 제한

### 3. IPC 보안
- Context isolation 유지
- Preload script를 통한 안전한 API 노출

## 다음 단계

1. **설계 검토**: 이 문서를 기반으로 추가 피드백 수집
2. **POC 구현**: Phase 1의 최소 기능 구현 및 테스트
3. **기술 검증**: LangGraph의 Electron 환경 호환성 확인
4. **상세 구현 계획**: 각 Phase별 세부 작업 분해

---

**작성일**: 2025-11-24
**작성자**: Claude (AI Assistant)
**버전**: 1.0.0
