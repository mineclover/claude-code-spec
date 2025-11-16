# Getting Started

Quick guide to start using @context-action/code-api in your projects.

## Installation

```bash
# Install the package
npm install @context-action/code-api

# Install peer dependency
npm install zod
```

## Prerequisites

**Claude CLI must be installed:**

```bash
# Install Claude CLI
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

## Quick Start

### 1. Simple Query

Execute a one-off query to Claude:

```typescript
import { ClaudeClient } from '@context-action/code-api';

const client = new ClaudeClient({
  cwd: './my-project',
  onStream: (event) => {
    if (event.type === 'message' && event.subtype === 'assistant') {
      console.log(event.message.content);
    }
  },
  onComplete: (code) => {
    console.log('Done! Exit code:', code);
  }
});

client.execute('What files are in this project?');
```

### 2. Structured Data Extraction

Extract structured data with schema validation:

```typescript
import { ClaudeQueryAPI } from '@context-action/code-api';
import { z } from 'zod';

const api = new ClaudeQueryAPI();

// Define your schema
const fileListSchema = z.object({
  files: z.array(z.object({
    path: z.string(),
    type: z.enum(['file', 'directory']),
    size: z.number().optional()
  })),
  total: z.number()
});

// Execute query with schema
const result = await api.queryWithZod(
  './my-project',
  'List all TypeScript files in the src directory',
  fileListSchema
);

if (result.success) {
  console.log(`Found ${result.data.total} files`);
  result.data.files.forEach(file => {
    console.log(`- ${file.path} (${file.type})`);
  });
}
```

### 3. Manage Multiple Executions

Run multiple queries concurrently:

```typescript
import { ProcessManager } from '@context-action/code-api';

const manager = new ProcessManager(3); // Max 3 concurrent

// Start first execution
const session1 = await manager.startExecution({
  projectPath: './my-project',
  query: 'Analyze code quality',
  onStream: (sid, event) => {
    console.log(`[${sid}]`, event);
  }
});

// Start second execution
const session2 = await manager.startExecution({
  projectPath: './my-project',
  query: 'Find all TODO comments',
  onStream: (sid, event) => {
    console.log(`[${sid}]`, event);
  }
});

// Check status
const exec1 = manager.getExecution(session1);
console.log('Status:', exec1?.status);

// Get stats
const stats = manager.getStats();
console.log(`Active: ${stats.active}, Total: ${stats.total}`);
```

## Entry Point System

The Entry Point system provides pre-configured execution contexts.

### Step 1: Define Schema

Create a schema for your structured output:

```typescript
import { SchemaManager } from '@context-action/code-api';

const schemaManager = new SchemaManager('./my-project');

schemaManager.saveSchema({
  name: 'code-analysis',
  description: 'Code quality analysis results',
  schema: {
    score: {
      type: 'number',
      description: 'Quality score from 1-10',
      min: 1,
      max: 10,
      required: true
    },
    issues: {
      type: 'array',
      arrayItemType: 'object',
      description: 'List of issues found',
      required: true
    },
    recommendations: {
      type: 'array',
      arrayItemType: 'string',
      description: 'Improvement suggestions',
      required: false
    }
  }
});
```

### Step 2: Create Entry Point

Configure an entry point that uses the schema:

```typescript
import { EntryPointManager } from '@context-action/code-api';

const manager = new EntryPointManager('./my-project');

manager.setEntryPoint({
  name: 'analyze-code',
  description: 'Analyze code quality and provide recommendations',
  outputFormat: {
    type: 'structured',
    schemaName: 'code-analysis'  // References the schema we created
  },
  systemPrompt: {
    useClaudeCodePreset: true,
    append: `Focus on:
      - Code complexity
      - Best practices
      - Security issues
      - Performance bottlenecks`
  },
  options: {
    model: 'sonnet',
    timeout: 120000
  },
  tags: ['quality', 'analysis']
});
```

### Step 3: Preview Expected Output

Before executing, see what data structure to expect:

```typescript
const detail = manager.getEntryPointDetail('analyze-code');

