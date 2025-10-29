# Standard Schema 기반 검증 시스템 구현 완료

## ✅ 목표 달성

**"JSON 구조 검증의 경우 Standard Schema를 기반으로 스키마를 구현하고 검증하는 것으로 컨벤션을 구축할 것임"**

→ ✅ **완료!**

---

## 🎯 핵심 아키텍처

### Output-Style의 역할 재정의

**Before (고정 검증):**
```
Output-Style → Claude → JSON → 커스텀 검증
```

**After (Standard Schema):**
```
Output-Style (힌트) → Claude → JSON → Zod (Standard Schema) 검증 ✨
```

**핵심 원칙:**
1. **Output-style은 힌트**: Claude에게 어떤 형식으로 응답해야 하는지 가이드
2. **실제 검증은 Zod**: Standard Schema를 준수하는 Zod로 런타임 검증
3. **Type-Safe**: TypeScript 타입 추론 + 런타임 검증

---

## 📦 구현된 컴포넌트

### 1. Zod Schema Builder

**파일:** `src/lib/zodSchemaBuilder.ts` (400+ lines)

#### Standard Schema 인터페이스

```typescript
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

export namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output>;
  }

  export type Result<Output> = SuccessResult<Output> | FailureResult;

  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }

  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }
}
```

#### Zod 스키마 → 프롬프트 변환

```typescript
export function zodSchemaToPrompt<T extends ZodType<any, any, any>>(
  schema: T,
  instruction?: string
): string {
  // Zod 스키마를 분석하여 Claude가 이해할 수 있는 프롬프트 생성
  // 타입, 제약조건, 설명 모두 포함
}
```

**생성 예시:**
```typescript
const schema = z.object({
  file: z.string().describe('File path'),
  lines: z.number().min(0).describe('Line count'),
  language: z.enum(['typescript', 'javascript']).describe('Language')
});

const prompt = zodSchemaToPrompt(schema, 'Analyze file');
```

**결과:**
```
Analyze file

Respond with JSON matching this schema:

{
  "file": string // File path,
  "lines": number (min: 0) // Line count,
  "language": enum (typescript | javascript) // Language
}

**Important:**
- Output ONLY the JSON, no explanations
- Do NOT use markdown code blocks in your response
- Ensure all required fields are present
- Match types exactly
```

#### Zod 검증

```typescript
export function validateWithZod<T>(
  data: unknown,
  schema: ZodType<T>
): { success: true; data: T } | { success: false; error: string; issues: z.ZodIssue[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
    issues: result.error.errors
  };
}
```

#### CommonSchemas (Zod 기반)

```typescript
export const CommonSchemas = {
  codeReview: () =>
    z.object({
      file: z.string().describe('File path'),
      review: z.number().min(1).max(10).describe('Quality score'),
      complexity: z.number().min(1).max(20).describe('Cyclomatic complexity'),
      maintainability: z.number().min(0).max(100).describe('Maintainability index'),
      issues: z
        .array(
          z.object({
            severity: z.enum(['low', 'medium', 'high']),
            message: z.string(),
            line: z.number().optional()
          })
        )
        .describe('List of issues found'),
      suggestions: z.array(z.string()).describe('Improvement suggestions')
    }),

  agentStats: () => z.object({ /* ... */ }),
  taskPlan: () => z.object({ /* ... */ }),
  simpleReview: () => z.object({ /* ... */ })
};
```

---

### 2. Enhanced ClaudeQueryAPI

**파일:** `src/services/ClaudeQueryAPI.ts`

#### queryWithZod()

```typescript
async queryWithZod<T>(
  projectPath: string,
  instruction: string,
  schema: import('zod').ZodType<T>,
  options?: QueryOptions
): Promise<JSONExtractionResult<T>> {
  // 1. Zod 스키마 → 프롬프트 변환 (Claude 가이드용)
  const schemaPrompt = zodSchemaToPrompt(schema, instruction);

  // 2. Claude 실행 (output-style: json은 힌트만)
  const result = await this.query(projectPath, schemaPrompt, {
    ...options,
    outputStyle: 'json',
    filterThinking: true
  });

  // 3. JSON 추출
  const extracted = extractJSON<T>(result.result);

  // 4. Zod 검증 (실제 검증!)
  const validation = validateWithZod(extracted.data, schema);

  if (!validation.success) {
    return {
      success: false,
      error: `Schema validation failed: ${validation.error}`
    };
  }

  return {
    success: true,
    data: validation.data  // Type-safe!
  };
}
```

