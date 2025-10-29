import { ChildProcess } from 'node:child_process';
import * as zod from 'zod';
import { ZodType, ZodTypeDef, z } from 'zod';

/**
 * Type definitions for Claude CLI stream-json output
 * Based on: https://docs.claude.com/en/docs/claude-code/headless.md
 */
interface BaseStreamEvent {
    type: string;
    isSidechain?: boolean;
    [key: string]: unknown;
}
interface SystemInitEvent {
    type: 'system';
    subtype: 'init';
    cwd: string;
    session_id: string;
    tools: string[];
    mcp_servers: Array<{
        name: string;
        status: string;
    }>;
    model: string;
    permissionMode: string;
    slash_commands: string[];
    apiKeySource: string;
    output_style: string;
    agents: string[];
    uuid: string;
    isSidechain?: boolean;
}
interface ToolResultContent {
    type: 'tool_result';
    tool_use_id: string;
    content: string;
}
interface UserMessage {
    role: 'user';
    content: string | ToolResultContent[];
}
interface UserEvent {
    type: 'user';
    message: UserMessage;
    session_id: string;
    parent_tool_use_id: string | null;
    uuid: string;
    isSidechain?: boolean;
}
interface TextContent {
    type: 'text';
    text: string;
}
interface ToolUseContent {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
}
type MessageContent = TextContent | ToolUseContent;
interface AssistantMessage {
    id: string;
    type: 'message';
    role: 'assistant';
    model: string;
    content: MessageContent[];
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: {
        input_tokens: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation?: {
            ephemeral_5m_input_tokens: number;
            ephemeral_1h_input_tokens: number;
        };
        output_tokens: number;
        service_tier: string;
    };
}
interface AssistantEvent {
    type: 'assistant';
    message: AssistantMessage;
    parent_tool_use_id: string | null;
    session_id: string;
    uuid: string;
    isSidechain?: boolean;
}
interface ModelUsage {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    webSearchRequests: number;
    costUSD: number;
    contextWindow: number;
}
interface ResultEvent {
    type: 'result';
    subtype: 'success' | 'error';
    is_error: boolean;
    duration_ms: number;
    duration_api_ms: number;
    num_turns: number;
    result: string;
    session_id: string;
    total_cost_usd: number;
    usage: {
        input_tokens: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
        output_tokens: number;
        server_tool_use?: {
            web_search_requests: number;
        };
        service_tier: string;
        cache_creation?: {
            ephemeral_1h_input_tokens: number;
            ephemeral_5m_input_tokens: number;
        };
    };
    modelUsage: Record<string, ModelUsage>;
    permission_denials: Array<{
        tool_name: string;
        tool_input: Record<string, unknown>;
    }>;
    uuid: string;
    isSidechain?: boolean;
}
interface ErrorEvent {
    type: 'error';
    error: {
        type: string;
        message: string;
    };
    isSidechain?: boolean;
}
type StreamEvent$1 = SystemInitEvent | UserEvent | AssistantEvent | ResultEvent | ErrorEvent | BaseStreamEvent;
declare function isSystemInitEvent(event: StreamEvent$1): event is SystemInitEvent;
declare function isUserEvent(event: StreamEvent$1): event is UserEvent;
declare function isAssistantEvent(event: StreamEvent$1): event is AssistantEvent;
declare function isResultEvent(event: StreamEvent$1): event is ResultEvent;
declare function isErrorEvent(event: StreamEvent$1): event is ErrorEvent;
/**
 * Extract text content from assistant message
 */
declare function extractTextFromMessage(message: AssistantMessage): string;
/**
 * Extract tool uses from assistant message
 */
declare function extractToolUsesFromMessage(message: AssistantMessage): ToolUseContent[];
/**
 * Get session ID from any event that contains it
 */
declare function extractSessionId(event: StreamEvent$1): string | null;

/**
 * StreamParser - Handles line-by-line JSON parsing from Claude CLI stream-json output
 * Now with Zod schema validation for runtime type safety
 */

type StreamCallback = (event: StreamEvent$1) => void;
type ErrorCallback = (error: string) => void;
declare class StreamParser {
    private buffer;
    private onEvent;
    private onError?;
    constructor(onEvent: StreamCallback, onError?: ErrorCallback);
    /**
     * Process incoming data chunk from stdout
     */
    processChunk(chunk: Buffer | string): void;
    /**
     * Parse a single line as JSON with runtime validation
     */
    private parseLine;
    /**
     * Flush any remaining data in buffer (call on stream end)
     */
    flush(): void;
    /**
     * Reset parser state
     */
    reset(): void;
}

