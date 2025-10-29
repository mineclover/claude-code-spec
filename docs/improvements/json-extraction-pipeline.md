# JSON Extraction Pipeline - 일반화된 프로세스

## 개요

Claude 응답에서 **순수한 JSON만 추출하는 완전히 일반화된 파이프라인**을 구현했습니다.

## 전체 프로세스

```
Raw Claude Output
      ↓
[1. Output-Style 강제]
      ↓
[2. Thinking 필터링]
      ↓
[3. Markdown 제거]
      ↓
[4. JSON 추출]
      ↓
[5. 유효성 검증]
      ↓
Clean JSON ✨
```

## 구현 구조

### 1. JSON 추출 유틸리티 (`src/lib/jsonExtractor.ts`)

**핵심 함수:**

```typescript
// 기본 JSON 추출
extractJSON<T>(text: string): JSONExtractionResult<T>

// 필드 검증 포함
extractAndValidate<T>(
  text: string,
  requiredFields: (keyof T)[]
): JSONExtractionResult<T>

// 여러 JSON 객체 추출
extractMultipleJSON<T>(text: string): JSONExtractionResult<T[]>
```

**처리 단계:**

```typescript
export function extractJSON<T>(text: string): JSONExtractionResult<T> {
  // Step 1: Markdown code block 제거
  let cleaned = removeMarkdownCodeBlocks(text);
  // ``` json ... ``` → raw JSON

  // Step 2: 직접 파싱 시도
  const directParse = tryParse<T>(cleaned);
  if (directParse.success) return directParse;

  // Step 3: 혼합 컨텐츠에서 JSON 추출
  const extracted = extractJSONFromMixedContent(cleaned);
  // "Here is the result: {...} Hope this helps!" → {...}

  // Step 4: 일반적인 오류 수정
  const fixed = tryCommonFixes(cleaned);
  // {"key": "value",} → {"key": "value"}
  // {key: "value"} → {"key": "value"}

  return result;
}
```

### 2. Enhanced ClaudeQueryAPI

**새 메소드:**

```typescript
class ClaudeQueryAPI {
  // 기본 쿼리
  async query(
    projectPath: string,
    query: string,
    options?: QueryOptions
  ): Promise<QueryResult>

  // JSON 자동 추출 ⭐
  async queryJSON<T>(
    projectPath: string,
    query: string,
    options?: {
      requiredFields?: (keyof T)[];
      model?: string;
      mcpConfig?: string;
      timeout?: number;
    }
  ): Promise<JSONExtractionResult<T>>

  // Type-safe JSON 쿼리 ⭐⭐
  async queryTypedJSON<T extends Record<string, any>>(
    projectPath: string,
    query: string,
    requiredFields: (keyof T)[],
    options?: QueryOptions
  ): Promise<JSONExtractionResult<T>>
}
```

### 3. Type-Safe 파서 (`src/types/query-types.ts`)

**공통 타입 정의:**

```typescript
// Review 결과
export interface ReviewResult {
  review: number;
  name: string;
  tags: string[];
}

// Agent 통계
export interface AgentStatsResult {
  agentName: string;
  status: 'idle' | 'busy';
  tasksCompleted: number;
  currentTask?: string;
  uptime: number;
  performance: {
    avgDuration: number;
    avgCost: number;
  };
}

// Code 분석
export interface CodeAnalysisResult {
  file: string;
  complexity: number;
  maintainability: number;
  issues: Array<{
    severity: 'low' | 'medium' | 'high';
    message: string;
    line?: number;
  }>;
  suggestions: string[];
}

// Type guards
export function isReviewResult(data: unknown): data is ReviewResult
export function isAgentStatsResult(data: unknown): data is AgentStatsResult
export function isCodeAnalysisResult(data: unknown): data is CodeAnalysisResult
```

## 사용 예시

### Level 1: 기본 사용

```typescript
const api = new ClaudeQueryAPI();

// 1. Raw 쿼리 실행
const result = await api.query(
  projectPath,
  "Review these files...",
  { outputStyle: 'structured-json', filterThinking: true }
);

// 2. 수동 JSON 추출
const extracted = extractJSON(result.result);

if (extracted.success) {
  console.log(extracted.data);  // Clean JSON
}
```

### Level 2: 자동 추출

```typescript
// queryJSON: 자동으로 JSON 추출
const result = await api.queryJSON(
  projectPath,
  "Review src/services files"
);

if (result.success) {
  console.log(result.data);  // Already parsed!
}
```

### Level 3: Type-Safe 추출 ⭐⭐⭐

```typescript
import type { ReviewResult } from '../types/query-types';

// Type-safe with validation
const result = await api.queryTypedJSON<ReviewResult>(
  projectPath,
  "Review the TaskRouter.ts file",
  ['review', 'name', 'tags']  // Required fields
);

if (result.success && result.data) {
  // TypeScript knows the exact type!
  const { review, name, tags } = result.data;

  console.log(`${name}: ${review}/10`);
  console.log(`Tags: ${tags.join(', ')}`);
}
```

### Level 4: UI 통합

