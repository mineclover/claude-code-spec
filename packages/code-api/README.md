# @context-action/code-api

Claude Code CLI Client Library - A TypeScript library for interacting with Claude CLI programmatically.

## Features

- **ClaudeClient**: Execute Claude CLI commands with stream parsing
- **ProcessManager**: Manage multiple concurrent Claude CLI executions
- **SessionManager**: Track and persist Claude CLI sessions
- **StreamParser**: Parse Claude CLI stream JSON output
- **ClaudeQueryAPI**: Schema-validated queries with Zod integration
- **Error Handling**: Comprehensive error types and handling

## Installation

```bash
npm install @context-action/code-api
# peer dependency
npm install zod
```

## Usage

### Basic Execution

```typescript
import { ClaudeClient } from '@context-action/code-api';

const client = new ClaudeClient({
  cwd: './my-project',
  onStream: (event) => console.log(event),
  onError: (error) => console.error(error),
  onComplete: (code) => console.log('Done:', code)
});

client.execute('Explain this codebase');
```

### Process Management

```typescript
import { ProcessManager } from '@context-action/code-api';

const manager = new ProcessManager();

const sessionId = await manager.startExecution({
  projectPath: './my-project',
  query: 'Fix the bug in auth.ts',
  onStream: (sid, event) => console.log(event)
});

// Kill execution
manager.killExecution(sessionId);
```

### Schema-Validated Queries

```typescript
import { ClaudeQueryAPI } from '@context-action/code-api';
import { z } from 'zod';

const api = new ClaudeQueryAPI();

const schema = z.object({
  summary: z.string(),
  issues: z.array(z.string()),
  suggestions: z.array(z.string())
});

const result = await api.queryWithZod(
  './my-project',
  'Analyze this code and provide a summary',
  schema
);

if (result.success) {
  console.log(result.data.summary);
  console.log(result.data.issues);
}
```

## API Reference

### ClaudeClient

Execute Claude CLI commands with stream handling.

```typescript
interface ClaudeClientOptions {
  cwd: string;
  model?: 'sonnet' | 'opus' | 'haiku';
  sessionId?: string;
  mcpConfig?: string;
  onStream?: (event: StreamEvent) => void;
  onError?: (error: string) => void;
  onComplete?: (code: number) => void;
}
```

### ProcessManager

Manage multiple concurrent executions with lifecycle management.

```typescript
interface StartExecutionParams {
  projectPath: string;
  query: string;
  sessionId?: string;
  mcpConfig?: string;
  model?: 'sonnet' | 'opus' | 'haiku';
  skillId?: string;
  skillScope?: 'global' | 'project';
  outputStyle?: string;
  onStream?: (sessionId: string, event: StreamEvent) => void;
  onError?: (sessionId: string, error: string) => void;
  onComplete?: (sessionId: string, code: number) => void;
}
```

### ClaudeQueryAPI

Execute queries with automatic JSON extraction and schema validation.

```typescript
// With Zod schema
queryWithZod<T>(
  projectPath: string,
  instruction: string,
  schema: ZodType<T>,
  options?: QueryOptions
): Promise<JSONExtractionResult<T>>

// With Standard Schema
queryWithStandardSchema<T>(
  projectPath: string,
  instruction: string,
  schema: StandardSchemaV1,
  options?: QueryOptions
): Promise<JSONExtractionResult<T>>
```

## License

MIT