console.log('Entry Point:', detail.config.name);
console.log('Description:', detail.config.description);
console.log('Output Type:', detail.expectedOutput.type);

// See schema fields
if (detail.expectedOutput.fields) {
  console.log('\nExpected Fields:');
  Object.entries(detail.expectedOutput.fields).forEach(([key, field]) => {
    const req = field.required ? 'required' : 'optional';
    console.log(`  - ${key}: ${field.type} (${req})`);
    console.log(`    ${field.description}`);
  });
}
```

Output:
```
Entry Point: analyze-code
Description: Analyze code quality and provide recommendations
Output Type: structured

Expected Fields:
  - score: number (required)
    Quality score from 1-10
  - issues: array (required)
    List of issues found
  - recommendations: array (optional)
    Improvement suggestions
```

### Step 4: Execute Entry Point

Execute your query through the configured entry point:

```typescript
import { EntryPointExecutor } from '@context-action/code-api';

const executor = new EntryPointExecutor('./my-project');

const result = await executor.execute({
  entryPoint: 'analyze-code',
  projectPath: './my-project',
  query: 'Analyze src/auth.ts'
});

if (result.success) {
  // TypeScript knows the structure!
  console.log('Quality Score:', result.data.score);
  console.log('Issues:', result.data.issues);
  console.log('Recommendations:', result.data.recommendations);
  console.log('Execution time:', result.executionTime, 'ms');
} else {
  console.error('Error:', result.error);
  if (result.validationErrors) {
    console.error('Validation errors:', result.validationErrors);
  }
}
```

## Common Use Cases

### Use Case 1: Bug Report Generator

```typescript
import { ClaudeQueryAPI } from '@context-action/code-api';
import { z } from 'zod';

const bugReportSchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string(),
  description: z.string(),
  stepsToReproduce: z.array(z.string()),
  expectedBehavior: z.string(),
  actualBehavior: z.string(),
  affectedFiles: z.array(z.string())
});

const api = new ClaudeQueryAPI();

const result = await api.queryWithZod(
  './my-project',
  'Analyze the error in logs/error.txt and create a bug report',
  bugReportSchema,
  { model: 'opus', timeout: 60000 }
);

if (result.success) {
  console.log(`[${result.data.severity.toUpperCase()}] ${result.data.title}`);
  console.log('\nDescription:', result.data.description);
  console.log('\nSteps to reproduce:');
  result.data.stepsToReproduce.forEach((step, i) => {
    console.log(`${i + 1}. ${step}`);
  });
  console.log('\nAffected files:', result.data.affectedFiles.join(', '));
}
```

### Use Case 2: Code Review Automation

```typescript
import { EntryPointManager, EntryPointExecutor, SchemaManager } from '@context-action/code-api';

// 1. Define schema
const schemaManager = new SchemaManager('./my-project');
schemaManager.saveSchema({
  name: 'code-review',
  description: 'Code review results',
  schema: {
    overall: { type: 'string', required: true },
    improvements: { type: 'array', arrayItemType: 'object', required: true },
    positives: { type: 'array', arrayItemType: 'string', required: true },
    score: { type: 'number', min: 1, max: 10, required: true }
  }
});

// 2. Create entry point
const manager = new EntryPointManager('./my-project');
manager.setEntryPoint({
  name: 'code-review',
  description: 'Comprehensive code review',
  outputFormat: { type: 'structured', schemaName: 'code-review' },
  systemPrompt: {
    useClaudeCodePreset: true,
    append: 'Focus on readability, maintainability, and best practices'
  }
});

// 3. Execute reviews on multiple files
const executor = new EntryPointExecutor('./my-project');
const files = ['src/auth.ts', 'src/api.ts', 'src/utils.ts'];

