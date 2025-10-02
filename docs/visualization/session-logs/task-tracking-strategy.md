# Task 추적 전략: 프롬프트 메타데이터 기반

## 문제 정의

Claude CLI는 병렬 Task 실행 시 Task와 Sidechain을 연결하는 명시적 필드(`triggering_tool_use_id`)를 제공하지 않음.

**증명된 문제점**:
- 10개 병렬 Task 실행 시 모든 Sidechain이 동일한 timestamp
- 동일한 prompt로 구분 불가능
- `tool_id`와 Sidechain 간 연결 고리 부재

## 해결 방안: 프롬프트 메타데이터 기반 추적

### 1. Task 식별자 임베딩 패턴

```typescript
interface TaskMetadata {
  taskId: string;          // 고유 ID (UUID 짧은 버전)
  description: string;     // Task 설명
  index?: number;          // 병렬 실행 시 순번
  timestamp: string;       // 생성 시각
}

function createTrackedPrompt(metadata: TaskMetadata, actualPrompt: string): string {
  return `[TASK_META]
Task-ID: ${metadata.taskId}
Description: ${metadata.description}
${metadata.index !== undefined ? `Index: ${metadata.index}` : ''}
Timestamp: ${metadata.timestamp}
[/TASK_META]

${actualPrompt}`;
}
```

**예시**:
```
[TASK_META]
Task-ID: a7f3c92e
Description: Create random md file 1
Index: 1
Timestamp: 2025-10-02T12:44:39.858Z
[/TASK_META]

Create a markdown file with a random 5-character title and 10 random characters as content...
```

### 2. 체크포인트 보고 체계

Task 내부에서 주요 단계마다 체크포인트 보고:

```typescript
const CHECKPOINT_SYSTEM = `
**Important**: Report progress using this exact format:

[CHECKPOINT]
Task-ID: {task_id}
Stage: {stage_name}
Status: {started|completed|failed}
[/CHECKPOINT]

Report checkpoints at these stages:
1. Task Start: Stage="initialization", Status="started"
2. Main Action: Stage="execution", Status="started/completed"
3. Task Complete: Stage="finalization", Status="completed"
`;

function createPromptWithCheckpoints(metadata: TaskMetadata, prompt: string): string {
  return `[TASK_META]
Task-ID: ${metadata.taskId}
Description: ${metadata.description}
[/TASK_META]

${CHECKPOINT_SYSTEM}

${prompt}`;
}
```

**Sidechain에서 예상되는 응답**:
```
[CHECKPOINT]
Task-ID: a7f3c92e
Stage: initialization
Status: started
[/CHECKPOINT]

I'll create a markdown file with random content...

[CHECKPOINT]
Task-ID: a7f3c92e
Stage: execution
Status: started
[/CHECKPOINT]

[Tool: Write]

[CHECKPOINT]
Task-ID: a7f3c92e
Stage: finalization
Status: completed
[/CHECKPOINT]

Done! Created file xk9w3.md
```

### 3. 메타데이터 파싱 및 매칭

```typescript
// 메타데이터 파싱
function parseTaskMetadata(content: string): TaskMetadata | null {
  const metaRegex = /\[TASK_META\]([\s\S]*?)\[\/TASK_META\]/;
  const match = content.match(metaRegex);

  if (!match) return null;

  const metaBlock = match[1];
  const taskId = metaBlock.match(/Task-ID:\s*(.+)/)?.[1]?.trim();
  const description = metaBlock.match(/Description:\s*(.+)/)?.[1]?.trim();
  const index = metaBlock.match(/Index:\s*(\d+)/)?.[1];
  const timestamp = metaBlock.match(/Timestamp:\s*(.+)/)?.[1]?.trim();

  if (!taskId) return null;

  return {
    taskId,
    description: description || '',
    index: index ? parseInt(index) : undefined,
    timestamp: timestamp || ''
  };
}

// 체크포인트 파싱
interface Checkpoint {
  taskId: string;
  stage: string;
  status: 'started' | 'completed' | 'failed';
}

function parseCheckpoints(content: string): Checkpoint[] {
  const checkpointRegex = /\[CHECKPOINT\]([\s\S]*?)\[\/CHECKPOINT\]/g;
  const checkpoints: Checkpoint[] = [];

  let match;
  while ((match = checkpointRegex.exec(content)) !== null) {
    const block = match[1];
    const taskId = block.match(/Task-ID:\s*(.+)/)?.[1]?.trim();
    const stage = block.match(/Stage:\s*(.+)/)?.[1]?.trim();
    const status = block.match(/Status:\s*(.+)/)?.[1]?.trim() as Checkpoint['status'];

    if (taskId && stage && status) {
      checkpoints.push({ taskId, stage, status });
    }
  }

  return checkpoints;
}

// Task와 Sidechain 매칭
function matchTaskToSidechain(
  tasks: Array<{ uuid: string; metadata: TaskMetadata }>,
  sidechains: Array<{ uuid: string; content: string }>
): Map<string, string> {  // taskId -> sidechainUuid
  const mapping = new Map<string, string>();

  for (const sidechain of sidechains) {
    const metadata = parseTaskMetadata(sidechain.content);
    if (metadata) {
      mapping.set(metadata.taskId, sidechain.uuid);
    }
  }

  return mapping;
}
```

