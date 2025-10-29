# Zod Schema Validation - Quick Start

## 🚀 빠른 시작

### 1. 기본 사용법

```typescript
import { z } from 'zod';
import { ClaudeQueryAPI } from './services/ClaudeQueryAPI';

const api = new ClaudeQueryAPI();

// Step 1: Zod 스키마 정의
const schema = z.object({
  file: z.string().describe('File path'),
  lines: z.number().min(0),
  language: z.enum(['typescript', 'javascript', 'python'])
});

// Step 2: 쿼리 실행
const result = await api.queryWithZod(
  '/path/to/project',
  'Analyze src/main.ts',
  schema
);

// Step 3: Type-safe 결과 사용
if (result.success) {
  console.log(result.data.file);      // ✅ string
  console.log(result.data.lines);     // ✅ number
  console.log(result.data.language);  // ✅ 'typescript' | 'javascript' | 'python'
}
```

---

## 📚 CommonSchemas 사용

```typescript
import { CommonSchemas } from './lib/zodSchemaBuilder';

// Code Review
const review = await api.queryWithZod(
  projectPath,
  'Review src/components/Button.tsx',
  CommonSchemas.codeReview()
);

if (review.success) {
  console.log(`Score: ${review.data.review}/10`);
  console.log(`Issues: ${review.data.issues.length}`);
}

// Agent Stats
const stats = await api.queryWithZod(
  projectPath,
  'Get statistics for agent "code-reviewer"',
  CommonSchemas.agentStats()
);

// Task Plan
const plan = await api.queryWithZod(
  projectPath,
  'Create plan for implementing authentication',
  CommonSchemas.taskPlan()
);
```

---

## 🎨 커스텀 스키마

### 간단한 스키마

```typescript
const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(0).max(120).optional()
});
```

### 복잡한 스키마

```typescript
const projectSchema = z.object({
  name: z.string(),
  type: z.enum(['application', 'library', 'tool']),
  frameworks: z.array(z.string()),
  files: z.array(
    z.object({
      path: z.string(),
      purpose: z.string(),
      lines: z.number()
    })
  ),
  config: z.object({
    strict: z.boolean(),
    target: z.string()
  }).optional()
});
```

---

## ✅ 검증 기능

### String

```typescript
z.string()                    // 기본
z.string().min(3)             // 최소 길이
z.string().max(255)           // 최대 길이
z.string().email()            // 이메일
z.string().url()              // URL
z.string().uuid()             // UUID
z.string().regex(/^[A-Z]+$/)  // 정규식
```

### Number

```typescript
z.number()              // 기본
z.number().int()        // 정수
z.number().positive()   // 양수
z.number().min(0)       // 최소값
z.number().max(100)     // 최대값
```

### Enum

```typescript
z.enum(['option1', 'option2', 'option3'])
```

### Array

```typescript
z.array(z.string())                    // 문자열 배열
z.array(z.number()).min(1)             // 최소 1개
z.array(z.number()).max(10)            // 최대 10개
z.array(z.object({ id: z.number() }))  // 객체 배열
```

### Optional & Nullable

```typescript
z.string().optional()              // string | undefined
z.string().nullable()              // string | null
z.string().optional().nullable()   // string | null | undefined
```

### Custom Validation

```typescript
z.string().refine(
  (val) => val.length <= 255,
  { message: "String must be 255 chars or less" }
)

z.number().refine(
  (val) => val % 2 === 0,
  { message: "Must be even number" }
)
```

---

## 🔄 완전한 예시

```typescript
import { z } from 'zod';
import { ClaudeQueryAPI } from './services/ClaudeQueryAPI';

async function analyzeProject() {
  const api = new ClaudeQueryAPI();

  // 1. 스키마 정의
  const projectAnalysisSchema = z.object({
    name: z.string().describe('Project name'),
    type: z.enum(['application', 'library', 'tool']).describe('Project type'),
    primaryLanguage: z.string().describe('Main language'),
    frameworks: z.array(z.string()).describe('Used frameworks'),
    keyFiles: z.array(
      z.object({
        path: z.string(),
        purpose: z.string()
      })
    ).describe('Important files'),
    complexity: z.number().min(1).max(10).describe('Overall complexity'),
    recommendations: z.array(z.string()).describe('Recommendations')
  });

  // 2. 쿼리 실행
  const result = await api.queryWithZod(
    process.cwd(),
    'Analyze this project structure and provide insights',
    projectAnalysisSchema,
    {
      mcpConfig: '.claude/.mcp-empty.json',
      timeout: 90000
    }
  );

  // 3. 결과 처리
  if (!result.success) {
    console.error('Analysis failed:', result.error);
    return;
  }

  // Type-safe data!
  const { data } = result;

  console.log(`Project: ${data.name} (${data.type})`);
  console.log(`Language: ${data.primaryLanguage}`);
  console.log(`Frameworks: ${data.frameworks.join(', ')}`);
  console.log(`Complexity: ${data.complexity}/10`);

  console.log('\nKey Files:');
  data.keyFiles.forEach(file => {
    console.log(`  - ${file.path}: ${file.purpose}`);
  });

  console.log('\nRecommendations:');
  data.recommendations.forEach((rec, i) => {
    console.log(`  ${i + 1}. ${rec}`);
  });
}

analyzeProject();
```

---

## 🎯 핵심 원칙

1. **Output-style은 힌트**: Claude에게 JSON 형식 가이드
2. **실제 검증은 Zod**: 런타임에 타입과 제약 조건 검증
3. **Type-Safe**: TypeScript 타입 추론으로 안전한 코드

---

## 📖 더 알아보기

- **Zod 공식 문서**: https://zod.dev
- **Standard Schema**: https://github.com/standard-schema/standard-schema
- **상세 구현 문서**: `docs/improvements/STANDARD_SCHEMA_IMPLEMENTATION.md`

---

## 🧪 테스트

```bash
# Zod 스키마 시스템 테스트
npx tsx scripts/test-zod-schema.ts

# Claude CLI 통합 테스트
npx tsx scripts/test-zod-with-claude.ts
```

---

**Happy coding with type-safe schema validation! 🎉**
