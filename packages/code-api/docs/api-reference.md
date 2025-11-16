# API Reference

Complete API documentation for @context-action/code-api.

## Table of Contents

- [ClaudeClient](#claudeclient)
- [ProcessManager](#processmanager)
- [SessionManager](#sessionmanager)
- [ClaudeQueryAPI](#claudequeryapi)
- [Entry Point System](#entry-point-system)
  - [EntryPointManager](#entrypointmanager)
  - [EntryPointExecutor](#entrypointexecutor)
  - [SchemaManager](#schemamanager)
- [StreamParser](#streamparser)
- [Schema Utilities](#schema-utilities)
- [Error Types](#error-types)

---

## ClaudeClient

Main client for executing Claude CLI commands with stream handling.

### Constructor

```typescript
new ClaudeClient(options: ClaudeClientOptions)
```

**Options:**

```typescript
interface ClaudeClientOptions {
  cwd: string;                              // Working directory
  model?: 'sonnet' | 'opus' | 'haiku';     // Claude model (default: 'sonnet')
  sessionId?: string;                       // Resume session ID
  mcpConfig?: string;                       // MCP config file path
  onStream?: (event: StreamEvent) => void;  // Stream event callback
  onError?: (error: string) => void;        // Error callback
  onComplete?: (code: number) => void;      // Completion callback
}
```

### Methods

#### `execute(query: string): void`

Execute a query through Claude CLI.

**Parameters:**
- `query` - Query string to execute

**Example:**
```typescript
const client = new ClaudeClient({
  cwd: './my-project',
  onStream: (event) => {
    if (event.type === 'message') {
      console.log(event.message.content);
    }
  }
});

client.execute('Explain the main.ts file');
```

#### `kill(): void`

Kill the running Claude CLI process.

**Example:**
```typescript
client.kill();
```

---

## ProcessManager

Manage multiple concurrent Claude CLI executions with lifecycle management.

### Constructor

```typescript
new ProcessManager(maxConcurrent?: number)
```

**Parameters:**
- `maxConcurrent` - Maximum concurrent executions (default: 3)

### Methods

#### `startExecution(params: StartExecutionParams): Promise<string>`

Start a new Claude CLI execution.

**Parameters:**

```typescript
interface StartExecutionParams {
  projectPath: string;                      // Project directory
  query: string;                            // Query to execute
  sessionId?: string;                       // Resume session ID
  mcpConfig?: string;                       // MCP config path
  model?: 'sonnet' | 'opus' | 'haiku';     // Claude model
  skillId?: string;                         // Skill ID to use
  skillScope?: 'global' | 'project';       // Skill scope
  outputStyle?: string;                     // Output style ID
  onStream?: (sessionId: string, event: StreamEvent) => void;
  onError?: (sessionId: string, error: string) => void;
  onComplete?: (sessionId: string, code: number) => void;
}
```

**Returns:** Session ID (string)

**Throws:**
- `MaxConcurrentError` - If max concurrent limit reached

**Example:**
```typescript
const manager = new ProcessManager(5);

const sessionId = await manager.startExecution({
  projectPath: './my-project',
  query: 'Fix the authentication bug',
  onStream: (sid, event) => {
    console.log(`[${sid}]`, event);
  }
});
```

#### `killExecution(sessionId: string): void`

Kill a running execution.

**Parameters:**
- `sessionId` - Session ID to kill

**Throws:**
- `ExecutionNotFoundError` - If session not found
- `ProcessKillError` - If process cannot be killed

**Example:**
```typescript
manager.killExecution(sessionId);
```

#### `getExecution(sessionId: string): ExecutionInfo | undefined`

Get execution information.

**Parameters:**
- `sessionId` - Session ID

**Returns:** ExecutionInfo or undefined

```typescript
interface ExecutionInfo {
  sessionId: string;
  pid: number | null;
  status: ExecutionStatus;
  projectPath: string;
  query: string;
  events: StreamEvent[];
  skillId?: string;
  skillScope?: 'global' | 'project';
  createdAt: Date;
  completedAt?: Date;
}

type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';
```

#### `getAllExecutions(): ExecutionInfo[]`

Get all executions.

**Returns:** Array of ExecutionInfo

#### `getActiveExecutions(): ExecutionInfo[]`

Get only active (pending/running) executions.

#### `getCompletedExecutions(): ExecutionInfo[]`

Get only completed executions.

#### `cleanupExecution(sessionId: string): void`

Remove execution from history.

#### `cleanupAllCompleted(): void`

Remove all completed executions.

#### `killAll(): void`

Kill all running executions.

#### `getStats(): ExecutionStats`

Get execution statistics.

**Returns:**
```typescript
interface ExecutionStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  active: number;
}
```

#### `setMaxConcurrent(max: number): void`

Update max concurrent limit.

**Parameters:**
- `max` - New maximum (1-10)

**Throws:**
- `Error` - If max out of range

---

## SessionManager

Track and persist Claude CLI sessions.

### Constructor

```typescript
new SessionManager()
```

### Methods

#### `addSession(info: SessionInfo): void`

Add session to history.

**Parameters:**
```typescript
interface SessionInfo {
  sessionId: string;
  projectPath: string;
  query: string;
  timestamp: number;
  status: ExecutionStatus;
}
```

#### `getSession(sessionId: string): SessionInfo | undefined`

Get session by ID.

#### `getAllSessions(): SessionInfo[]`

Get all sessions.

#### `getProjectSessions(projectPath: string): SessionInfo[]`

Get sessions for a specific project.

---

## ClaudeQueryAPI

Execute queries with automatic JSON extraction and schema validation.

### Constructor

```typescript
new ClaudeQueryAPI()
```

### Methods

#### `queryWithZod<T>(projectPath, instruction, schema, options?): Promise<JSONExtractionResult<T>>`

Execute query with Zod schema validation.

**Parameters:**
- `projectPath` - Project directory
- `instruction` - Query instruction
- `schema` - Zod schema
- `options` - Query options (optional)

**Returns:**
```typescript
interface JSONExtractionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  raw?: string;
  validationErrors?: string[];
}
```

**Example:**
```typescript
import { ClaudeQueryAPI } from '@context-action/code-api';
import { z } from 'zod';

const api = new ClaudeQueryAPI();

const schema = z.object({
  summary: z.string(),
  issues: z.array(z.string()),
  score: z.number().min(1).max(10)
});

const result = await api.queryWithZod(
  './my-project',
  'Analyze code quality in src/auth.ts',
  schema,
  { model: 'opus', timeout: 60000 }
);

if (result.success) {
  console.log('Summary:', result.data.summary);
  console.log('Issues:', result.data.issues);
  console.log('Score:', result.data.score);
} else {
  console.error('Error:', result.error);
}
```

#### `queryWithStandardSchema<T>(projectPath, instruction, schema, options?): Promise<JSONExtractionResult<T>>`

Execute query with Standard Schema validation.

**Parameters:**
- `projectPath` - Project directory
- `instruction` - Query instruction
- `schema` - StandardSchemaV1 schema
- `options` - Query options

**Returns:** JSONExtractionResult<T>

**Options:**
```typescript
interface QueryOptions {
  model?: 'sonnet' | 'opus' | 'haiku';
  timeout?: number;
  mcpConfig?: string;
  sessionId?: string;
}
```

---

## Entry Point System

Pre-configured execution contexts with schema management.

### EntryPointManager

Manage entry point configurations.

#### Constructor

```typescript
new EntryPointManager(projectPath: string)
```

#### Methods

##### `getEntryPoints(): EntryPointConfig[]`

Get all entry points.

##### `getEntryPoint(name: string): EntryPointConfig | undefined`

Get entry point by name.

##### `setEntryPoint(config: EntryPointConfig): void`

Create or update entry point.

**Validates:**
- Schema existence for `structured` output type
- Configuration validity

**Throws:**
- `ValidationError` - If schema not found or config invalid

**Example:**
```typescript
const manager = new EntryPointManager('./my-project');

manager.setEntryPoint({
  name: 'code-review',
  description: 'Code quality analysis',
  outputFormat: {
    type: 'structured',
    schemaName: 'code-review'  // Must exist in workflow/schemas/
  },
  options: {
    model: 'opus',
    timeout: 120000
  },
  tags: ['quality', 'review']
});
```

##### `deleteEntryPoint(name: string): void`

Delete entry point.

##### `getEntryPointDetail(name: string): EntryPointDetail`

Get detailed information including expected output schema.

**Returns:**
```typescript
interface EntryPointDetail {
  config: EntryPointConfig;
  expectedOutput: {
    type: 'text' | 'json' | 'structured';
    description: string;
    fields?: Record<string, FieldDefinition>;
    examples?: unknown[];
  };
}
```

**Example:**
```typescript
const detail = manager.getEntryPointDetail('code-review');

console.log('Output Type:', detail.expectedOutput.type);
if (detail.expectedOutput.fields) {
  Object.entries(detail.expectedOutput.fields).forEach(([key, field]) => {
    console.log(`- ${key}: ${field.type} ${field.required ? '(required)' : ''}`);
  });
}
```

---

### EntryPointExecutor

Execute queries through configured entry points.

#### Constructor

```typescript
new EntryPointExecutor(projectPath: string)
```

#### Methods

##### `execute(params: ExecuteEntryPointParams): Promise<EntryPointResult>`

Execute entry point.

**Parameters:**
```typescript
interface ExecuteEntryPointParams {
  entryPoint: string;      // Entry point name
  projectPath: string;     // Project directory
  query: string;           // Query to execute
}
```

**Returns:**
```typescript
interface EntryPointResult {
  success: boolean;
  data?: unknown;          // Parsed and validated data
  error?: string;
  validationErrors?: string[];
  sessionId: string;
  executionTime: number;
}
```

**Example:**
```typescript
const executor = new EntryPointExecutor('./my-project');

const result = await executor.execute({
  entryPoint: 'code-review',
  projectPath: './my-project',
  query: 'Review src/auth.ts for security issues'
});

if (result.success) {
  console.log('Review:', result.data);
  console.log('Execution time:', result.executionTime, 'ms');
}
```

---

### SchemaManager

Manage JSON schemas for structured output.

#### Constructor

```typescript
new SchemaManager(projectPath: string)
```

#### Methods

##### `getSchemas(): SchemaDefinition[]`

Get all schemas.

##### `getSchema(name: string): SchemaDefinition | undefined`

Get schema by name.

##### `saveSchema(schema: SchemaDefinition): void`

Save schema to workflow/schemas/.

**Parameters:**
```typescript
interface SchemaDefinition {
  name: string;
  description: string;
  schema: Record<string, FieldDefinition>;
}

interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  min?: number;
  max?: number;
  arrayItemType?: string;
  properties?: Record<string, FieldDefinition>;
}
```

**Example:**
```typescript
const schemaManager = new SchemaManager('./my-project');

schemaManager.saveSchema({
  name: 'bug-report',
  description: 'Structured bug report',
  schema: {
    severity: {
      type: 'string',
      description: 'Bug severity (low/medium/high/critical)',
      required: true
    },
    title: {
      type: 'string',
      description: 'Short bug description',
      required: true
    },
    steps: {
      type: 'array',
      arrayItemType: 'string',
      description: 'Steps to reproduce',
      required: true
    },
    impact: {
      type: 'number',
      description: 'Impact score 1-10',
      min: 1,
      max: 10,
      required: false
    }
  }
});
```

##### `deleteSchema(name: string): void`

Delete schema.

##### `validateSchema(data: unknown, schemaName: string): ValidationResult`

Validate data against schema.

**Returns:**
```typescript
interface ValidationResult {
  valid: boolean;
  errors?: string[];
}
```

---

## StreamParser

Parse Claude CLI stream JSON output.

### Constructor

```typescript
new StreamParser(
  onEvent: StreamCallback,
  onError?: ErrorCallback
)
```

**Callbacks:**
```typescript
type StreamCallback = (event: StreamEvent) => void;
type ErrorCallback = (error: string) => void;
```

### Methods

#### `processChunk(chunk: string): void`

Process incoming stream chunk.

**Parameters:**
- `chunk` - Raw stream data

#### `getBuffer(): string`

Get current buffer content.

---

## Schema Utilities

### JSON Extraction

#### `extractJSON(text: string): { success: boolean; data?: unknown; error?: string }`

Extract JSON from text.

#### `extractAndValidate<T>(text: string, schema: ZodType<T>): JSONExtractionResult<T>`

Extract and validate JSON with Zod schema.

### Schema Building

#### `buildSchemaPrompt(schema: JSONSchema): string`

Build schema description for Claude prompt.

#### `validateAgainstSchema(data: unknown, schema: JSONSchema): ValidationResult`

Validate data against JSON schema.

### Zod Integration

#### `validateWithZod<T>(data: unknown, schema: ZodType<T>): ValidationResult`

Validate with Zod schema.

#### `zodSchemaToPrompt(schema: ZodType): string`

Convert Zod schema to prompt description.

#### `validateWithStandardSchema(data: unknown, schema: StandardSchemaV1): ValidationResult`

Validate with Standard Schema.

---

## Error Types

### ProcessStartError

Thrown when process fails to start.

```typescript
class ProcessStartError extends Error {
  constructor(message: string, public readonly details?: unknown)
}
```

### ProcessKillError

Thrown when process kill fails.

### ExecutionNotFoundError

Thrown when execution not found.

### MaxConcurrentError

Thrown when max concurrent limit reached.

### ValidationError

Thrown when validation fails.

```typescript
class ValidationError extends Error {
  constructor(
    message: string,
    public readonly errors?: string[]
  )
}
```

---

## Event Types

### StreamEvent

Union type of all stream events:

```typescript
type StreamEvent =
  | SystemInitEvent
  | UserEvent
  | AssistantEvent
  | ErrorEvent
  | ResultEvent;
```

### SystemInitEvent

```typescript
interface SystemInitEvent {
  type: 'system';
  subtype: 'init';
  session_id: string;
  model: string;
  cwd: string;
  timestamp: string;
}
```

### UserEvent

```typescript
interface UserEvent {
  type: 'message';
  subtype: 'user';
  message: {
    role: 'user';
    content: string;
  };
}
```

### AssistantEvent

```typescript
interface AssistantEvent {
  type: 'message';
  subtype: 'assistant';
  message: {
    role: 'assistant';
    content: Array<TextBlock | ToolUseBlock | ToolResultBlock>;
  };
}
```

### ErrorEvent

```typescript
interface ErrorEvent {
  type: 'error';
  error: string;
  details?: unknown;
}
```

### ResultEvent

```typescript
interface ResultEvent {
  type: 'result';
  result: {
    status: 'success' | 'error';
    duration_ms?: number;
    error?: string;
  };
}
```

### Type Guards

```typescript
isSystemInitEvent(event: StreamEvent): event is SystemInitEvent
isUserEvent(event: StreamEvent): event is UserEvent
isAssistantEvent(event: StreamEvent): event is AssistantEvent
isErrorEvent(event: StreamEvent): event is ErrorEvent
isResultEvent(event: StreamEvent): event is ResultEvent
```

### Content Extractors

```typescript
extractTextFromMessage(message: Message): string
extractToolUsesFromMessage(message: Message): ToolUseBlock[]
extractSessionId(event: SystemInitEvent): string
```

---

## Type Definitions

### Entry Point Types

```typescript
interface EntryPointConfig {
  name: string;
  description: string;
  outputFormat: OutputFormat;
  outputStyle?: string;
  systemPrompt?: SystemPromptConfig;
  options?: {
    model?: 'sonnet' | 'opus' | 'haiku';
    timeout?: number;
    mcpConfig?: string;
  };
  tags?: string[];
}

interface OutputFormat {
  type: 'text' | 'json' | 'structured';
  schemaName?: string;  // Required if type is 'structured'
}

interface SystemPromptConfig {
  custom?: string;
  append?: string;
  useClaudeCodePreset?: boolean;
}
```

### Common Schemas

Pre-built schemas for common use cases:

```typescript
CommonSchemas.BugReport
CommonSchemas.CodeReview
CommonSchemas.TaskList
CommonSchemas.ApiEndpoint
CommonSchemas.TestCase
```

**Example:**
```typescript
import { CommonSchemas, validateWithZod } from '@context-action/code-api';

const result = validateWithZod(data, CommonSchemas.BugReport);
```