#### queryWithStandardSchema()

```typescript
async queryWithStandardSchema<T extends StandardSchemaV1>(
  projectPath: string,
  instruction: string,
  schema: T,
  options?: QueryOptions
): Promise<JSONExtractionResult<StandardSchemaV1.InferOutput<T>>> {
  // Standard Schema를 구현한 모든 라이브러리 지원
  // (Zod, Valibot, ArkType, Effect Schema 등)

  const validation = await validateWithStandardSchema(data, schema);
  // ...
}
```

---

## 🧪 검증 결과

### Test 1: Zod 스키마 시스템 검증

**스크립트:** `scripts/test-zod-schema.ts`

**결과:**
```
✅ All tests passed!

Key Features Verified:
  1. ✅ Zod schema to prompt conversion
  2. ✅ Standard Schema compliance (version: 1, vendor: 'zod')
  3. ✅ Validation (valid data)
  4. ✅ Validation (invalid data with detailed errors)
  5. ✅ CommonSchemas library
  6. ✅ Complex nested schemas
  7. ✅ Type inference
  8. ✅ Optional and nullable fields
```

**Standard Schema 준수 확인:**
```typescript
const schema = z.object({ /* ... */ });

console.log(isStandardSchema(schema));  // true
console.log(schema['~standard'].version);  // 1
console.log(schema['~standard'].vendor);   // 'zod'
console.log(typeof schema['~standard'].validate);  // 'function'
```

---

## 🎨 사용 예시

### 예시 1: 기본 사용법

```typescript
import { z } from 'zod';
import { ClaudeQueryAPI } from './services/ClaudeQueryAPI';

const api = new ClaudeQueryAPI();

// 1. Zod 스키마 정의
const fileSchema = z.object({
  file: z.string().describe('File path'),
  lines: z.number().min(0).describe('Line count'),
  language: z.enum(['typescript', 'javascript', 'python'])
});

// 2. 쿼리 실행 (자동으로 프롬프트 생성 + 검증)
const result = await api.queryWithZod(
  projectPath,
  'Analyze src/main.ts',
  fileSchema
);

// 3. Type-safe 결과 사용
if (result.success) {
  console.log(result.data.file);      // ✅ string
  console.log(result.data.lines);     // ✅ number
  console.log(result.data.language);  // ✅ 'typescript' | 'javascript' | 'python'
}
```

### 예시 2: CommonSchemas 사용

```typescript
import { CommonSchemas } from './lib/zodSchemaBuilder';

const result = await api.queryWithZod(
  projectPath,
  'Review src/lib/jsonExtractor.ts',
  CommonSchemas.codeReview()
);

if (result.success) {
  console.log(`Review: ${result.data.review}/10`);
  console.log(`Complexity: ${result.data.complexity}/20`);
  console.log(`Issues: ${result.data.issues.length}`);

  result.data.issues.forEach(issue => {
    console.log(`[${issue.severity}] ${issue.message}`);
  });
}
```

### 예시 3: 복잡한 중첩 스키마

```typescript
const projectSchema = z.object({
  name: z.string(),
  language: z.enum(['TypeScript', 'JavaScript', 'Python']),
  frameworks: z.array(z.string()),
  complexity: z.number().min(1).max(10),
  files: z.array(
    z.object({
      path: z.string(),
      lines: z.number(),
      issues: z.number().optional()
    })
  ),
  config: z.object({
    strict: z.boolean(),
    target: z.string()
  }).optional()
});

const result = await api.queryWithZod(
  projectPath,
  'Analyze this entire project',
  projectSchema,
  { timeout: 120000 }
);
```

### 예시 4: Standard Schema 직접 사용

```typescript
// Zod 외의 다른 Standard Schema 구현체도 사용 가능
// (Valibot, ArkType, Effect Schema 등)

const result = await api.queryWithStandardSchema(
  projectPath,
  'Get user info',
  schema  // Any Standard Schema V1 compliant schema
);
```

---

## 🔄 파이프라인 비교

### Before (커스텀 스키마)

```
사용자 스키마 정의 (커스텀 DSL)
    ↓
프롬프트 생성
    ↓
Claude 실행
    ↓
JSON 추출
    ↓
커스텀 검증 (타입 체크, enum, range 등)
    ↓
결과 (타입 안전성 제한적)
```

