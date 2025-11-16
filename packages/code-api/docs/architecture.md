# Architecture

Deep dive into @context-action/code-api architecture and design decisions.

## Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ ClaudeQuery │  │  EntryPoint  │  │ ClaudeClient   │ │
│  │     API     │  │   Executor   │  │                │ │
│  └─────────────┘  └──────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                     Core Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Process    │  │   Session    │  │   Stream     │  │
│  │   Manager    │  │   Manager    │  │   Parser     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Schema & Validation Layer               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Schema     │  │     JSON     │  │     Zod      │  │
│  │   Manager    │  │  Extractor   │  │  Validator   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Claude CLI Layer                       │
│              (child_process.spawn)                       │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Process Layer

**Responsibility**: Manage Claude CLI process lifecycle

#### ProcessManager

- **Purpose**: Concurrent execution management
- **Key Features**:
  - Max concurrent limit enforcement
  - Process lifecycle tracking
  - Event-based communication
  - Automatic cleanup

**Design Decisions**:

1. **Singleton Pattern**: `processManager` instance for global state
2. **Event-Driven**: Callbacks for stream, error, complete
3. **Status Tracking**: `pending` → `running` → `completed`/`failed`
4. **Concurrent Control**: Queue system with max limit (1-10)

```typescript
class ProcessManager {
  private executions: Map<string, ExecutionInfo>;
  private maxConcurrent: number;

  async startExecution(params): Promise<string> {
    // 1. Check concurrent limit
    if (activeCount >= maxConcurrent) throw MaxConcurrentError;

    // 2. Create execution info
    const sessionId = generateUUID();
    const info: ExecutionInfo = { status: 'pending', ... };

    // 3. Start process
    const process = spawn('claude', args);

    // 4. Setup stream parser
    const parser = new StreamParser(onEvent, onError);

    // 5. Pipe stdout → parser
    process.stdout.on('data', (chunk) => parser.processChunk(chunk));

    return sessionId;
  }
}
```

#### ClaudeClient

- **Purpose**: Single execution wrapper
- **Simpler API**: No session management
- **Use Case**: One-off queries

**When to Use**:
- `ClaudeClient`: Simple, single execution
- `ProcessManager`: Multiple, concurrent executions

---

### 2. Stream Layer

**Responsibility**: Parse Claude CLI stream JSON output

#### StreamParser

- **Format**: JSONL (JSON Lines)
- **Challenge**: Incomplete chunks, ANSI escape codes
- **Solution**: Buffering + ANSI stripping

**Stream Format**:
```jsonl
{"type":"system","subtype":"init","session_id":"..."}
{"type":"message","subtype":"user","message":{...}}
{"type":"message","subtype":"assistant","message":{...}}
{"type":"result","result":{"status":"success"}}
```

**Implementation**:

```typescript
class StreamParser {
  private buffer: string = '';

  processChunk(chunk: string): void {
    // 1. Strip ANSI escape codes
    const cleaned = chunk.replace(ANSI_REGEX, '');

    // 2. Append to buffer
    this.buffer += cleaned;

    // 3. Split by newline
    const lines = this.buffer.split('\n');

    // 4. Keep incomplete line in buffer
    this.buffer = lines.pop() || '';

    // 5. Parse complete lines
    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const event = JSON.parse(line);
        this.onEvent(event);
      } catch (error) {
        this.onError(`Invalid JSON: ${line}`);
      }
    }
  }
}
```

**Design Decisions**:

1. **Buffering**: Handle incomplete JSON across chunks
2. **ANSI Stripping**: Remove terminal formatting
3. **Error Recovery**: Skip invalid lines, continue parsing
4. **Type Safety**: Strong typing for all event types

---

### 3. Session Layer

**Responsibility**: Track and persist execution history

#### SessionManager

- **Storage**: In-memory (can be extended to disk/DB)
- **Purpose**: Session resumption, analytics
- **Features**:
  - Project-based filtering
  - Status tracking
  - Timestamp recording

**Design**:

```typescript
class SessionManager {
  private sessions: Map<string, SessionInfo>;

  addSession(info: SessionInfo): void {
    this.sessions.set(info.sessionId, info);
    // TODO: Persist to disk/DB
  }

  getProjectSessions(projectPath: string): SessionInfo[] {
    return Array.from(this.sessions.values())
      .filter(s => s.projectPath === projectPath)
      .sort((a, b) => b.timestamp - a.timestamp);
  }
}
```

**Future Extensions**:
- SQLite storage
- Session analytics
- Cost tracking
- Performance metrics

---

### 4. Schema Layer

**Responsibility**: Schema management and validation

#### SchemaManager

- **Storage**: `workflow/schemas/*.json`
- **Format**: Simplified JSON schema
- **Purpose**: Define expected output structures

**Schema Format**:

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

**Design Decisions**:

1. **Simplified Schema**: Not full JSON Schema - easier to write
2. **File-Based**: Version controlled with project
3. **Validation**: Runtime validation against schema
4. **Prompt Generation**: Convert schema to Claude prompt