/**
 * ClaudeClient - Manages Claude CLI execution with stream-json I/O
 */

interface ClaudeClientOptions {
    cwd: string;
    model?: 'sonnet' | 'opus' | 'heroku';
    onStream: StreamCallback;
    onError?: ErrorCallback;
    onClose?: (code: number) => void;
    sessionId?: string;
    mcpConfig?: string;
    skillId?: string;
    skillScope?: 'global' | 'project';
}
declare class ClaudeClient {
    private process;
    private parser;
    private options;
    private currentSessionId;
    constructor(options: ClaudeClientOptions);
    /**
     * Execute a query with Claude CLI
     */
    execute(query: string): ChildProcess;
    /**
     * Setup stdout, stderr, and close handlers
     */
    private setupProcessHandlers;
    /**
     * Handle parsed stream events
     */
    private handleStreamEvent;
    /**
     * Get current session ID
     */
    getSessionId(): string | null;
    /**
     * Kill the running process
     */
    kill(): void;
    /**
     * Cleanup internal state
     */
    private cleanup;
    /**
     * Check if process is running
     */
    isRunning(): boolean;
}

/**
 * SessionManager - Manages Claude CLI sessions and their history
 */
interface SessionInfo {
    sessionId: string;
    cwd: string;
    query: string;
    timestamp: number;
    lastResult?: string;
}
declare class SessionManager {
    private sessions;
    private currentSessionId;
    /**
     * Create or update a session
     */
    saveSession(sessionId: string, info: Omit<SessionInfo, 'sessionId'>): void;
    /**
     * Get session by ID
     */
    getSession(sessionId: string): SessionInfo | undefined;
    /**
     * Get all sessions sorted by timestamp (most recent first)
     */
    getAllSessions(): SessionInfo[];
    /**
     * Get current session ID
     */
    getCurrentSessionId(): string | null;
    /**
     * Set current session ID
     */
    setCurrentSessionId(sessionId: string | null): void;
    /**
     * Update session with result
     */
    updateSessionResult(sessionId: string, result: string): void;
    /**
     * Clear all sessions
     */
    clearSessions(): void;
    /**
     * Remove a specific session
     */
    removeSession(sessionId: string): boolean;
    /**
     * Get session count
     */
    getSessionCount(): number;
}

/**
 * ProcessManager - Manages multiple Claude CLI executions
 *
 * Enables parallel execution of Claude CLI sessions with independent
 * stream handling and execution lifecycle management.
 *
 * Uses sessionId (from Claude CLI session logs) as the primary identifier
 * for tracking executions, enabling persistence and recovery.
 */

type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'killed';
interface ExecutionInfo {
    sessionId: string;
    projectPath: string;
    query: string;
    status: ExecutionStatus;
    pid: number | null;
    client: ClaudeClient;
    events: StreamEvent$1[];
    errors: string[];
    startTime: number;
    endTime: number | null;
    mcpConfig?: string;
    model?: 'sonnet' | 'opus' | 'heroku';
    skillId?: string;
    skillScope?: 'global' | 'project';
    outputStyle?: string;
    agentName?: string;
    taskId?: string;
}
interface StartExecutionParams {
    projectPath: string;
    query: string;
    sessionId?: string;
    mcpConfig?: string;
    model?: 'sonnet' | 'opus' | 'heroku';
    skillId?: string;
    skillScope?: 'global' | 'project';
    outputStyle?: string;
    agentName?: string;
    taskId?: string;
    onStream?: (sessionId: string, event: StreamEvent$1) => void;
    onError?: (sessionId: string, error: string) => void;
    onComplete?: (sessionId: string, code: number) => void;
}
declare class ProcessManager {
    private executions;
    private maxConcurrent;
    private executionsChangeListener?;
    /**
     * Set listener for executions state changes
     */
    setExecutionsChangeListener(listener: () => void): void;
    /**
     * Notify listeners of executions state change
     */
    private notifyExecutionsChanged;
    /**
     * Start a new execution
     * Returns a Promise that resolves with sessionId once it's received from Claude CLI
     */
    startExecution(params: StartExecutionParams): Promise<string>;
    /**
     * Get execution info by sessionId
     */
    getExecution(sessionId: string): ExecutionInfo | undefined;
    /**
     * Get all executions
     */
    getAllExecutions(): ExecutionInfo[];
    /**
     * Get active (running or pending) executions
     */
    getActiveExecutions(): ExecutionInfo[];
    /**
     * Get completed executions
     */
    getCompletedExecutions(): ExecutionInfo[];
    /**
     * Kill an execution
     */
    killExecution(sessionId: string): void;
    /**
     * Clean up an execution (remove from memory)
     */
    cleanupExecution(sessionId: string): void;
    /**
     * Clean up all completed executions
     */
    cleanupAllCompleted(): number;
    /**
     * Kill all active executions
     */
    killAll(): void;
    /**
     * Get execution statistics
     */
    getStats(): {
        total: number;
        running: number;
        pending: number;
        completed: number;
        failed: number;
        killed: number;
    };
    /**
     * Set maximum concurrent executions
     */
    setMaxConcurrent(max: number): void;
    /**
     * Get maximum concurrent executions
     */
    getMaxConcurrent(): number;
}
declare const processManager: ProcessManager;