**문제점:**
- ❌ 커스텀 검증 로직 유지 보수
- ❌ 생태계 표준 미준수
- ❌ 다른 라이브러리와 호환 불가

### After (Standard Schema + Zod)

```
Zod 스키마 정의 (생태계 표준)
    ↓
zodSchemaToPrompt() → 프롬프트 생성
    ↓
Output-Style 'json' (힌트만 제공)
    ↓
Claude 실행
    ↓
JSON 추출 (기존 extractJSON 활용)
    ↓
Zod 검증 (Standard Schema 준수) ✨
    ↓
Type-Safe 결과 (z.infer<typeof schema>)
```

**장점:**
- ✅ 생태계 표준 (Standard Schema V1)
- ✅ 강력한 타입 추론 (z.infer)
- ✅ 풍부한 검증 기능 (Zod의 모든 기능)
- ✅ 다른 Standard Schema 라이브러리와 호환
- ✅ Output-style은 보조 역할
- ✅ 실제 검증은 Zod가 담당

---

## 📊 Standard Schema 생태계

### 지원하는 라이브러리

| Library | Trust Score | Standard Schema | 특징 |
|---------|-------------|-----------------|------|
| **Zod** | ⭐ 9.6 | ✅ v3.24.0+ | 가장 인기, 풍부한 기능 |
| **Valibot** | ⭐ 9.5 | ✅ | 작은 번들 사이즈 |
| **ArkType** | ⭐ 9.4 | ✅ | 런타임 성능 최적화 |
| **Effect Schema** | ⭐ 9.3 | ✅ | Effect 생태계 통합 |

### 채택한 프레임워크

- **tRPC**: End-to-end type-safe API
- **TanStack Form**: Type-safe form validation
- **Hono**: Fast web framework
- **더 많은 프레임워크들이 Standard Schema 채택 중**

---

## 🎯 핵심 성과

### 1. 생태계 표준 준수

기존 커스텀 스키마 시스템 대신 **Standard Schema V1**을 기반으로 재구축:

```typescript
// Zod v3.24.0+는 자동으로 Standard Schema 구현
const schema = z.object({ /* ... */ });

schema['~standard'].version;   // 1
schema['~standard'].vendor;    // 'zod'
schema['~standard'].validate;  // function
```

### 2. Output-Style의 명확한 역할 정의

**Output-Style:**
- ✅ Claude에게 JSON 형식 가이드 제공 (힌트)
- ✅ 응답 일관성 향상
- ✅ Markdown 제거 유도

**Zod (실제 검증):**
- ✅ 타입 검증 (string, number, boolean, array, object)
- ✅ Enum 검증
- ✅ Range 검증 (min, max)
- ✅ 복잡한 검증 로직 (refine, superRefine)
- ✅ Transform (데이터 변환)

### 3. Type-Safe 결과

```typescript
const schema = z.object({
  name: z.string(),
  age: z.number().min(0).max(120),
  role: z.enum(['admin', 'user', 'guest'])
});

type User = z.infer<typeof schema>;
// type User = {
//   name: string;
//   age: number;
//   role: 'admin' | 'user' | 'guest';
// }

const result = await api.queryWithZod(path, query, schema);

if (result.success) {
  // result.data is User (fully type-safe!)
  result.data.name;   // string
  result.data.age;    // number
  result.data.role;   // 'admin' | 'user' | 'guest'
}
```

### 4. 풍부한 검증 기능

```typescript
// String validations
z.string().email()
z.string().url()
z.string().uuid()
z.string().min(3).max(255)
z.string().regex(/^[A-Z]+$/)

// Number validations
z.number().int()
z.number().positive()
z.number().min(0).max(100)

// Date validations
z.date().min(new Date('2020-01-01'))

// Custom validation
z.string().refine((val) => val.length <= 255, {
  message: "String must be 255 chars or less"
})

// Transforms
z.string().transform((val) => val.toLowerCase())
```

---

## 📁 파일 구조

