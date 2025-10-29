# JSON Extraction - Quick Reference

## 한눈에 보는 파이프라인

```
┌─────────────────────────────────────────────────────────────┐
│                    Raw Claude Response                      │
│  "Here's the analysis: ```json                             │
│  {"review": 9, "name": "Component", "tags": ["clean"]}     │
│  ``` This is a great component!"                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│               1. Output-Style Injection                     │
│  `/output-style structured-json` → Consistent format       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│               2. Thinking Filtering                         │
│  Remove { "type": "thinking", ...} blocks                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│               3. Markdown Removal                           │
│  ```json ... ``` → raw JSON text                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│               4. JSON Extraction                            │
│  Extract {...} or [...] from mixed content                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│               5. Common Fixes                               │
│  Trailing commas, unquoted keys, etc.                      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│               6. Validation                                 │
│  Check required fields are present                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    Clean JSON ✨                            │
│  {"review": 9, "name": "Component", "tags": ["clean"]}     │
└─────────────────────────────────────────────────────────────┘
```

## 3가지 사용 레벨

### Level 1: 기본 (수동)

```typescript
const result = await api.query(projectPath, query, {
  outputStyle: 'structured-json',
  filterThinking: true
});

const extracted = extractJSON(result.result);
```

### Level 2: 자동 추출

```typescript
const result = await api.queryJSON(projectPath, query);
// Automatically: output-style + thinking filter + JSON extraction
```

### Level 3: Type-Safe ⭐

```typescript
const result = await api.queryTypedJSON<ReviewResult>(
  projectPath,
  query,
  ['review', 'name', 'tags']  // Validation
);
```

## API 치트시트

### ClaudeQueryAPI

| Method | Purpose | Returns |
|--------|---------|---------|
| `query()` | 기본 쿼리 | `QueryResult` (raw) |
| `queryJSON()` | 자동 JSON 추출 | `JSONExtractionResult<T>` |
| `queryTypedJSON()` | Type-safe + 검증 | `JSONExtractionResult<T>` |

### JSON Extractor

| Function | Purpose | Use When |
|----------|---------|----------|
| `extractJSON()` | 기본 추출 | 단순 파싱 |
| `extractAndValidate()` | 필드 검증 | 필수 필드 확인 필요 |
| `extractMultipleJSON()` | 여러 객체 | 배열 응답 |

### Type Guards

| Function | Checks | Returns |
|----------|--------|---------|
| `isReviewResult()` | ReviewResult 타입 | `boolean` |
| `isReviewResults()` | ReviewResults 배열 | `boolean` |
| `isAgentStatsResult()` | AgentStatsResult 타입 | `boolean` |

## 코드 스니펫

### Basic Usage

```typescript
import { ClaudeQueryAPI } from '../services/ClaudeQueryAPI';

const api = new ClaudeQueryAPI();
const result = await api.queryJSON(projectPath, "Analyze code");

if (result.success) {
  console.log(result.data);  // Clean JSON
}
```

### With Validation

```typescript
const result = await api.queryJSON(projectPath, query, {
  requiredFields: ['review', 'name', 'tags']
});

if (result.success && result.data) {
  // All required fields present!
  processData(result.data);
}
```

### Type-Safe

```typescript
import type { ReviewResult } from '../types/query-types';

const result = await api.queryTypedJSON<ReviewResult>(
  projectPath,
  "Review the file",
  ['review', 'name', 'tags']
);

if (result.success && result.data) {
  // TypeScript knows exact type
  const score: number = result.data.review;
  const name: string = result.data.name;
  const tags: string[] = result.data.tags;
}
```

### UI Integration

```typescript
// React component
const handleAnalyze = async () => {
  const result = await window.queryAPI.executeJSONQuery(
    projectPath,
    "Analyze all services",
    ['file', 'complexity', 'maintainability']
  );

  if (result.success) {
    setAnalysisResults(result.data);
  } else {
    showError(result.error);
  }
};
```

## 에러 처리 패턴

### Pattern 1: Fallback

```typescript
const result = await api.queryJSON(projectPath, query);

if (!result.success) {
  // Show raw output
  console.warn('Parse failed:', result.error);
  displayRawText(result.raw);
}
```

### Pattern 2: Retry

```typescript
let result = await api.queryJSON(projectPath, query);

if (!result.success) {
  // Retry with explicit instructions
  result = await api.queryJSON(
    projectPath,
    `${query}\n\nRespond ONLY with valid JSON.`
  );
}
```

### Pattern 3: Validation

```typescript
if (result.success && result.data) {
  // Additional checks
  if (!isValidScore(result.data.review)) {
    logWarning('Invalid score');
  }
}
```

## 자주 하는 실수

### ❌ Don't

```typescript
// 1. Parsing raw result manually
JSON.parse(result.result);  // Can fail!

// 2. No validation
const data = result.data;  // Type unknown

// 3. Ignoring errors
if (result.success) { /* only */ }
```

### ✅ Do

```typescript
// 1. Use extraction utilities
const extracted = extractJSON(result.result);

// 2. Validate and type guard
if (result.success && isReviewResult(result.data)) {
  processReview(result.data);  // Type-safe
}

// 3. Handle both cases
if (result.success) {
  handleSuccess(result.data);
} else {
  handleError(result.error, result.raw);
}
```

## 핵심 파일

| File | Purpose |
|------|---------|
| `src/lib/jsonExtractor.ts` | JSON 추출 로직 |
| `src/services/ClaudeQueryAPI.ts` | 통합 API |
| `src/types/query-types.ts` | 공통 타입 정의 |
| `src/ipc/handlers/queryHandlers.ts` | IPC 핸들러 |
| `scripts/example-json-extraction.ts` | 사용 예시 |

## 테스트 명령어

```bash
# 빌드
npm run build

# 예시 실행
tsx scripts/example-json-extraction.ts

# Unit 테스트 (if available)
npm test
```

## 성능 팁

1. **캐싱**: 동일한 쿼리는 캐시
2. **병렬 실행**: `Promise.all()` 활용
3. **타임아웃**: 긴 작업은 timeout 설정
4. **점진적 처리**: 큰 결과는 스트림 방식

## 다음 단계

1. 커스텀 타입 정의 (`src/types/query-types.ts`)
2. 프로젝트별 output-style 생성 (`.claude/output-styles/`)
3. Agent에 outputStyle 설정 (`workflow/agents/*.md`)
4. UI 컴포넌트에 통합

---

**Quick Start:**

```typescript
import { ClaudeQueryAPI } from './services/ClaudeQueryAPI';
import type { ReviewResult } from './types/query-types';

const api = new ClaudeQueryAPI();

const result = await api.queryTypedJSON<ReviewResult>(
  projectPath,
  "Review this file",
  ['review', 'name', 'tags']
);

if (result.success) {
  console.log(`${result.data.name}: ${result.data.review}/10`);
}
```

**That's it! 🎉**
