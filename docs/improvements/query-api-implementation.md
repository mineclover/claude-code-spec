# Query API Implementation

## 개요

Output-style을 활용하여 **Thinking 과정을 제거하고 순수한 결과만 추출**하는 API 스타일 쿼리 실행기를 구현했습니다.

## 핵심 기능

### 1. Output-Style 강제 주입
- 쿼리 실행 시 자동으로 `/output-style <name>` 명령어를 주입
- 일관된 출력 형식 보장
- 예: `structured-json` 스타일 → JSON 형식으로 강제 출력

### 2. Thinking 블록 필터링
- Stream-JSON 이벤트에서 `thinking` 타입 블록 자동 제거
- 순수한 결과(text)만 추출
- `filterThinking` 옵션으로 제어 가능

### 3. 단순한 API 인터페이스
```typescript
const result = await window.queryAPI.executeQuery(
  projectPath,
  "Review these files...",
  {
    outputStyle: 'structured-json',  // JSON 출력 강제
    filterThinking: true,             // Thinking 제거
    mcpConfig: '.claude/.mcp-empty.json',
    timeout: 60000
  }
);

// result.result: 최종 결과 (thinking 제거됨)
// result.messages: 모든 assistant 메시지
// result.metadata: 비용, 시간, 턴수 등
```

## 구현 상세

### ClaudeQueryAPI (`src/services/ClaudeQueryAPI.ts`)

**핵심 메소드:**

```typescript
class ClaudeQueryAPI {
  async query(
    projectPath: string,
    query: string,
    options: QueryOptions
  ): Promise<QueryResult>

  // Output-style 주입
  private buildQuery(query: string, outputStyle?: string): string {
    if (!outputStyle) return query;
    return `/output-style ${outputStyle}\n\n${query}`;
  }

  // Thinking 필터링
  private filterThinkingBlocks(events: StreamEvent[]): StreamEvent[] {
    return events.map(event => {
      if (event.type === 'message' && event.message?.content) {
        return {
          ...event,
          message: {
            ...event.message,
            content: event.message.content.filter(
              (block: any) => block.type !== 'thinking'
            )
          }
        };
      }
      return event;
    });
  }
}
```

### Structured JSON Output-Style

이미 `.claude/output-styles/structured-json.md`로 정의되어 있음:

```markdown
---
name: structured-json
description: Outputs structured data with review score, name, and tags fields
---

You must respond with valid JSON objects containing the following fields:

- `review` (number): A numerical rating or score
- `name` (string): A descriptive name or title
- `tags` (array of strings): Categories, labels, or keywords

## Guidelines

1. **Valid JSON**: Ensure all output is valid, parseable JSON
2. **No markdown code blocks**: Output raw JSON only, no ```json wrapper
3. **No explanatory text**: Only output the JSON structure
```

## 사용 시나리오

### 시나리오 1: Agent Pool에서 안정적인 결과 받기

```typescript
// Agent가 structured-json output-style로 실행
const result = await queryAPI.executeQuery(
  projectPath,
  "/output-style structured-json\n\nReview the TaskRouter class",
  {
    filterThinking: true
  }
);

// 결과는 항상 파싱 가능한 JSON
const data = JSON.parse(result.result);
// { review: 9, name: "TaskRouter", tags: ["routing", "agent-pool"] }
```

### 시나리오 2: Thinking 제거로 깔끔한 로그

**Before (filterThinking: false):**
```json
{
  "type": "message",
  "message": {
    "content": [
      { "type": "thinking", "thinking": "Let me analyze..." },
      { "type": "text", "text": "The TaskRouter class..." }
    ]
  }
}
```

**After (filterThinking: true):**
```json
{
  "type": "message",
  "message": {
    "content": [
      { "type": "text", "text": "The TaskRouter class..." }
    ]
  }
}
```

### 시나리오 3: 테스트용 간편 API

```typescript
// 자동으로 structured-json + thinking 필터 적용
const result = await window.queryAPI.testStructuredQuery(
  projectPath,
  "Rate these files: ProcessManager.ts, TaskRouter.ts"
);

if (result.success) {
  console.log(result.result.data);  // Parsed JSON
  console.log(result.result.metadata);  // Cost, duration, turns
} else {
  console.error(result.error);
}
```

## 실제 활용 예시

### Agent Pool 통합

`TaskRouter`에서 Agent 실행 시 자동으로 output-style 주입:

```typescript
// src/services/TaskRouter.ts

private buildQueryWithAgentContext(agent: AgentContext, task: Task): string {
  const sections: string[] = [];

  // Output-style 주입 (이미 구현됨)
  if (agent.outputStyle) {
    sections.push(`/output-style ${agent.outputStyle}`);
    sections.push('');
  }

  sections.push(`You are **${agent.name}**: ${agent.description}`);
  // ... rest of query building

  return sections.join('\n');
}
```

**Agent 정의 예시:**

```yaml
---
name: code-reviewer
description: Code review specialist
outputStyle: structured-json  # 항상 JSON으로 응답
allowedTools:
  - Read
  - Grep