/**
 * Zod Schema Builder - Standard Schema 기반 검증 시스템
 *
 * Features:
 * - Zod를 사용한 런타임 검증 (Standard Schema 준수)
 * - Zod 스키마 → 프롬프트 변환 (Claude 가이드용)
 * - Output-style은 힌트, 실제 검증은 Zod
 */

/**
 * Standard Schema V1 인터페이스
 */
interface StandardSchemaV1<Input = unknown, Output = Input> {
    readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}
declare namespace StandardSchemaV1 {
    interface Props<Input = unknown, Output = Input> {
        readonly version: 1;
        readonly vendor: string;
        readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
        readonly types?: Types<Input, Output>;
    }
    type Result<Output> = SuccessResult<Output> | FailureResult;
    interface SuccessResult<Output> {
        readonly value: Output;
        readonly issues?: undefined;
    }
    interface FailureResult {
        readonly issues: ReadonlyArray<Issue>;
    }
    interface Issue {
        readonly message: string;
        readonly path?: ReadonlyArray<PropertyKey>;
    }
    interface Types<Input = unknown, Output = Input> {
        readonly input: Input;
        readonly output: Output;
    }
    type InferInput<T extends StandardSchemaV1> = T['~standard']['types'] extends {
        input: infer I;
    } ? I : never;
    type InferOutput<T extends StandardSchemaV1> = T['~standard']['types'] extends {
        output: infer O;
    } ? O : never;
}
/**
 * Zod 스키마를 프롬프트 문자열로 변환
 *
 * Output-style은 힌트 역할만 하고, 실제 검증은 Zod가 수행
 */
declare function zodSchemaToPrompt<T extends ZodType<any, any, any>>(schema: T, instruction?: string): string;
/**
 * CommonSchemas - Zod 기반 공통 스키마
 */