```typescript
// React 컴포넌트에서
const handleReview = async () => {
  const result = await window.queryAPI.executeJSONQuery(
    projectPath,
    "Review all services in src/services/",
    ['review', 'name', 'tags']
  );

  if (result.success) {
    setReviewData(result.data);
  } else {
    showError(result.error);
  }
};
```

## Edge Cases 처리

### Case 1: Markdown Code Blocks

**Input:**
```
Here are the results:

```json
{
  "review": 9,
  "name": "Component",
  "tags": ["clean"]
}
```

This component is well-designed.
```

**Output:**
```json
{
  "review": 9,
  "name": "Component",
  "tags": ["clean"]
}
```

### Case 2: 혼합 컨텐츠

**Input:**
```
After analyzing the code, I found that {"review": 8, "name": "Service", "tags": ["good"]}
```

**Output:**
```json
{"review": 8, "name": "Service", "tags": ["good"]}
```

### Case 3: 일반적인 오류

**Input:**
```json
{
  "review": 7,
  "name": "Module",
  "tags": ["useful",]
}
```

**Fixed Output:**
```json
{
  "review": 7,
  "name": "Module",
  "tags": ["useful"]
}
```

### Case 4: 여러 객체

**Input:**
```json
{"review": 9, "name": "A", "tags": ["x"]}
{"review": 8, "name": "B", "tags": ["y"]}
```

**Output (array):**
```json
[
  {"review": 9, "name": "A", "tags": ["x"]},
  {"review": 8, "name": "B", "tags": ["y"]}
]
```

## 실전 사용 시나리오

### 시나리오 1: Agent Pool 통계

```typescript
// Agent 정의
const agent: AgentDefinition = {
  name: 'stats-reporter',
  outputStyle: 'structured-json',
  // ...
};

// 실행
const result = await queryAPI.executeJSONQuery(
  projectPath,
  "Report stats for all agents in the pool",
  ['agentName', 'status', 'tasksCompleted']
);

if (result.success && isAgentStatsResult(result.data)) {
  // Type-safe!
  displayStats(result.data);
}
```

### 시나리오 2: 코드 리뷰 자동화

```typescript
const result = await api.queryTypedJSON<ReviewResults>(
  projectPath,
  `Review all files in src/services/ and rate them.

  For each file provide:
  - review: Score 1-10
  - name: File name
  - tags: Quality indicators`,
  ['review', 'name', 'tags']
);

if (result.success && result.data) {
  // Generate report
  const avgScore = result.data.reduce((sum, r) => sum + r.review, 0) / result.data.length;

  console.log(`Average Code Quality: ${avgScore.toFixed(1)}/10`);

  result.data
    .filter(r => r.review < 7)
    .forEach(r => {
      console.log(`⚠️  ${r.name} needs improvement`);
    });
}
```

### 시나리오 3: Task 실행 계획

```typescript
import type { TaskExecutionPlan } from '../types/query-types';

const result = await api.queryTypedJSON<TaskExecutionPlan>(
  projectPath,
  `Create an execution plan for task: ${task.description}

  Include:
  - taskId
  - steps (with order, description, estimated_duration, dependencies)
  - total_estimated_duration
  - risks`,
  ['taskId', 'steps', 'total_estimated_duration', 'risks']
);

if (result.success && result.data) {
  const plan = result.data;

  console.log(`Task: ${plan.taskId}`);
  console.log(`Total Duration: ${plan.total_estimated_duration}`);
  console.log(`\nSteps:`);

  plan.steps.forEach(step => {
    console.log(`  ${step.order}. ${step.description}`);
    console.log(`     Duration: ${step.estimated_duration}`);
    if (step.dependencies.length > 0) {
      console.log(`     Depends on: ${step.dependencies.join(', ')}`);
    }
  });

  if (plan.risks.length > 0) {
    console.log(`\n⚠️  Risks:`);
    plan.risks.forEach(risk => console.log(`  - ${risk}`));
  }
}
```

## IPC 통합

### Frontend (React)

```typescript
// Simple JSON query
const result = await window.queryAPI.executeJSONQuery(
  projectPath,
  "Analyze src/services/ProcessManager.ts",
  ['file', 'complexity', 'maintainability']
);

// With type checking
if (result.success) {
  const data = result.data as CodeAnalysisResult;

  setAnalysisResult(data);

  if (data.complexity > 15) {
    showWarning('High complexity detected');
  }
}
```

### IPC Channels

```typescript
// query:executeJSONQuery
interface Input {
  projectPath: string;
  query: string;
  requiredFields?: string[];
}

interface Output {
  success: boolean;
  data?: T;
  error?: string;
  raw?: string;
  cleanedText?: string;
}
```

## 에러 처리

### 전략 1: Graceful Degradation

```typescript
const result = await api.queryJSON(projectPath, query);

if (!result.success) {
  // Fallback to raw text
  console.warn('JSON parsing failed:', result.error);
  console.log('Raw output:', result.raw);

  // Or show to user for manual review
  showRawOutput(result.raw);
}
```

