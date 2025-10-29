/**
 * Zod Schema Builder - Standard Schema 기반 검증 시스템
 *
 * Features:
 * - Zod를 사용한 런타임 검증 (Standard Schema 준수)
 * - Zod 스키마 → 프롬프트 변환 (Claude 가이드용)
 * - Output-style은 힌트, 실제 검증은 Zod
 */

import { z } from 'zod';
import type { ZodType, ZodTypeDef } from 'zod';

/**
 * Standard Schema 타입 체크
 *
 * Zod v3.24.0+는 Standard Schema를 자동으로 지원합니다.
 */
export function isStandardSchema(schema: unknown): schema is StandardSchemaV1 {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    '~standard' in schema &&
    typeof (schema as any)['~standard'] === 'object'
  );
}

/**
 * Standard Schema V1 인터페이스
 */
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

  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey>;
  }

  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }

  export type InferInput<T extends StandardSchemaV1> = T['~standard']['types'] extends {
    input: infer I;
  }
    ? I
    : never;

  export type InferOutput<T extends StandardSchemaV1> = T['~standard']['types'] extends {
    output: infer O;
  }
    ? O
    : never;
}

/**
 * Zod 스키마를 프롬프트 문자열로 변환
 *
 * Output-style은 힌트 역할만 하고, 실제 검증은 Zod가 수행
 */
export function zodSchemaToPrompt<T extends ZodType<any, any, any>>(
  schema: T,
  instruction?: string
): string {
  const sections: string[] = [];

  if (instruction) {
    sections.push(instruction);
    sections.push('');
  }

  sections.push('Respond with JSON matching this schema:');
  sections.push('');
  sections.push('```');
  sections.push(describeZodSchema(schema));
  sections.push('```');
  sections.push('');
  sections.push('**Important:**');
  sections.push('- Output ONLY the JSON, no explanations');
  sections.push('- Do NOT use markdown code blocks in your response');
  sections.push('- Ensure all required fields are present');
  sections.push('- Match types exactly');

  return sections.join('\n');
}

/**
 * Zod 스키마를 인간이 읽을 수 있는 형식으로 변환
 */
function describeZodSchema(schema: ZodType<any, any, any>, indent = 0): string {
  const ind = '  '.repeat(indent);

  // ZodObject
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const lines = ['{'];

    const entries = Object.entries(shape);
    entries.forEach(([key, fieldSchema], index) => {
      const isLast = index === entries.length - 1;
      const desc = describeZodField(key, fieldSchema as ZodType<any>);
      lines.push(`${ind}  ${desc}${isLast ? '' : ','}`);
    });

    lines.push(`${ind}}`);
    return lines.join('\n');
  }

  // 기타 타입
  return describeZodType(schema);
}

/**
 * Zod 필드를 설명
 */
function describeZodField(key: string, schema: ZodType<any>): string {
  const type = describeZodType(schema);
  const desc = getZodDescription(schema);

  let field = `"${key}": ${type}`;

  if (desc) {
    field += ` // ${desc}`;
  }

  return field;
}

/**
 * Zod 타입을 문자열로 변환
 */