declare const CommonSchemas: {
    /**
     * Code review schema
     */
    codeReview: () => z.ZodObject<{
        file: z.ZodString;
        review: z.ZodNumber;
        complexity: z.ZodNumber;
        maintainability: z.ZodNumber;
        issues: z.ZodArray<z.ZodObject<{
            severity: z.ZodEnum<["low", "medium", "high"]>;
            message: z.ZodString;
            line: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            message: string;
            severity: "low" | "medium" | "high";
            line?: number | undefined;
        }, {
            message: string;
            severity: "low" | "medium" | "high";
            line?: number | undefined;
        }>, "many">;
        suggestions: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        issues: {
            message: string;
            severity: "low" | "medium" | "high";
            line?: number | undefined;
        }[];
        file: string;
        review: number;
        complexity: number;
        maintainability: number;
        suggestions: string[];
    }, {
        issues: {
            message: string;
            severity: "low" | "medium" | "high";
            line?: number | undefined;
        }[];
        file: string;
        review: number;
        complexity: number;
        maintainability: number;
        suggestions: string[];
    }>;
    /**
     * Agent statistics schema
     */
    agentStats: () => z.ZodObject<{
        agentName: z.ZodString;
        status: z.ZodEnum<["idle", "busy"]>;
        tasksCompleted: z.ZodNumber;
        currentTask: z.ZodOptional<z.ZodString>;
        uptime: z.ZodNumber;
        performance: z.ZodObject<{
            avgDuration: z.ZodNumber;
            avgCost: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            avgDuration: number;
            avgCost: number;
        }, {
            avgDuration: number;
            avgCost: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        status: "idle" | "busy";
        agentName: string;
        tasksCompleted: number;
        uptime: number;
        performance: {
            avgDuration: number;
            avgCost: number;
        };
        currentTask?: string | undefined;
    }, {
        status: "idle" | "busy";
        agentName: string;
        tasksCompleted: number;
        uptime: number;
        performance: {
            avgDuration: number;
            avgCost: number;
        };
        currentTask?: string | undefined;
    }>;
    /**
     * Task execution plan schema
     */
    taskPlan: () => z.ZodObject<{
        taskId: z.ZodString;
        steps: z.ZodArray<z.ZodObject<{
            stepNumber: z.ZodNumber;
            description: z.ZodString;
            estimatedDuration: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            stepNumber: number;
            description: string;
            estimatedDuration: string;
        }, {
            stepNumber: number;
            description: string;
            estimatedDuration: string;
        }>, "many">;
        total_estimated_duration: z.ZodString;
        risks: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        taskId: string;
        steps: {
            stepNumber: number;
            description: string;
            estimatedDuration: string;
        }[];
        total_estimated_duration: string;
        risks: string[];
    }, {
        taskId: string;
        steps: {
            stepNumber: number;
            description: string;
            estimatedDuration: string;
        }[];
        total_estimated_duration: string;
        risks: string[];
    }>;
    /**
     * Simple review (like structured-json)
     */
    simpleReview: () => z.ZodObject<{
        review: z.ZodNumber;
        name: z.ZodString;
        tags: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        review: number;
        tags: string[];
    }, {
        name: string;
        review: number;
        tags: string[];
    }>;
};
/**
 * Zod 스키마로 데이터 검증
 */
declare function validateWithZod<T>(data: unknown, schema: ZodType<T, ZodTypeDef, any>): {
    success: true;
    data: T;
} | {
    success: false;
    error: string;
    issues: z.ZodIssue[];
};
/**
 * Standard Schema로 데이터 검증
 *
 * Zod v3.24.0+는 Standard Schema를 자동으로 구현합니다.
 */
declare function validateWithStandardSchema<T extends StandardSchemaV1>(data: unknown, schema: T): Promise<{
    success: true;
    data: StandardSchemaV1.InferOutput<T>;
} | {
    success: false;
    error: string;
    issues: readonly StandardSchemaV1.Issue[];
}>;

/**
 * JSON Extractor - Clean JSON extraction from Claude responses
 *
 * Handles common issues:
 * - Markdown code blocks (```json ... ```)
 * - Explanatory text before/after JSON
 * - Multiple JSON objects
 * - Invalid JSON with fixable issues
 */
interface JSONExtractionResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    raw?: string;
    cleanedText?: string;
}
/**
 * Extract clean JSON from text that may contain markdown, explanations, etc.
 */
declare function extractJSON<T = any>(text: string): JSONExtractionResult<T>;
/**
 * Extract and validate structured JSON
 */
declare function extractAndValidate<T extends Record<string, any>>(text: string, requiredFields: (keyof T)[]): JSONExtractionResult<T>;

/**
 * Schema Builder - Build JSON schema prompts for Claude
 *
 * Helps construct type-safe queries with explicit JSON schemas
 */
type JSONType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
interface FieldSchema {
    type: JSONType;
    description?: string;
    required?: boolean;
    arrayItemType?: JSONType;
    objectSchema?: Record<string, FieldSchema>;
    enum?: any[];
    min?: number;
    max?: number;
}
interface JSONSchema {
    [key: string]: FieldSchema;
}
/**
 * Build a JSON schema prompt string
 */
declare function buildSchemaPrompt(schema: JSONSchema, instruction?: string): string;
/**
 * Validate data against schema (runtime check)
 */
declare function validateAgainstSchema(data: unknown, schema: JSONSchema): {
    valid: boolean;
    errors: string[];
};