```
src/
├── lib/
│   ├── zodSchemaBuilder.ts      # ⭐ Zod 기반 스키마 시스템 (NEW)
│   ├── schemaBuilder.ts          # (기존 커스텀 스키마, 유지)
│   └── jsonExtractor.ts          # JSON 추출 (유지)
├── services/
│   └── ClaudeQueryAPI.ts         # ⭐ Zod 메서드 추가
└── ...

scripts/
├── test-zod-schema.ts            # ⭐ Zod 스키마 검증 테스트 (NEW)
├── test-zod-with-claude.ts       # ⭐ Claude 통합 테스트 (NEW)
├── test-schema-standalone.ts     # (기존 커스텀 스키마 테스트)
└── ...

docs/
└── improvements/
    ├── STANDARD_SCHEMA_IMPLEMENTATION.md  # ⭐ 본 문서 (NEW)
    ├── SCHEMA_VALIDATION_VERIFIED.md      # (기존 커스텀 스키마 검증)
    └── ...
```

---

## 🚀 마이그레이션 가이드

### From 커스텀 스키마 → Zod

**Before:**
```typescript
import { schema, string, number, enumField } from './lib/schemaBuilder';

const customSchema = schema({
  file: string('File path'),
  score: number('Quality', { min: 1, max: 10 }),
  language: enumField(['typescript', 'javascript'])
});

const result = await api.queryWithSchema(path, query, customSchema);
```

**After:**
```typescript
import { z } from 'zod';

const zodSchema = z.object({
  file: z.string().describe('File path'),
  score: z.number().min(1).max(10).describe('Quality'),
  language: z.enum(['typescript', 'javascript']).describe('Language')
});

const result = await api.queryWithZod(path, query, zodSchema);
```

**장점:**
- ✅ 생태계 표준
- ✅ 더 강력한 타입 추론
- ✅ 더 많은 검증 기능
- ✅ 커뮤니티 지원

---

## 📈 성능 및 안정성

### Zod 검증 성능

- **빠른 검증**: 최적화된 런타임 검증
- **상세한 에러**: 정확한 에러 메시지와 경로
- **Type-Safe**: 컴파일 타임 + 런타임 모두 안전

### 검증 예시

**성공 케이스:**
```typescript
const schema = z.object({
  name: z.string(),
  age: z.number().min(0).max(120)
});

const data = { name: 'Alice', age: 30 };
const result = validateWithZod(data, schema);

// result.success === true
// result.data === { name: 'Alice', age: 30 }
```

**실패 케이스:**
```typescript
const data = { name: 'Bob', age: 150 };
const result = validateWithZod(data, schema);

// result.success === false
// result.error === "age: Number must be less than or equal to 120"
// result.issues === [
//   {
//     code: "too_big",
//     maximum: 120,
//     type: "number",
//     inclusive: true,
//     exact: false,
//     message: "Number must be less than or equal to 120",
//     path: ["age"]
//   }
// ]
```

---

## ✅ 최종 검증 체크리스트

- [x] Zod 설치 (v3.24.1, Standard Schema 지원)
- [x] zodSchemaBuilder.ts 작성 (400+ lines)
- [x] Standard Schema 인터페이스 정의
- [x] Zod 스키마 → 프롬프트 변환 함수
- [x] Zod 검증 함수
- [x] Standard Schema 검증 함수
- [x] CommonSchemas (Zod 기반) 재작성
- [x] ClaudeQueryAPI에 queryWithZod() 추가
- [x] ClaudeQueryAPI에 queryWithStandardSchema() 추가
- [x] 테스트 작성 (test-zod-schema.ts)
- [x] 통합 테스트 작성 (test-zod-with-claude.ts)
- [x] 빌드 검증 (✅ PASSING)
- [x] 문서화 완료

---

## 🎉 결론

**"JSON 구조 검증의 경우 Standard Schema를 기반으로 스키마를 구현하고 검증하는 것으로 컨벤션을 구축"**

→ ✅ **완전히 달성!**

### 핵심 원칙

1. **Output-style은 보조**: Claude에게 형식 힌트 제공
2. **실제 검증은 Zod**: Standard Schema를 준수하는 런타임 검증
3. **생태계 표준**: Zod, Valibot, ArkType 등 호환

### 얻은 것

- ✅ 생태계 표준 준수 (Standard Schema V1)
- ✅ Type-Safe 결과 (z.infer)
- ✅ 강력한 검증 (Zod의 모든 기능)
- ✅ 유지보수 용이 (커뮤니티 지원)
- ✅ 확장 가능 (다른 Standard Schema 라이브러리 지원)

---

**Status:** ✅ **FULLY IMPLEMENTED**

**Build:** ✅ **PASSING**

**Standard Schema:** ✅ **V1 COMPLIANT**

**Date:** 2025-10-29
