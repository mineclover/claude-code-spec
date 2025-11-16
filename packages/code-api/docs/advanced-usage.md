# Advanced Usage

Advanced patterns and techniques for power users of @context-action/code-api.

## Table of Contents

- [Custom Stream Processing](#custom-stream-processing)
- [Advanced Schema Patterns](#advanced-schema-patterns)
- [Complex Entry Points](#complex-entry-points)
- [Multi-Step Workflows](#multi-step-workflows)
- [Error Recovery Strategies](#error-recovery-strategies)
- [Performance Optimization](#performance-optimization)
- [Testing Strategies](#testing-strategies)
- [Production Patterns](#production-patterns)

---

## Custom Stream Processing

### Real-time Progress Tracking

Track execution progress in real-time:

```typescript
import { ProcessManager, isAssistantEvent, extractToolUsesFromMessage } from '@context-action/code-api';

const manager = new ProcessManager();

const sessionId = await manager.startExecution({
  projectPath: './my-project',
  query: 'Refactor the authentication system',
  onStream: (sid, event) => {
    if (isAssistantEvent(event)) {
      // Track tool usage
      const toolUses = extractToolUsesFromMessage(event.message);

      toolUses.forEach(tool => {
        console.log(`[${new Date().toISOString()}] Using tool: ${tool.name}`);

        // Track specific tools
        if (tool.name === 'Edit') {
          console.log(`  Editing: ${tool.input.file_path}`);
        } else if (tool.name === 'Write') {
          console.log(`  Creating: ${tool.input.file_path}`);
        } else if (tool.name === 'Bash') {
          console.log(`  Running: ${tool.input.command}`);
        }
      });

      // Extract thinking/explanation
      const text = extractTextFromMessage(event.message);
      if (text) {
        console.log(`[Thinking] ${text.substring(0, 100)}...`);
      }
    }
  }
});
```

### Custom Event Aggregation

Aggregate events for analysis:

```typescript
interface ExecutionMetrics {
  toolUsage: Map<string, number>;
  thinkingBlocks: string[];
  filesModified: Set<string>;
  commandsRun: string[];
  duration: number;
}

function createMetricsCollector(): {
  onStream: StreamCallback;
  getMetrics: () => ExecutionMetrics;
} {
  const metrics: ExecutionMetrics = {
    toolUsage: new Map(),
    thinkingBlocks: [],
    filesModified: new Set(),
    commandsRun: [],
    duration: 0
  };

  const startTime = Date.now();

  return {
    onStream: (sid, event) => {
      if (isAssistantEvent(event)) {
        // Track tool usage
        extractToolUsesFromMessage(event.message).forEach(tool => {
          metrics.toolUsage.set(
            tool.name,
            (metrics.toolUsage.get(tool.name) || 0) + 1
          );

          // Track file changes
          if (tool.name === 'Edit' || tool.name === 'Write') {
            metrics.filesModified.add(tool.input.file_path);
          }

          // Track commands
          if (tool.name === 'Bash') {
            metrics.commandsRun.push(tool.input.command);
          }
        });

        // Collect thinking
        const text = extractTextFromMessage(event.message);
        if (text) {
          metrics.thinkingBlocks.push(text);
        }
      }

      if (isResultEvent(event)) {
        metrics.duration = Date.now() - startTime;
      }
    },

    getMetrics: () => metrics
  };
}

// Usage
const collector = createMetricsCollector();

const sessionId = await manager.startExecution({
  projectPath: './my-project',
  query: 'Implement user authentication',
  onStream: collector.onStream
});

// ... after completion
const metrics = collector.getMetrics();
console.log('Execution Metrics:');
console.log('- Duration:', metrics.duration, 'ms');
console.log('- Tools used:', Object.fromEntries(metrics.toolUsage));
console.log('- Files modified:', Array.from(metrics.filesModified));
console.log('- Commands run:', metrics.commandsRun);
```

---

## Advanced Schema Patterns

### Nested Object Schemas

Define complex nested structures:

```typescript
import { SchemaManager } from '@context-action/code-api';

const schemaManager = new SchemaManager('./my-project');

schemaManager.saveSchema({
  name: 'api-design',
  description: 'API endpoint design specification',
  schema: {
    endpoint: {
      type: 'object',
      required: true,
      description: 'API endpoint details',
      properties: {
        path: {
          type: 'string',
          required: true,
          description: 'URL path'
        },
        method: {
          type: 'string',
          required: true,
          description: 'HTTP method'
        },
        auth: {
          type: 'boolean',
          required: true,
          description: 'Requires authentication'
        }
      }
    },
    request: {
      type: 'object',
      required: true,
      description: 'Request specification',
      properties: {
        headers: {
          type: 'array',
          arrayItemType: 'object',
          description: 'Request headers',
          required: false
        },
        body: {
          type: 'object',
          description: 'Request body schema',
          required: false
        }
      }
    },
    responses: {
      type: 'array',
      arrayItemType: 'object',
      required: true,
      description: 'Response specifications'
    }
  }
});
```

### Union Type Schemas with Zod

Handle multiple possible structures:

```typescript
import { z } from 'zod';
import { ClaudeQueryAPI } from '@context-action/code-api';

const successResponseSchema = z.object({
  status: z.literal('success'),
  data: z.object({
    id: z.string(),
    name: z.string()
  })
});

const errorResponseSchema = z.object({
  status: z.literal('error'),
  error: z.object({
    code: z.string(),
    message: z.string()
  })
});

const apiResponseSchema = z.discriminatedUnion('status', [
  successResponseSchema,
  errorResponseSchema
]);

const api = new ClaudeQueryAPI();

const result = await api.queryWithZod(
  './my-project',
  'Analyze the API response in logs/api-response.json',
  apiResponseSchema
);

if (result.success) {
  if (result.data.status === 'success') {
    console.log('Success! ID:', result.data.data.id);
  } else {
    console.log('Error:', result.data.error.message);
  }
}
```

### Conditional Validation

Implement context-dependent validation:

```typescript
import { z } from 'zod';

const deploymentConfigSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  region: z.string(),
  instances: z.number().min(1),

  // Conditional fields
  ssl: z.boolean().optional(),
  monitoring: z.boolean().optional(),

}).refine(
  (data) => {
    // Production requires SSL and monitoring
    if (data.environment === 'production') {
      return data.ssl === true && data.monitoring === true;
    }
    return true;
  },
  {
    message: 'Production environment requires SSL and monitoring enabled'
  }
).refine(
  (data) => {
    // Production requires multiple instances
    if (data.environment === 'production') {
      return data.instances >= 2;
    }
    return true;
  },
  {
    message: 'Production environment requires at least 2 instances'
  }
);
```

---

## Complex Entry Points

### Multi-Stage Entry Points

Chain entry points for complex workflows:

```typescript
import { EntryPointManager, EntryPointExecutor } from '@context-action/code-api';

const manager = new EntryPointManager('./my-project');
const executor = new EntryPointExecutor('./my-project');

// Stage 1: Analyze
manager.setEntryPoint({
  name: 'analyze-codebase',
  outputFormat: { type: 'structured', schemaName: 'analysis-result' },
  systemPrompt: {
    useClaudeCodePreset: true,
    append: 'Focus on identifying refactoring opportunities'
  }
});

// Stage 2: Plan
manager.setEntryPoint({
  name: 'create-refactor-plan',
  outputFormat: { type: 'structured', schemaName: 'refactor-plan' },
  systemPrompt: {
    useClaudeCodePreset: true,
    append: 'Create detailed, step-by-step refactoring plan'
  }
});

// Execute pipeline
async function refactorPipeline(file: string) {
  // Stage 1: Analyze
  const analysis = await executor.execute({
    entryPoint: 'analyze-codebase',
    projectPath: './my-project',
    query: `Analyze ${file} for refactoring opportunities`
  });

  if (!analysis.success) {
    throw new Error('Analysis failed');
  }

  console.log('Analysis:', analysis.data);

  // Stage 2: Plan (use analysis results)
  const plan = await executor.execute({
    entryPoint: 'create-refactor-plan',
    projectPath: './my-project',
    query: `Create refactoring plan for ${file} based on: ${JSON.stringify(analysis.data)}`
  });

  if (!plan.success) {
    throw new Error('Planning failed');
  }

  console.log('Refactor Plan:', plan.data);

  return { analysis: analysis.data, plan: plan.data };
}
```

### Context-Aware Entry Points

Dynamically adjust entry points based on context:

```typescript
function createContextAwareEntryPoint(
  fileType: string,
  complexity: 'simple' | 'complex'
): void {
  const manager = new EntryPointManager('./my-project');

  const systemPrompts: Record<string, string> = {
    typescript: 'You are a TypeScript expert. Focus on type safety and modern patterns.',
    python: 'You are a Python expert. Follow PEP 8 and use type hints.',
    rust: 'You are a Rust expert. Emphasize safety and zero-cost abstractions.'
  };

  const models = {
    simple: 'haiku' as const,
    complex: 'opus' as const
  };

  manager.setEntryPoint({
    name: `review-${fileType}-${complexity}`,
    description: `Review ${fileType} code (${complexity})`,
    outputFormat: { type: 'structured', schemaName: 'code-review' },
    systemPrompt: {
      useClaudeCodePreset: true,
      append: systemPrompts[fileType] || 'Follow language best practices.'
    },
    options: {
      model: models[complexity],
      timeout: complexity === 'complex' ? 180000 : 60000
    }
  });
}

// Usage
createContextAwareEntryPoint('typescript', 'complex');
createContextAwareEntryPoint('python', 'simple');
```

---

## Multi-Step Workflows

### Parallel Execution with Aggregation

Execute multiple queries in parallel and aggregate results:

```typescript
import { ProcessManager } from '@context-action/code-api';

async function parallelCodeReview(files: string[]): Promise<ReviewSummary> {
  const manager = new ProcessManager(5); // Max 5 concurrent
  const results = new Map<string, ReviewResult>();

  // Start all reviews in parallel
  const sessions = await Promise.all(
    files.map(file =>
      manager.startExecution({
        projectPath: './my-project',
        query: `Review ${file} for code quality issues`,
        onStream: (sid, event) => {
          // Collect results per session
        },
        onComplete: (sid, code) => {
          console.log(`Review complete: ${file}`);
        }
      })
    )
  );

  // Wait for all to complete
  await Promise.all(
    sessions.map(sid => waitForCompletion(manager, sid))
  );

  // Aggregate results
  const allIssues = Array.from(results.values())
    .flatMap(r => r.issues);

  const summary: ReviewSummary = {
    totalFiles: files.length,
    totalIssues: allIssues.length,
    issuesByFile: Object.fromEntries(results),
    averageScore: calculateAverageScore(results)
  };

  return summary;
}
```

### Sequential Workflow with State

Maintain state across sequential executions:

```typescript
class StatefulWorkflow {
  private state: Map<string, unknown> = new Map();
  private manager = new ProcessManager();

  async execute<T>(
    step: WorkflowStep,
    query: string
  ): Promise<T> {
    const sessionId = await this.manager.startExecution({
      projectPath: './my-project',
      query: this.buildQuery(query, step),
      onComplete: (sid, code) => {
        // Store result in state
        const execution = this.manager.getExecution(sid);
        this.state.set(step.name, execution);
      }
    });

    // ... collect and return result
  }

  private buildQuery(query: string, step: WorkflowStep): string {
    let enrichedQuery = query;

    // Inject previous step results
    if (step.dependsOn) {
      const previousResult = this.state.get(step.dependsOn);
      if (previousResult) {
        enrichedQuery = `Context from ${step.dependsOn}: ${JSON.stringify(previousResult)}\n\n${query}`;
      }
    }

    return enrichedQuery;
  }

  getState(key: string): unknown {
    return this.state.get(key);
  }
}

// Usage
const workflow = new StatefulWorkflow();

// Step 1
await workflow.execute(
  { name: 'analyze', dependsOn: null },
  'Analyze authentication bugs'
);

// Step 2 (uses Step 1 results)
await workflow.execute(
  { name: 'fix', dependsOn: 'analyze' },
  'Fix the issues found'
);

// Step 3 (uses Step 2 results)
await workflow.execute(
  { name: 'test', dependsOn: 'fix' },
  'Test the fixes'
);
```

---

## Error Recovery Strategies

### Retry with Exponential Backoff

```typescript
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries exceeded');
}

// Usage
const result = await executeWithRetry(
  () => api.queryWithZod('./my-project', 'Complex query', schema),
  3,
  2000
);
```

### Fallback Execution

```typescript
async function executeWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<{ result: T; usedFallback: boolean }> {
  try {
    const result = await primary();
    return { result, usedFallback: false };
  } catch (error) {
    console.warn('Primary execution failed, trying fallback', error);
    const result = await fallback();
    return { result, usedFallback: true };
  }
}

// Usage
const { result, usedFallback } = await executeWithFallback(
  // Try with Opus (expensive, powerful)
  () => api.queryWithZod('./my-project', query, schema, { model: 'opus' }),
  // Fallback to Sonnet (cheaper)
  () => api.queryWithZod('./my-project', query, schema, { model: 'sonnet' })
);

if (usedFallback) {
  console.log('Used fallback model');
}
```

### Partial Result Recovery

```typescript
function extractPartialResults(
  events: StreamEvent[]
): Partial<ExpectedResult> {
  const partialText = events
    .filter(isAssistantEvent)
    .map(e => extractTextFromMessage(e.message))
    .join('\n');

  try {
    // Try to extract whatever JSON is available
    const extracted = extractJSON(partialText);
    if (extracted.success) {
      return extracted.data as Partial<ExpectedResult>;
    }
  } catch {
    // Ignore extraction errors
  }

  return {}; // Return empty object if nothing extractable
}

// Usage
const execution = manager.getExecution(sessionId);
if (execution?.status === 'failed') {
  const partial = extractPartialResults(execution.events);
  console.log('Partial results:', partial);
}
```

---

## Performance Optimization

### Lazy Schema Loading

Load schemas only when needed:

```typescript
class LazySchemaManager {
  private cache = new Map<string, SchemaDefinition>();
  private basePath: string;

  constructor(projectPath: string) {
    this.basePath = `${projectPath}/workflow/schemas`;
  }

  async getSchema(name: string): Promise<SchemaDefinition | undefined> {
    // Check cache first
    if (this.cache.has(name)) {
      return this.cache.get(name);
    }

    // Load on demand
    try {
      const path = `${this.basePath}/${name}.json`;
      const content = await fs.readFile(path, 'utf-8');
      const schema = JSON.parse(content);

      // Cache for future use
      this.cache.set(name, schema);

      return schema;
    } catch {
      return undefined;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
```

### Stream Batching

Process events in batches for better performance:

```typescript
class BatchedStreamProcessor {
  private batch: StreamEvent[] = [];
  private batchSize = 10;
  private flushInterval = 1000; // ms
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private onBatch: (events: StreamEvent[]) => void
  ) {
    this.startTimer();
  }

  addEvent(event: StreamEvent): void {
    this.batch.push(event);

    if (this.batch.length >= this.batchSize) {
      this.flush();
    }
  }

  private flush(): void {
    if (this.batch.length > 0) {
      this.onBatch(this.batch);
      this.batch = [];
    }

    this.resetTimer();
  }

  private startTimer(): void {
    this.timer = setInterval(() => this.flush(), this.flushInterval);
  }

  private resetTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.startTimer();
  }

  close(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.flush();
  }
}

// Usage
const processor = new BatchedStreamProcessor((batch) => {
  console.log(`Processing ${batch.length} events`);
  // Process batch efficiently
});

const sessionId = await manager.startExecution({
  projectPath: './my-project',
  query: 'Long running task',
  onStream: (sid, event) => processor.addEvent(event),
  onComplete: () => processor.close()
});
```

---

## Testing Strategies

### Mock ProcessManager

```typescript
class MockProcessManager extends ProcessManager {
  private mockResponses = new Map<string, StreamEvent[]>();

  setMockResponse(query: string, events: StreamEvent[]): void {
    this.mockResponses.set(query, events);
  }

  async startExecution(params: StartExecutionParams): Promise<string> {
    const sessionId = generateUUID();
    const events = this.mockResponses.get(params.query) || [];

    // Simulate async execution
    setTimeout(() => {
      events.forEach(event => {
        params.onStream?.(sessionId, event);
      });
      params.onComplete?.(sessionId, 0);
    }, 100);

    return sessionId;
  }
}

// Usage in tests
const mockManager = new MockProcessManager();

mockManager.setMockResponse('Test query', [
  { type: 'system', subtype: 'init', session_id: 'test-123', ... },
  { type: 'message', subtype: 'assistant', message: { ... } },
  { type: 'result', result: { status: 'success' } }
]);

const sessionId = await mockManager.startExecution({
  projectPath: './test-project',
  query: 'Test query',
  onStream: (sid, event) => {
    // Assertions
    expect(event).toBeDefined();
  }
});
```

### Schema Testing

```typescript
import { validateWithZod } from '@context-action/code-api';
import { z } from 'zod';

describe('Schema Validation', () => {
  const schema = z.object({
    name: z.string(),
    age: z.number().min(0)
  });

  it('should validate correct data', () => {
    const result = validateWithZod({ name: 'John', age: 30 }, schema);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid data', () => {
    const result = validateWithZod({ name: 'John', age: -1 }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('age must be at least 0');
  });
});
```

---

## Production Patterns

### Logging and Monitoring

```typescript
import { ProcessManager } from '@context-action/code-api';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

const manager = new ProcessManager();

manager.setExecutionsChangeListener(() => {
  const stats = manager.getStats();

  logger.info('Execution stats updated', {
    total: stats.total,
    active: stats.active,
    completed: stats.completed,
    failed: stats.failed
  });

  // Alert if too many failures
  if (stats.failed > stats.total * 0.2) {
    logger.error('High failure rate detected', { stats });
    // Send alert to monitoring system
  }
});
```

### Rate Limiting

```typescript
class RateLimitedManager {
  private queue: Array<() => Promise<void>> = [];
  private executing = 0;
  private maxPerMinute = 10;
  private executedThisMinute = 0;

  constructor(private manager: ProcessManager) {
    // Reset counter every minute
    setInterval(() => {
      this.executedThisMinute = 0;
      this.processQueue();
    }, 60000);
  }

  async execute(params: StartExecutionParams): Promise<string> {
    if (this.executedThisMinute >= this.maxPerMinute) {
      // Add to queue
      await new Promise<void>(resolve => {
        this.queue.push(async () => {
          await this.manager.startExecution(params);
          resolve();
        });
      });
    }

    this.executedThisMinute++;
    return this.manager.startExecution(params);
  }

  private async processQueue(): void {
    while (
      this.queue.length > 0 &&
      this.executedThisMinute < this.maxPerMinute
    ) {
      const task = this.queue.shift();
      if (task) {
        this.executedThisMinute++;
        await task();
      }
    }
  }
}
```

### Graceful Shutdown

```typescript
class ManagedApplication {
  private manager = new ProcessManager();
  private shutdownHooks: Array<() => Promise<void>> = [];

  registerShutdownHook(hook: () => Promise<void>): void {
    this.shutdownHooks.push(hook);
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down gracefully...');

    // 1. Stop accepting new executions
    this.manager.setMaxConcurrent(0);

    // 2. Wait for active executions
    const active = this.manager.getActiveExecutions();
    if (active.length > 0) {
      console.log(`Waiting for ${active.length} executions to complete...`);

      await Promise.race([
        this.waitForAllComplete(),
        this.timeout(30000) // Max 30s wait
      ]);
    }

    // 3. Kill remaining
    this.manager.killAll();

    // 4. Run shutdown hooks
    await Promise.all(this.shutdownHooks.map(hook => hook()));

    console.log('Shutdown complete');
  }

  private async waitForAllComplete(): Promise<void> {
    return new Promise(resolve => {
      const check = setInterval(() => {
        if (this.manager.getActiveExecutions().length === 0) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  private timeout(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const app = new ManagedApplication();

process.on('SIGTERM', async () => {
  await app.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await app.shutdown();
  process.exit(0);
});
```

---

## Summary

**Advanced Patterns**:

1. **Custom Stream Processing** - Real-time metrics and aggregation
2. **Complex Schemas** - Nested, conditional, union types
3. **Multi-Step Workflows** - Parallel and sequential execution
4. **Error Recovery** - Retry, fallback, partial results
5. **Performance** - Lazy loading, batching, caching
6. **Testing** - Mocking, schema validation
7. **Production** - Logging, rate limiting, graceful shutdown

**Best Practices**:

- Always implement error handling
- Use type-safe schemas
- Monitor execution metrics
- Implement graceful shutdown
- Test with mocks first
- Optimize for your use case
- Log everything in production