interface QueryOptions {
    /**
     * Output style to force (e.g., 'structured-json', 'default', 'explanatory')
     */
    outputStyle?: string;
    /**
     * Model to use
     */
    model?: 'sonnet' | 'opus' | 'haiku';
    /**
     * MCP config path
     */
    mcpConfig?: string;
    /**
     * Filter thinking blocks from response
     */
    filterThinking?: boolean;
    /**
     * Timeout in milliseconds
     */
    timeout?: number;
}
interface QueryResult {
    /**
     * Final result text (thinking filtered if requested)
     */
    result: string;
    /**
     * All assistant messages (thinking filtered if requested)
     */
    messages: string[];
    /**
     * Raw events (for debugging)
     */
    events: StreamEvent[];
    /**
     * Execution metadata
     */
    metadata: {
        totalCost: number;
        durationMs: number;
        numTurns: number;
        outputStyle?: string;
    };
}
interface StreamEvent {
    type: string;
    subtype?: string;
    [key: string]: any;
}
declare class ClaudeQueryAPI {
    private runningProcess;
    /**
     * Execute a query with output-style and get clean results
     */
    query(projectPath: string, query: string, options?: QueryOptions): Promise<QueryResult>;
    /**
     * Build query with output-style injection
     */
    private buildQuery;
    /**
     * Execute Claude process and collect events
     */
    private executeClaudeProcess;
    /**
     * Filter thinking blocks from events
     */
    private filterThinkingBlocks;
    /**
     * Extract final result from events
     */
    private extractResult;
    /**
     * Extract all assistant messages
     */
    private extractMessages;
    /**
     * Extract execution metadata
     */
    private extractMetadata;
    /**
     * Execute query and extract JSON result
     *
     * Automatically:
     * - Uses 'structured-json' output-style
     * - Filters thinking blocks
     * - Extracts and validates JSON
     */
    queryJSON<T = any>(projectPath: string, query: string, options?: Omit<QueryOptions, 'outputStyle' | 'filterThinking'> & {
        requiredFields?: (keyof T)[];
    }): Promise<JSONExtractionResult<T>>;
    /**
     * Execute query and get typed JSON result with validation
     */
    queryTypedJSON<T extends Record<string, any>>(projectPath: string, query: string, requiredFields: (keyof T)[], options?: Omit<QueryOptions, 'outputStyle' | 'filterThinking'>): Promise<JSONExtractionResult<T>>;
    /**
     * Execute query with explicit JSON schema
     *
     * Automatically injects schema into prompt and validates response
     */
    queryWithSchema<T = any>(projectPath: string, instruction: string, schema: JSONSchema, options?: Omit<QueryOptions, 'outputStyle' | 'filterThinking'>): Promise<JSONExtractionResult<T>>;
    /**
     * Kill running process
     */
    kill(): void;
    /**
     * Execute query with Zod schema validation (Standard Schema compliant)
     *
     * Output-style은 힌트 역할, 실제 검증은 Zod가 수행
     *
     * @example
     * ```typescript
     * import { z } from 'zod';
     *
     * const schema = z.object({
     *   file: z.string(),
     *   complexity: z.number().min(1).max(20)
     * });
     *
     * const result = await api.queryWithZod(
     *   projectPath,
     *   'Analyze src/main.ts',
     *   schema
     * );
     *
     * if (result.success) {
     *   console.log(result.data.file);
     * }
     * ```
     */
    queryWithZod<T>(projectPath: string, instruction: string, schema: zod.ZodType<T>, options?: Omit<QueryOptions, 'outputStyle' | 'filterThinking'>): Promise<JSONExtractionResult<T>>;
    /**
     * Execute query with Standard Schema validation
     *
     * Zod v3.24.0+ 스키마는 자동으로 Standard Schema를 구현합니다.
     *
     * @example
     * ```typescript
     * import { z } from 'zod';
     *
     * const schema = z.object({
     *   name: z.string(),
     *   age: z.number()
     * });
     *
     * const result = await api.queryWithStandardSchema(
     *   projectPath,
     *   'Get user info',
     *   schema
     * );
     * ```
     */
    queryWithStandardSchema<T extends StandardSchemaV1>(projectPath: string, instruction: string, schema: T, options?: Omit<QueryOptions, 'outputStyle' | 'filterThinking'>): Promise<JSONExtractionResult<StandardSchemaV1.InferOutput<T>>>;
}

/**
 * Error class hierarchy for the application
 *
 * Provides structured error types for better error handling and debugging.
 * All custom errors extend AppError with specific codes and contexts.
 */