---

### 5. Entry Point System

**Responsibility**: Pre-configured execution contexts

#### EntryPointManager

- **Storage**: `workflow/entry-points.json`
- **Purpose**: Reusable query patterns
- **Validation**: Schema existence checks

**Architecture**:

```
┌──────────────────┐
│ EntryPointConfig │  - name, description, tags
│                  │  - outputFormat (text/json/structured)
│                  │  - outputStyle (optional)
│                  │  - systemPrompt (optional)
│                  │  - options (model, timeout, mcp)
└──────────────────┘
         │
         ├─────► Schema Validation
         │       (if outputFormat.type === 'structured')
         │
         └─────► EntryPointDetail
                 (expectedOutput preview)
```

#### EntryPointExecutor

- **Purpose**: Execute through entry points
- **Flow**:

```typescript
async execute(params: ExecuteEntryPointParams): Promise<EntryPointResult> {
  // 1. Load entry point config
  const config = entryPointManager.getEntryPoint(params.entryPoint);

  // 2. Build Claude prompt
  let prompt = params.query;

  // 2a. Add output style instruction
  if (config.outputStyle) {
    prompt = `${outputStyleContent}\n\n${prompt}`;
  }

  // 2b. Add schema instruction
  if (config.outputFormat.type === 'structured') {
    const schema = schemaManager.getSchema(config.outputFormat.schemaName);
    prompt = `${buildSchemaPrompt(schema)}\n\n${prompt}`;
  }

  // 3. Execute via ProcessManager
  const sessionId = await processManager.startExecution({
    projectPath: params.projectPath,
    query: prompt,
    model: config.options?.model,
    ...
  });

  // 4. Wait for completion & extract result
  // 5. Validate against schema (if structured)
  // 6. Return result
}
```

**Key Innovation**: **Preview Expected Output**

```typescript
getEntryPointDetail(name: string): EntryPointDetail {
  const config = this.getEntryPoint(name);

  // Build expected output based on schema
  if (config.outputFormat.type === 'structured') {
    const schema = schemaManager.getSchema(config.outputFormat.schemaName);

    return {
      config,
      expectedOutput: {
        type: 'structured',
        description: schema.description,
        fields: schema.schema,  // Full field definitions
        examples: generateExamples(schema)
      }
    };
  }

  return { config, expectedOutput: { type: config.outputFormat.type } };
}
```

**Benefit**: Callers know exact structure before execution!

---

### 6. Query API Layer

**Responsibility**: High-level query interface with validation

#### ClaudeQueryAPI

- **Purpose**: Simple query + schema validation
- **Features**:
  - Automatic JSON extraction
  - Zod/Standard Schema validation
  - Error handling

**Flow**:

```
Query + Schema
      │
      ▼
┌─────────────────┐
│ Build Prompt    │  schema → prompt instructions
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Execute via     │  ProcessManager.startExecution()
│ ProcessManager  │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Stream Events   │  Collect assistant messages
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Extract JSON    │  extractJSON(text)
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Validate Schema │  validateWithZod(data, schema)
└─────────────────┘
      │
      ▼
  Result
```

**Example**:

```typescript
async queryWithZod<T>(
  projectPath: string,
  instruction: string,
  schema: ZodType<T>,
  options?: QueryOptions
): Promise<JSONExtractionResult<T>> {
  // 1. Convert schema to prompt
  const schemaPrompt = zodSchemaToPrompt(schema);
  const fullPrompt = `${schemaPrompt}\n\n${instruction}`;

  // 2. Execute
  let output = '';
  const sessionId = await processManager.startExecution({
    projectPath,
    query: fullPrompt,
    onStream: (sid, event) => {
      if (isAssistantEvent(event)) {
        output += extractTextFromMessage(event.message);
      }
    }
  });

  // 3. Wait for completion
  await waitForCompletion(sessionId);

  // 4. Extract JSON
  const extracted = extractJSON(output);
  if (!extracted.success) return extracted;

  // 5. Validate
  const validated = validateWithZod(extracted.data, schema);

  return {
    success: validated.valid,
    data: validated.data,
    validationErrors: validated.errors
  };
}
```

---

## Data Flow

### Typical Execution Flow

```
User Code
    │
    │ client.execute(query)
    ▼
ClaudeClient
    │
    │ spawn('claude', [args])
    ▼
Child Process
    │
    │ stdout (Stream JSON)
    ▼
StreamParser
    │
    │ processChunk()
    ▼
Events
    │
    ├─► onStream(event)
    ├─► onError(error)
    └─► onComplete(code)
         │
         ▼
    User Callbacks
```

### Entry Point Flow

```
User Code
    │
    │ executor.execute({ entryPoint: 'code-review', query: '...' })
    ▼
EntryPointExecutor
    │
    │ Load config from workflow/entry-points.json
    ├─► Load schema from workflow/schemas/*.json
    ├─► Load output style from .claude/output-styles/*.md
    │
    │ Build enriched prompt
    ▼
ProcessManager
    │
    │ spawn Claude CLI
    ▼
StreamParser
    │
    │ Collect output
    ▼
JSON Extractor
    │
    │ Extract JSON from text
    ▼
Schema Validator
    │
    │ Validate against schema
    ▼
EntryPointResult
    │
    │ { success, data, validationErrors, executionTime }
    ▼
User Code
```