function describeZodType(schema: ZodType<any>): string {
  // String
  if (schema instanceof z.ZodString) {
    const checks = (schema as any)._def.checks || [];
    const constraints: string[] = [];

    for (const check of checks) {
      if (check.kind === 'email') constraints.push('email');
      if (check.kind === 'url') constraints.push('url');
      if (check.kind === 'uuid') constraints.push('uuid');
      if (check.kind === 'min') constraints.push(`min: ${check.value}`);
      if (check.kind === 'max') constraints.push(`max: ${check.value}`);
    }

    return constraints.length > 0 ? `string (${constraints.join(', ')})` : 'string';
  }

  // Number
  if (schema instanceof z.ZodNumber) {
    const checks = (schema as any)._def.checks || [];
    const constraints: string[] = [];

    for (const check of checks) {
      if (check.kind === 'int') constraints.push('integer');
      if (check.kind === 'min')
        constraints.push(`min: ${check.value}${check.inclusive ? '' : ' (exclusive)'}`);
      if (check.kind === 'max')
        constraints.push(`max: ${check.value}${check.inclusive ? '' : ' (exclusive)'}`);
    }

    return constraints.length > 0 ? `number (${constraints.join(', ')})` : 'number';
  }

  // Boolean
  if (schema instanceof z.ZodBoolean) {
    return 'boolean';
  }

  // Array
  if (schema instanceof z.ZodArray) {
    const elementType = describeZodType((schema as any)._def.type);
    return `array<${elementType}>`;
  }

  // Enum
  if (schema instanceof z.ZodEnum) {
    const values = (schema as any)._def.values;
    return `enum (${values.join(' | ')})`;
  }

  // Literal
  if (schema instanceof z.ZodLiteral) {
    const value = (schema as any)._def.value;
    return typeof value === 'string' ? `"${value}"` : String(value);
  }

  // Union
  if (schema instanceof z.ZodUnion) {
    const options = (schema as any)._def.options;
    return options.map((opt: ZodType<any>) => describeZodType(opt)).join(' | ');
  }

  // Optional
  if (schema instanceof z.ZodOptional) {
    const innerType = describeZodType((schema as any)._def.innerType);
    return `${innerType} (optional)`;
  }

  // Nullable
  if (schema instanceof z.ZodNullable) {
    const innerType = describeZodType((schema as any)._def.innerType);
    return `${innerType} | null`;
  }

  // Object (nested)
  if (schema instanceof z.ZodObject) {
    return 'object {...}';
  }

  // Default fallback
  return 'unknown';
}

/**
 * Zod 스키마에서 description 추출
 */
function getZodDescription(schema: ZodType<any>): string | undefined {
  return (schema as any)._def.description;
}

/**
 * CommonSchemas - Zod 기반 공통 스키마
 */
export const CommonSchemas = {
  /**
   * Code review schema
   */
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

  /**
   * Agent statistics schema
   */
  agentStats: () =>
    z.object({
      agentName: z.string().describe('Agent identifier'),
      status: z.enum(['idle', 'busy']).describe('Current status'),
      tasksCompleted: z.number().min(0).describe('Number of completed tasks'),
      currentTask: z.string().optional().describe('Current task ID'),
      uptime: z.number().min(0).describe('Uptime in milliseconds'),
      performance: z
        .object({
          avgDuration: z.number(),
          avgCost: z.number()
        })
        .describe('Performance metrics')
    }),

  /**
   * Task execution plan schema
   */
  taskPlan: () =>
    z.object({
      taskId: z.string().describe('Task identifier'),
      steps: z
        .array(
          z.object({
            stepNumber: z.number(),
            description: z.string(),
            estimatedDuration: z.string()
          })
        )
        .describe('Execution steps'),
      total_estimated_duration: z.string().describe('Total estimated time'),
      risks: z.array(z.string()).describe('Potential risks')
    }),

  /**
   * Simple review (like structured-json)
   */
  simpleReview: () =>
    z.object({
      review: z.number().min(1).max(10).describe('Quality score'),
      name: z.string().describe('Item name'),
      tags: z.array(z.string()).describe('Tags/categories')
    })
};

/**
 * Zod 스키마로 데이터 검증
 */
export function validateWithZod<T>(
  data: unknown,
  schema: ZodType<T, ZodTypeDef, any>
): { success: true; data: T } | { success: false; error: string; issues: z.ZodIssue[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data
    };
  }

  return {
    success: false,
    error: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
    issues: result.error.errors
  };
}

/**
 * Standard Schema로 데이터 검증
 *
 * Zod v3.24.0+는 Standard Schema를 자동으로 구현합니다.
 */
export async function validateWithStandardSchema<T extends StandardSchemaV1>(
  data: unknown,
  schema: T
): Promise<
  | { success: true; data: StandardSchemaV1.InferOutput<T> }
  | { success: false; error: string; issues: readonly StandardSchemaV1.Issue[] }
> {
  if (!isStandardSchema(schema)) {
    return {
      success: false,
      error: 'Provided schema does not implement Standard Schema',
      issues: []
    };
  }

  const result = await schema['~standard'].validate(data);

  if ('issues' in result && result.issues) {
    return {
      success: false,
      error: result.issues.map((issue) => issue.message).join('; '),
      issues: result.issues
    };
  }

  return {
    success: true,
    data: (result as StandardSchemaV1.SuccessResult<any>).value
  };
}