declare class AppError extends Error {
    readonly code: string;
    readonly context?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, context?: Record<string, unknown> | undefined);
    /**
     * Convert error to JSON for logging/serialization
     */
    toJSON(): Record<string, unknown>;
}
declare class ExecutionError extends AppError {
    constructor(message: string, code: string, context?: Record<string, unknown>);
}
declare class ProcessStartError extends ExecutionError {
    constructor(message: string, context?: Record<string, unknown>);
}
declare class ProcessKillError extends ExecutionError {
    constructor(message: string, context?: Record<string, unknown>);
}
declare class MaxConcurrentError extends ExecutionError {
    constructor(maxConcurrent: number, context?: Record<string, unknown>);
}
declare class ExecutionNotFoundError extends ExecutionError {
    constructor(sessionId: string, context?: Record<string, unknown>);
}
declare class ValidationError extends AppError {
    constructor(message: string, code: string, context?: Record<string, unknown>);
}

/**
 * Entry Point System Types
 *
 * Entry Point는 output style, 옵션, 스키마를 미리 설정해두고
 * 쿼리만 받아서 일관된 형식으로 실행하는 진입점입니다.
 */
/**
 * 출력 형식 정의
 */
interface OutputFormat {
    /** 출력 타입 */
    type: 'text' | 'json' | 'structured';
    /** 스키마 파일 경로 (structured인 경우) */
    schema?: string;
    /** 스키마 이름 (미리 정의된 스키마) */
    schemaName?: string;
}
/**
 * 진입점 설정
 */
interface EntryPointConfig {
    /** 진입점 이름 (고유 ID) */
    name: string;
    /** 진입점 설명 */
    description: string;
    /** 출력 스타일 이름 (.claude/output-styles/*.md) */
    outputStyle?: string;
    /** 출력 형식 */
    outputFormat: OutputFormat;
    /** 실행 옵션 */
    options?: {
        /** 모델 선택 */
        model?: 'sonnet' | 'opus' | 'haiku';
        /** MCP 설정 파일 경로 */
        mcpConfig?: string;
        /** 타임아웃 (ms) */
        timeout?: number;
        /** Thinking 필터링 여부 */
        filterThinking?: boolean;
    };
    /** 사용 예시 */
    examples?: string[];
    /** 태그 (분류용) */
    tags?: string[];
}
/**
 * 진입점 설정 파일 구조
 */
interface EntryPointsConfig {
    /** 버전 */
    version: string;
    /** 진입점 목록 */
    entryPoints: Record<string, EntryPointConfig>;
}
/**
 * 진입점 실행 파라미터
 */
interface ExecuteEntryPointParams {
    /** 진입점 이름 */
    entryPoint: string;
    /** 실행할 쿼리 */
    query: string;
    /** 프로젝트 경로 */
    projectPath: string;
    /** 옵션 오버라이드 */
    options?: {
        model?: 'sonnet' | 'opus' | 'haiku';
        mcpConfig?: string;
        timeout?: number;
    };
}
/**
 * 진입점 실행 결과
 */
interface EntryPointResult<T = any> {
    /** 성공 여부 */
    success: boolean;
    /** 파싱된 데이터 (structured인 경우) */
    data?: T;
    /** 원본 텍스트 결과 */
    rawResult?: string;
    /** 에러 메시지 */
    error?: string;
    /** 실행 메타데이터 */
    metadata: {
        entryPoint: string;
        duration: number;
        model: string;
        tokens?: {
            input: number;
            output: number;
        };
    };
}
/**
 * 스키마 정의
 */
interface SchemaDefinition {
    /** 스키마 이름 */
    name: string;
    /** 스키마 설명 */
    description: string;
    /** JSON Schema */
    schema: Record<string, any>;
    /** 예제 데이터 */
    examples?: any[];
}
/**
 * 진입점 검증 결과
 */
interface ValidationResult {
    /** 유효 여부 */
    valid: boolean;
    /** 에러 메시지 */
    errors: string[];
    /** 경고 메시지 */
    warnings: string[];
}

/**
 * Entry Point Manager
 *
 * 진입점 설정 파일을 관리하는 클래스
 * Convention: .claude/entry-points.json
 */