### 전략 2: Retry with Different Prompt

```typescript
let result = await api.queryJSON(projectPath, query);

if (!result.success) {
  // Retry with more explicit instructions
  result = await api.queryJSON(
    projectPath,
    `${query}\n\nIMPORTANT: Respond ONLY with valid JSON. No explanations.`
  );
}
```

### 전략 3: Field-by-Field Validation

```typescript
const result = await api.queryJSON(projectPath, query, {
  requiredFields: ['review', 'name', 'tags']
});

if (result.success && result.data) {
  // Additional runtime validation
  const data = result.data as ReviewResult;

  if (data.review < 1 || data.review > 10) {
    console.warn('Invalid review score:', data.review);
  }

  if (!data.name || data.name.trim() === '') {
    console.warn('Empty name field');
  }
}
```

## 성능 최적화

### 1. Caching

```typescript
const cache = new Map<string, JSONExtractionResult>();

async function cachedQueryJSON(query: string) {
  if (cache.has(query)) {
    return cache.get(query)!;
  }

  const result = await api.queryJSON(projectPath, query);
  cache.set(query, result);

  return result;
}
```

### 2. Parallel Execution

```typescript
const queries = [
  'Review ProcessManager.ts',
  'Review TaskRouter.ts',
  'Review AgentLoader.ts'
];

const results = await Promise.all(
  queries.map(q => api.queryJSON(projectPath, q))
);

const successful = results.filter(r => r.success);
console.log(`Success rate: ${successful.length}/${results.length}`);
```

### 3. Streaming for Large Results

```typescript
// For very large JSON responses
const result = await api.query(projectPath, query, {
  outputStyle: 'structured-json',
  filterThinking: true
});

// Process in chunks
const extracted = extractMultipleJSON(result.result);

if (extracted.success && extracted.data) {
  // Process items incrementally
  for (const item of extracted.data) {
    processItem(item);
  }
}
```

## 테스트

### Unit Tests

```typescript
import { extractJSON, extractAndValidate } from '../lib/jsonExtractor';

describe('JSON Extractor', () => {
  it('should extract JSON from markdown', () => {
    const input = '```json\n{"test": true}\n```';
    const result = extractJSON(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ test: true });
  });

  it('should validate required fields', () => {
    const input = '{"name": "Test", "value": 123}';
    const result = extractAndValidate(input, ['name', 'value']);

    expect(result.success).toBe(true);
  });

  it('should fail when fields missing', () => {
    const input = '{"name": "Test"}';
    const result = extractAndValidate(input, ['name', 'value', 'tags']);

    expect(result.success).toBe(false);
    expect(result.error).toContain('missing required fields');
  });
});
```

### Integration Tests

```bash
# Run example script
tsx scripts/example-json-extraction.ts

# Expected output:
# ✅ JSON extraction successful!
# ✅ Validation successful!
# ✅ queryJSON successful!
# ✅ Type-safe extraction: ...
```

## Best Practices

### 1. 명확한 프롬프트

```typescript
// ❌ Bad
const result = await api.queryJSON(projectPath, "Analyze the code");

// ✅ Good
const result = await api.queryJSON(
  projectPath,
  `Analyze src/services/TaskRouter.ts

  Provide:
  - file: File path
  - complexity: Cyclomatic complexity (1-20)
  - maintainability: Score 1-100
  - issues: Array of issue objects
  - suggestions: Array of improvement suggestions`
);
```

### 2. 필수 필드 명시

```typescript
// Always specify required fields for validation
const result = await api.queryTypedJSON<CodeAnalysisResult>(
  projectPath,
  query,
  ['file', 'complexity', 'maintainability', 'issues', 'suggestions']
);
```

### 3. Type Guards 사용

```typescript
// Use type guards for runtime safety
if (result.success && isCodeAnalysisResult(result.data)) {
  // TypeScript knows exact type
  processAnalysis(result.data);
}
```

### 4. 에러 로깅

```typescript
if (!result.success) {
  appLogger.error('JSON extraction failed', undefined, {
    error: result.error,
    rawLength: result.raw?.length,
    cleanedLength: result.cleanedText?.length
  });
}
```

## 결론

**완성된 일반화 프로세스:**

1. ✅ **Output-Style 강제** → 일관된 형식
2. ✅ **Thinking 필터링** → 깔끔한 응답
3. ✅ **Markdown 제거** → 순수 텍스트
4. ✅ **JSON 추출** → 구조화된 데이터
5. ✅ **필드 검증** → 타입 안전성
6. ✅ **Type Guards** → 런타임 안전성

**주요 장점:**

- 🔒 **Type-Safe**: TypeScript로 컴파일 타임 검증
- 🛡️ **Runtime-Safe**: Type guards로 런타임 검증
- 🔄 **Robust**: 다양한 edge case 처리
- 📦 **Composable**: 여러 레벨의 추상화
- 🚀 **Production-Ready**: 에러 처리 및 로깅 완비

이제 Claude 응답에서 **순수한 JSON만 추출하는 완전히 일반화된 파이프라인**이 준비되었습니다!