for (const file of files) {
  const result = await executor.execute({
    entryPoint: 'code-review',
    projectPath: './my-project',
    query: `Review ${file}`
  });

  if (result.success) {
    console.log(`\n=== Review: ${file} ===`);
    console.log(`Score: ${result.data.score}/10`);
    console.log(`Overall: ${result.data.overall}`);
    console.log(`\nPositives:`);
    result.data.positives.forEach(p => console.log(`  ✓ ${p}`));
    console.log(`\nImprovements:`);
    result.data.improvements.forEach(i => console.log(`  → ${i}`));
  }
}
```

### Use Case 3: Documentation Generator

```typescript
import { ProcessManager } from '@context-action/code-api';
import fs from 'fs/promises';

const manager = new ProcessManager();

const sessionId = await manager.startExecution({
  projectPath: './my-project',
  query: 'Generate API documentation for all exported functions in src/api/',
  model: 'opus',
  onStream: (sid, event) => {
    if (event.type === 'message' && event.subtype === 'assistant') {
      // Stream documentation to file
      const text = extractTextFromMessage(event.message);
      fs.appendFile('./docs/api.md', text);
    }
  },
  onComplete: (sid, code) => {
    console.log('Documentation generated!');
  }
});
```

## Configuration

### MCP Server Config

Use custom MCP server configuration:

```typescript
const client = new ClaudeClient({
  cwd: './my-project',
  mcpConfig: '.claude/.mcp-custom.json',  // Custom MCP config
  onStream: (event) => console.log(event)
});
```

### Model Selection

Choose appropriate model for your task:

```typescript
// Quick tasks - Haiku (fast, cheap)
const quickResult = await api.queryWithZod(
  './my-project',
  'Count files',
  schema,
  { model: 'haiku' }
);

// Standard tasks - Sonnet (balanced)
const standardResult = await api.queryWithZod(
  './my-project',
  'Analyze code',
  schema,
  { model: 'sonnet' }
);

// Complex tasks - Opus (powerful, accurate)
const complexResult = await api.queryWithZod(
  './my-project',
  'Refactor architecture',
  schema,
  { model: 'opus' }
);
```

### Session Resume

Resume previous sessions:

```typescript
const client = new ClaudeClient({
  cwd: './my-project',
  sessionId: 'previous-session-id',  // Continue from here
  onStream: (event) => console.log(event)
});

client.execute('Continue from where we left off');
```

## Error Handling

```typescript
import {
  ProcessManager,
  ProcessStartError,
  MaxConcurrentError
} from '@context-action/code-api';

const manager = new ProcessManager(2);

try {
  const sessionId = await manager.startExecution({
    projectPath: './my-project',
    query: 'Complex task',
    onError: (sid, error) => {
      console.error(`Execution ${sid} error:`, error);
    }
  });
} catch (error) {
  if (error instanceof MaxConcurrentError) {
    console.error('Too many concurrent executions!');
    console.error('Active:', manager.getActiveExecutions().length);
  } else if (error instanceof ProcessStartError) {
    console.error('Failed to start process:', error.message);
    console.error('Details:', error.details);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Next Steps

- Read the [API Reference](./api-reference.md) for detailed documentation
- Learn about [Architecture](./architecture.md) for deeper understanding
- Explore [Advanced Usage](./advanced-usage.md) for complex scenarios
- Check [System Prompt vs Output Style](./system-prompt-vs-output-style.md) for entry point patterns

## Tips

1. **Start simple**: Use `ClaudeClient` for basic queries
2. **Add structure**: Use `ClaudeQueryAPI` with Zod schemas for structured data
3. **Scale up**: Use `ProcessManager` for concurrent executions
4. **Optimize**: Use Entry Points for reusable query patterns
5. **Choose right model**: Haiku for speed, Sonnet for balance, Opus for complexity
6. **Handle errors**: Always implement error callbacks and try-catch blocks
7. **Preview schemas**: Use `getEntryPointDetail()` to see expected output before execution