declare class EntryPointManager {
    private configPath;
    private cachedConfig;
    constructor(projectPath: string);
    /**
     * 설정 파일 초기화
     */
    private ensureConfigFile;
    /**
     * 설정 로드
     */
    private loadConfig;
    /**
     * 설정 저장
     */
    private saveConfig;
    /**
     * 진입점 추가/업데이트
     */
    setEntryPoint(config: EntryPointConfig): void;
    /**
     * 진입점 조회
     */
    getEntryPoint(name: string): EntryPointConfig | null;
    /**
     * 모든 진입점 조회
     */
    getAllEntryPoints(): Record<string, EntryPointConfig>;
    /**
     * 진입점 목록 조회
     */
    listEntryPoints(): string[];
    /**
     * 진입점 삭제
     */
    deleteEntryPoint(name: string): boolean;
    /**
     * 진입점 존재 여부 확인
     */
    entryPointExists(name: string): boolean;
    /**
     * 진입점 검증
     */
    validateEntryPoint(config: EntryPointConfig): ValidationResult;
    /**
     * 태그로 진입점 필터링
     */
    filterByTag(tag: string): EntryPointConfig[];
    /**
     * 진입점 검색
     */
    searchEntryPoints(query: string): EntryPointConfig[];
    /**
     * 캐시 초기화
     */
    clearCache(): void;
    /**
     * 설정 파일 경로 반환
     */
    getConfigPath(): string;
}

/**
 * Schema Manager
 *
 * JSON 스키마 파일들을 관리하는 클래스
 * Convention: .claude/schemas/*.json
 */

declare class SchemaManager {
    private schemasDir;
    private cachedSchemas;
    constructor(projectPath: string);
    /**
     * 스키마 디렉토리 생성
     */
    private ensureSchemasDir;
    /**
     * 스키마 로드
     */
    loadSchema(schemaName: string): SchemaDefinition | null;
    /**
     * 스키마 저장
     */
    saveSchema(schema: SchemaDefinition): void;
    /**
     * 모든 스키마 목록 조회
     */
    listSchemas(): string[];
    /**
     * 스키마 삭제
     */
    deleteSchema(schemaName: string): boolean;
    /**
     * 스키마 존재 여부 확인
     */
    schemaExists(schemaName: string): boolean;
    /**
     * 캐시 초기화
     */
    clearCache(): void;
    /**
     * 스키마 디렉토리 경로 반환
     */
    getSchemasDir(): string;
}

declare class EntryPointExecutor {
    private entryPointManager;
    private schemaManager;
    private queryAPI;
    constructor(projectPath: string);
    /**
     * 진입점을 통해 쿼리 실행
     */
    execute<T = any>(params: ExecuteEntryPointParams): Promise<EntryPointResult<T>>;
    /**
     * Structured 형식으로 실행 (스키마 검증)
     */
    private executeStructured;
    /**
     * JSON 형식으로 실행 (스키마 없음)
     */
    private executeJSON;
    /**
     * Text 형식으로 실행
     */
    private executeText;
    /**
     * 진입점 목록 조회
     */
    listEntryPoints(): string[];
    /**
     * 진입점 상세 조회
     */
    getEntryPointInfo(name: string): EntryPointConfig | null;
    /**
     * 쿼리 API 인스턴스 반환 (Kill 등을 위해)
     */
    getQueryAPI(): ClaudeQueryAPI;
}

export { type AssistantEvent, ClaudeClient, type ClaudeClientOptions, ClaudeQueryAPI, CommonSchemas, type EntryPointConfig, EntryPointExecutor, EntryPointManager, type EntryPointResult, type EntryPointsConfig, type ErrorEvent, type ExecuteEntryPointParams, type ExecutionInfo, ExecutionNotFoundError, type ExecutionStatus, type JSONExtractionResult, type JSONSchema, MaxConcurrentError, type OutputFormat, ProcessKillError, ProcessManager, ProcessStartError, type QueryOptions, type QueryResult, type ResultEvent, type SchemaDefinition, SchemaManager, type SessionInfo, SessionManager, StandardSchemaV1, type StartExecutionParams, type StreamEvent$1 as StreamEvent, StreamParser, type SystemInitEvent, type UserEvent, ValidationError, type ValidationResult, buildSchemaPrompt, extractAndValidate, extractJSON, extractSessionId, extractTextFromMessage, extractToolUsesFromMessage, isAssistantEvent, isErrorEvent, isResultEvent, isSystemInitEvent, isUserEvent, processManager, validateAgainstSchema, validateWithStandardSchema, validateWithZod, zodSchemaToPrompt };