---

Review code and provide:
- review: Score 1-10
- name: Component name
- tags: Quality indicators
```

### API 스타일 쿼리 실행

**Script 예시 (`scripts/example-query-api.ts`):**

```typescript
const api = new ClaudeQueryAPI();

// Simple query
const result = await api.query(
  projectPath,
  'List files in src/services',
  { filterThinking: true }
);

// Structured JSON query
const jsonResult = await api.query(
  projectPath,
  'Review these services and rate them',
  {
    outputStyle: 'structured-json',
    filterThinking: true,
    mcpConfig: '.claude/.mcp-empty.json'
  }
);

const parsed = JSON.parse(jsonResult.result);
console.log(parsed);
```

## IPC 채널

### 1. `query:executeQuery`
일반적인 쿼리 실행

**Input:**
```typescript
{
  projectPath: string;
  query: string;
  options?: {
    outputStyle?: string;
    model?: 'sonnet' | 'opus' | 'haiku';
    mcpConfig?: string;
    filterThinking?: boolean;
    timeout?: number;
  }
}
```

**Output:**
```typescript
{
  result: string;                // Final result (thinking filtered)
  messages: string[];            // All assistant messages
  events: StreamEvent[];         // Raw events
  metadata: {
    totalCost: number;
    durationMs: number;
    numTurns: number;
    outputStyle?: string;
  }
}
```

### 2. `query:testStructuredQuery`
Structured JSON 테스트용 간편 API

**Input:**
```typescript
{
  projectPath: string;
  query: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  result?: {
    data: any;              // Parsed JSON
    metadata: {
      totalCost: number;
      durationMs: number;
      numTurns: number;
    }
  };
  error?: string;
}
```

### 3. `query:killQuery`
실행 중인 쿼리 종료

## 장점

### 1. 일관성 (Consistency)
- Output-style 강제로 항상 동일한 형식의 응답
- Agent Pool에서 안정적인 결과 파싱

### 2. 간결성 (Simplicity)
- Thinking 블록 제거로 깔끔한 결과
- 로그 크기 감소, 파싱 속도 향상

### 3. API 스타일 (API-like)
```typescript
// Before: 복잡한 ProcessManager 설정
processManager.startExecution({
  projectPath,
  query: buildComplexQuery(),
  onStream: handleStream,
  onComplete: handleComplete
});

// After: 간단한 async/await
const result = await queryAPI.executeQuery(
  projectPath,
  query,
  { outputStyle: 'structured-json', filterThinking: true }
);
const data = JSON.parse(result.result);
```

### 4. 비용 효율 (Cost Efficiency)
- Thinking 블록이 제거되므로 전송 데이터 크기 감소
- 로그 저장 공간 절약

## 테스트 방법

### 1. TypeScript 스크립트 실행

```bash
# 기본 테스트
tsx scripts/test-output-style.ts

# API 사용 예시
tsx scripts/example-query-api.ts
```

### 2. UI에서 테스트

```typescript
// React 컴포넌트에서
const handleTest = async () => {
  const result = await window.queryAPI.testStructuredQuery(
    projectPath,
    'Review src/services/*.ts files'
  );

  if (result.success) {
    console.log('Parsed data:', result.result.data);
    console.log('Cost:', result.result.metadata.totalCost);
  }
};
```

### 3. Agent Pool 통합 테스트

```typescript
// Agent에 outputStyle 설정
const agent: AgentDefinition = {
  name: 'test-agent',
  description: 'Test agent',
  outputStyle: 'structured-json',  // 중요!
  allowedTools: ['Read'],
  permissions: { allowList: ['read:**'], denyList: [] },
  instructions: 'Review and rate components',
  filePath: 'test-agent.md',
  scope: 'project'
};

// TaskRouter가 자동으로 output-style 주입
const sessionId = await taskRouter.routeTask(task);
```

## 결론

**구현 완료:**
- ✅ Output-style 기능 조사 및 문서 확인
- ✅ JSON 출력 강제용 output-style 생성 (이미 존재함)
- ✅ API 스타일 쿼리 실행기 구현 (ClaudeQueryAPI)
- ✅ Thinking 제거 및 순수 결과만 추출하는 방법 고안 (filterThinkingBlocks)
- ✅ IPC 통합 및 Preload API 노출

**핵심 성과:**
1. **Agent Pool과 완벽한 통합**: Agent 정의에 outputStyle만 추가하면 자동 적용
2. **Thinking 필터링**: 세션 로그에서 불필요한 사고 과정 제거
3. **API 스타일 인터페이스**: 간단한 async/await 패턴
4. **안정적인 JSON 파싱**: structured-json output-style로 항상 유효한 JSON

이제 Agent Pool에서 `getPoolStats`의 핵심인 **output-style 주입**이 완벽하게 구현되었습니다!