### 4. 애플리케이션 레벨 추적 보강

```typescript
// src/lib/TaskTracker.ts
export class TaskTracker {
  private tasks = new Map<string, {
    taskId: string;
    metadata: TaskMetadata;
    mainChainUuid: string;
    sidechainUuid?: string;
    checkpoints: Checkpoint[];
    status: 'pending' | 'running' | 'completed' | 'failed';
  }>();

  createTask(description: string, prompt: string, mainChainUuid: string): {
    taskId: string;
    trackedPrompt: string;
  } {
    const taskId = crypto.randomUUID().slice(0, 8);
    const metadata: TaskMetadata = {
      taskId,
      description,
      timestamp: new Date().toISOString()
    };

    this.tasks.set(taskId, {
      taskId,
      metadata,
      mainChainUuid,
      checkpoints: [],
      status: 'pending'
    });

    return {
      taskId,
      trackedPrompt: createPromptWithCheckpoints(metadata, prompt)
    };
  }

  linkSidechain(taskId: string, sidechainUuid: string) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.sidechainUuid = sidechainUuid;
      task.status = 'running';
    }
  }

  addCheckpoint(taskId: string, checkpoint: Checkpoint) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.checkpoints.push(checkpoint);

      if (checkpoint.stage === 'finalization' && checkpoint.status === 'completed') {
        task.status = 'completed';
      }
    }
  }

  getTaskBySidechainUuid(sidechainUuid: string) {
    for (const task of this.tasks.values()) {
      if (task.sidechainUuid === sidechainUuid) {
        return task;
      }
    }
    return null;
  }
}
```

### 5. Session Log 렌더링 시 활용

```typescript
// src/components/sessions/SessionLogViewer.tsx
function enrichEventsWithTaskMetadata(
  events: ClaudeSessionEntry[],
  tracker: TaskTracker
): EnrichedEvent[] {
  return events.map(event => {
    if (event.isSidechain) {
      // Sidechain 이벤트에서 메타데이터 파싱
      const metadata = parseTaskMetadata(event.message?.content || '');

      if (metadata) {
        return {
          ...event,
          _taskMetadata: metadata,
          _checkpoints: parseCheckpoints(event.message?.content || '')
        };
      }

      // 또는 tracker에서 조회
      const task = tracker.getTaskBySidechainUuid(event.uuid);
      if (task) {
        return {
          ...event,
          _taskMetadata: task.metadata,
          _checkpoints: task.checkpoints
        };
      }
    }

    return event;
  });
}
```

## 장단점

### 장점
- ✅ 100% 정확한 매칭 (taskId 기반)
- ✅ Claude CLI 수정 불필요
- ✅ 병렬 실행 완벽 지원
- ✅ 체크포인트로 진행 상황 추적 가능
- ✅ 디버깅 용이

### 단점
- ⚠️ Prompt에 메타데이터 추가 (토큰 증가)
- ⚠️ Sidechain에서 메타데이터 보고 필요 (협력 필요)
- ⚠️ 파싱 로직 추가 필요

## 구현 우선순위

### Phase 1: 기본 식별자 (즉시)
```typescript
prompt: `[TASK_ID: ${taskId}] ${actualPrompt}`
```

### Phase 2: 구조화된 메타데이터 (1주)
```typescript
[TASK_META]...[/TASK_META] 패턴 적용
```

### Phase 3: 체크포인트 시스템 (2주)
```typescript
[CHECKPOINT]...[/CHECKPOINT] 보고 체계
```

### Phase 4: 시각화 (3주)
- Session Log에서 Task 그룹핑
- 체크포인트 기반 진행률 표시
- Task 계층 구조 시각화

## 마이그레이션 경로

Claude CLI에 `triggering_tool_use_id` 추가 시:
1. 프롬프트 메타데이터는 선택사항으로 전환
2. 기존 로그는 파싱 로직으로 처리
3. 신규 로그는 필드 직접 사용
4. 점진적 마이그레이션

## 예시: 병렬 Task 추적

```typescript
// 10개 병렬 Task 생성
const tasks = Array.from({ length: 10 }, (_, i) => {
  const { taskId, trackedPrompt } = tracker.createTask(
    `Create random md file ${i + 1}`,
    `Create a markdown file with random content`,
    mainChainUuid
  );

  return { taskId, prompt: trackedPrompt };
});

// 실행
tasks.forEach(task => {
  claudeAPI.executeTask({
    description: `Task ${task.taskId}`,
    prompt: task.prompt
  });
});

// 로그에서 매칭
const sidechains = await readSidechainEvents(sessionId);
for (const sc of sidechains) {
  const metadata = parseTaskMetadata(sc.content);
  if (metadata) {
    tracker.linkSidechain(metadata.taskId, sc.uuid);
    console.log(`✅ Matched Task ${metadata.taskId} → Sidechain ${sc.uuid}`);
  }
}
```

---

## 결론

`triggering_tool_use_id`가 추가되기 전까지, **프롬프트 메타데이터 + 체크포인트 보고**가 가장 현실적이고 효과적인 추적 방법입니다.

- 간단한 구현 (Phase 1)으로 즉시 효과
- 점진적 개선 가능 (Phase 2-4)
- 미래 호환성 확보 (Claude CLI 개선 시 마이그레이션 용이)