---

## Design Patterns

### 1. Builder Pattern

**Schema Prompt Builder**:

```typescript
function buildSchemaPrompt(schema: JSONSchema): string {
  let prompt = `Please respond with JSON matching this schema:\n\n`;

  for (const [key, field] of Object.entries(schema.schema)) {
    prompt += `- ${key} (${field.type})`;
    if (field.required) prompt += ' [required]';
    prompt += `\n  ${field.description}\n`;

    if (field.min !== undefined) prompt += `  Min: ${field.min}\n`;
    if (field.max !== undefined) prompt += `  Max: ${field.max}\n`;
  }

  return prompt;
}
```

### 2. Factory Pattern

**Event Type Guards**:

```typescript
export function isAssistantEvent(event: StreamEvent): event is AssistantEvent {
  return event.type === 'message' && event.subtype === 'assistant';
}

export function isErrorEvent(event: StreamEvent): event is ErrorEvent {
  return event.type === 'error';
}
```

### 3. Strategy Pattern

**Validation Strategies**:

```typescript
// Strategy 1: Zod
validateWithZod(data, zodSchema)

// Strategy 2: Standard Schema
validateWithStandardSchema(data, standardSchema)

// Strategy 3: JSON Schema
validateAgainstSchema(data, jsonSchema)
```

### 4. Observer Pattern

**Event Callbacks**:

```typescript
manager.startExecution({
  // ...
  onStream: (sessionId, event) => { /* observer 1 */ },
  onError: (sessionId, error) => { /* observer 2 */ },
  onComplete: (sessionId, code) => { /* observer 3 */ }
});
```

---

## Error Handling Strategy

### 1. Type-Safe Errors

```typescript
class ProcessStartError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'ProcessStartError';
  }
}
```

### 2. Error Propagation

```
Process Error
    │
    ├─► onError callback (immediate)
    │
    └─► Promise rejection (async)
```

### 3. Graceful Degradation

- Stream parsing errors: Skip line, continue
- Validation errors: Return partial result + errors
- Process errors: Clean up, notify callbacks

---

## Performance Considerations

### 1. Buffering Strategy

- **Problem**: Large outputs can overflow memory
- **Solution**: Stream processing, don't accumulate all
- **Implementation**: `StreamParser` processes line-by-line

### 2. Concurrent Limit

- **Problem**: Too many processes → resource exhaustion
- **Solution**: Max concurrent limit (default: 3)
- **Configurable**: `setMaxConcurrent(1-10)`

### 3. Schema Validation

- **Problem**: Validation overhead on large responses
- **Solution**: Lazy validation, only when needed
- **Optimization**: Type guards before full validation

### 4. Process Cleanup

- **Problem**: Zombie processes
- **Solution**: Explicit cleanup on completion/error
- **Safety**: Kill all on app shutdown

---

## Extension Points

### 1. Custom Validators

```typescript
interface Validator<T> {
  validate(data: unknown): ValidationResult<T>;
  toPrompt(): string;
}

class CustomValidator<T> implements Validator<T> {
  // Your implementation
}
```

### 2. Custom Storage

```typescript
interface SessionStorage {
  save(session: SessionInfo): Promise<void>;
  load(sessionId: string): Promise<SessionInfo | undefined>;
  query(filter: SessionFilter): Promise<SessionInfo[]>;
}

class SQLiteSessionStorage implements SessionStorage {
  // Your implementation
}
```

### 3. Custom Stream Handlers

```typescript
interface StreamHandler {
  onEvent(event: StreamEvent): void;
  onComplete(): void;
}

class LoggingStreamHandler implements StreamHandler {
  // Your implementation
}
```

---

## Future Enhancements

### Planned Features

1. **Persistent Storage**
   - SQLite for sessions
   - Query history
   - Cost tracking

2. **Advanced Metrics**
   - Token usage tracking
   - Response time analytics
   - Quality metrics

3. **Retry Mechanism**
   - Automatic retry on failures
   - Exponential backoff
   - Circuit breaker

4. **Caching Layer**
   - Query result caching
   - Smart cache invalidation
   - Configurable TTL

5. **Plugin System**
   - Custom validators
   - Custom extractors
   - Custom formatters

---

## Summary

**Key Architectural Principles**:

1. **Separation of Concerns**: Clear layer boundaries
2. **Type Safety**: Comprehensive TypeScript types
3. **Event-Driven**: Async, non-blocking communication
4. **Extensibility**: Plugin points for customization
5. **Error Resilience**: Graceful degradation
6. **Resource Management**: Concurrent limits, cleanup

**Core Innovation**: Entry Point system with **preview-before-execute** pattern - know exact output structure before running queries.
