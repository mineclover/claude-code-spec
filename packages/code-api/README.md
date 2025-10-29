# @context-action/code-api

Claude Code CLI Client Library - A TypeScript library for interacting with Claude CLI programmatically.

## Features

- **ClaudeClient**: Execute Claude CLI commands with stream parsing
- **ProcessManager**: Manage multiple concurrent Claude CLI executions
- **SessionManager**: Track and persist Claude CLI sessions
- **StreamParser**: Parse Claude CLI stream JSON output
- **ClaudeQueryAPI**: Schema-validated queries with Zod integration
- **Entry Point System**: Pre-configured execution contexts with schema management
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

### Entry Point System

The Entry Point system allows you to create pre-configured execution contexts where output formats and options are defined upfront. This is ideal for creating reusable query interfaces with consistent behavior.

**Important**: When using `structured` output type, the corresponding schema must exist in `workflow/schemas/` before creating the entry point. The system validates schema existence automatically.

#### 1. Define Schemas

Create JSON schema definitions in `workflow/schemas/*.json`:

```typescript
import { SchemaManager } from '@context-action/code-api';

const schemaManager = new SchemaManager('./my-project');

const codeReviewSchema = {
  name: 'code-review',
  description: 'Code review and quality analysis results',
  schema: {
    file: {
      type: 'string',
      description: 'Analyzed file path',
      required: true
    },
    score: {
      type: 'number',
      description: 'Overall quality score',
      min: 1,
      max: 10,
      required: true
    },
    issues: {
      type: 'array',
      arrayItemType: 'object',
      description: 'List of issues found',
      required: true
    }
  }
};

schemaManager.saveSchema(codeReviewSchema);
```

#### 2. Configure Entry Points

Define entry points in `workflow/entry-points.json`:

```typescript
import { EntryPointManager } from '@context-action/code-api';

const entryPointManager = new EntryPointManager('./my-project');

const codeReviewEntry = {
  name: 'code-review',
  description: 'Analyze code files for quality, complexity, and improvements',
  outputStyle: 'structured-json',
  outputFormat: {
    type: 'structured',
    schemaName: 'code-review'
  },
  options: {
    model: 'sonnet',
    timeout: 120000,
    filterThinking: true
  },
  tags: ['code-quality', 'analysis']
};

entryPointManager.setEntryPoint(codeReviewEntry);
// ✅ Automatically validates that 'code-review' schema exists
// ❌ Throws error if schema not found: "Schema 'code-review' does not exist in workflow/schemas/"
```

**Schema Validation Process**:
1. When calling `setEntryPoint()` with `structured` output type
2. System automatically checks if referenced schema exists in `workflow/schemas/`
3. If schema not found, throws validation error with helpful message
4. Prevents runtime errors by catching issues at configuration time

#### 3. Preview Expected Output (Key Feature!)

**Before execution**, check what output format to expect:

```typescript
const detail = entryPointManager.getEntryPointDetail('code-review');

console.log('Expected Output Type:', detail.expectedOutput.type);
console.log('Description:', detail.expectedOutput.description);

// For structured types, see exact fields
if (detail.expectedOutput.fields) {
  Object.entries(detail.expectedOutput.fields).forEach(([key, field]) => {
    console.log(`- ${key}: ${field.type} ${field.required ? '(required)' : ''}`);
    console.log(`  ${field.description}`);
  });
}

// See example output
if (detail.expectedOutput.examples) {
  console.log('Example:', JSON.stringify(detail.expectedOutput.examples[0], null, 2));
}
```

**This is the core value**: Executors know exactly what data structure they'll receive before running the query!

#### 4. Execute via Entry Points

Execute queries through pre-configured entry points:

```typescript
import { EntryPointExecutor } from '@context-action/code-api';

const executor = new EntryPointExecutor('./my-project');

const result = await executor.execute({
  entryPoint: 'code-review',
  projectPath: './my-project',
  query: 'Analyze src/main.ts for code quality'
});

if (result.success) {
  console.log('File:', result.data.file);
  console.log('Score:', result.data.score);
  console.log('Issues:', result.data.issues);
}
```

#### Output Format Types

- **`text`**: Plain text output (no schema)
- **`json`**: JSON output without schema validation
- **`structured`**: JSON output with schema validation

### System Prompt Configuration

**System Prompt vs Output Style**:
- **Output Style**: Controls response **format** (JSON, tone, structure)
- **System Prompt**: Controls AI **role** and **behavior** (domain expertise, guidelines, persona)

These are **independent and complementary** - use both for powerful execution contexts!

#### Configure AI Role and Behavior

```typescript
const entryPoint: EntryPointConfig = {
  name: 'security-review',
  outputFormat: {
    type: 'structured',
    schemaName: 'security-review'
  },

  // Define AI's role and expertise
  systemPrompt: {
    useClaudeCodePreset: true,  // Keep Claude Code's base behavior
    append: `You are a security auditor.

    Focus on:
    - Input validation
    - SQL injection risks
    - XSS vulnerabilities
    - Authentication/Authorization

    Always assume adversarial input.`
  }
};
```

#### System Prompt Options

1. **Custom** (Complete replacement):
```typescript
systemPrompt: {
  custom: 'You are a Python specialist. Always use type hints.'
}
```

2. **Append** (Add to default):
```typescript
systemPrompt: {
  append: 'Always include comprehensive error handling.'
}
```

3. **Preset + Append** (Recommended):
```typescript
systemPrompt: {
  useClaudeCodePreset: true,
  append: 'Prioritize OAuth 2.0 compliance'
}
```

#### Real-World Example: SRE Incident Response

```typescript
const sreIncident: EntryPointConfig = {
  name: 'sre-incident',
  description: 'SRE expert incident investigation',

  // Output: Structured incident report
  outputFormat: {
    type: 'structured',
    schemaName: 'incident-report'
  },

  // AI: SRE expert with specific methodology
  systemPrompt: {
    custom: `You are an expert SRE with 10+ years experience.

    Investigation process:
    1. Identify symptoms
    2. Check recent changes
    3. Review logs systematically
    4. Propose fixes
    5. Document learnings

    Always prioritize service restoration over root cause.`
  },

  options: {
    model: 'opus',
    timeout: 180000
  }
};
```

**Result**: You get both structured data AND expert-level analysis!

See [System Prompt vs Output Style](./docs/system-prompt-vs-output-style.md) for detailed comparison and patterns.

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

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run specific tests
npm run test:schema          # Schema validation tests
npm run test:zod             # Zod schema tests
npm run test:schema-validation  # Schema + Claude integration
npm run test:zod-claude      # Zod + Claude integration
npm run test:pipeline        # Full pipeline test
```

### Running Examples

```bash
# Query API usage
npm run example:query

# JSON extraction pipeline
npm run example:json

# Entry Point system usage
npm run example:entrypoint
```

### Test Coverage

- ✅ Schema prompt building and validation
- ✅ Zod schema integration
- ✅ Standard Schema compliance
- ✅ JSON extraction from Claude output
- ✅ Type guards and runtime validation
- ✅ Full pipeline (Schema → Claude → Extract → Validate)

## License

MIT
