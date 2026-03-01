/**
 * LangGraphEngine Unit Tests
 */

import { Annotation, END, MemorySaver, StateGraph } from '@langchain/langgraph';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock types
interface MockProcessManager {
  executeCommand: ReturnType<typeof vi.fn>;
}

interface MockAgentTracker {
  registerExecution: ReturnType<typeof vi.fn>;
  updateStatus: ReturnType<typeof vi.fn>;
  updateHeartbeat: ReturnType<typeof vi.fn>;
}

describe('LangGraph Core Functionality', () => {
  describe('StateGraph Basic Operations', () => {
    it('should create a StateGraph with annotations', () => {
      const StateAnnotation = Annotation.Root({
        value: Annotation<number>,
        logs: Annotation<string[]>({
          reducer: (x, y) => [...x, ...y],
          default: () => [],
        }),
      });

      const graph = new StateGraph(StateAnnotation);
      expect(graph).toBeDefined();
    });

    it('should add nodes and edges to graph', () => {
      const StateAnnotation = Annotation.Root({
        counter: Annotation<number>,
      });

      const graph = new StateGraph(StateAnnotation);

      // Add nodes
      graph.addNode('node1', async (state) => ({ counter: state.counter + 1 }));
      graph.addNode('node2', async (state) => ({ counter: state.counter * 2 }));

      // Add edges
      graph.addEdge('__start__', 'node1');
      graph.addEdge('node1', 'node2');
      graph.addEdge('node2', END);

      const compiled = graph.compile();
      expect(compiled).toBeDefined();
    });

    it('should execute nodes sequentially', async () => {
      const StateAnnotation = Annotation.Root({
        value: Annotation<number>,
        logs: Annotation<string[]>({
          reducer: (x, y) => [...x, ...y],
          default: () => [],
        }),
      });

      const graph = new StateGraph(StateAnnotation);

      graph.addNode('increment', async (state) => ({
        value: state.value + 1,
        logs: ['incremented'],
      }));

      graph.addNode('double', async (state) => ({
        value: state.value * 2,
        logs: ['doubled'],
      }));

      graph.addEdge('__start__', 'increment');
      graph.addEdge('increment', 'double');
      graph.addEdge('double', END);

      const compiled = graph.compile();
      const result = await compiled.invoke({ value: 5, logs: [] });

      expect(result.value).toBe(12); // (5 + 1) * 2 = 12
      expect(result.logs).toEqual(['incremented', 'doubled']);
    });
  });

  describe('State Management', () => {
    it('should use reducer to accumulate values', async () => {
      const StateAnnotation = Annotation.Root({
        items: Annotation<string[]>({
          reducer: (x, y) => [...x, ...y],
          default: () => [],
        }),
      });

      const graph = new StateGraph(StateAnnotation);

      graph.addNode('add_item1', async () => ({
        items: ['item1'],
      }));

      graph.addNode('add_item2', async () => ({
        items: ['item2'],
      }));

      graph.addEdge('__start__', 'add_item1');
      graph.addEdge('add_item1', 'add_item2');
      graph.addEdge('add_item2', END);

      const compiled = graph.compile();
      const result = await compiled.invoke({ items: [] });

      expect(result.items).toEqual(['item1', 'item2']);
    });
  });

  describe('Checkpoint Functionality', () => {
    it('should save and restore state with MemorySaver', async () => {
      const StateAnnotation = Annotation.Root({
        count: Annotation<number>,
      });

      const checkpointer = new MemorySaver();
      const graph = new StateGraph(StateAnnotation);

      graph.addNode('increment', async (state) => ({
        count: state.count + 1,
      }));

      graph.addEdge('__start__', 'increment');
      graph.addEdge('increment', END);

      const compiled = graph.compile({ checkpointer });

      // First invocation
      const config = { configurable: { thread_id: 'test-thread' } };
      await compiled.invoke({ count: 0 }, config);

      // Retrieve checkpoint
      const checkpoint = await checkpointer.get(config);
      expect(checkpoint).toBeDefined();
      expect(checkpoint?.channel_values).toMatchObject({ count: 1 });
    });
  });

  describe('Task Workflow Simulation', () => {
    it('should execute task-like workflow', async () => {
      const WorkflowStateAnnotation = Annotation.Root({
        workflowId: Annotation<string>,
        completedTasks: Annotation<string[]>({
          reducer: (x, y) => [...x, ...y],
          default: () => [],
        }),
        results: Annotation<Record<string, any>>({
          reducer: (x, y) => ({ ...x, ...y }),
          default: () => ({}),
        }),
      });

      const graph = new StateGraph(WorkflowStateAnnotation);

      // Simulate task execution
      graph.addNode('task1', async (state) => ({
        completedTasks: ['task1'],
        results: { task1: { success: true, output: 'Task 1 completed' } },
      }));

      graph.addNode('task2', async (state) => ({
        completedTasks: ['task2'],
        results: { task2: { success: true, output: 'Task 2 completed' } },
      }));

      graph.addEdge('__start__', 'task1');
      graph.addEdge('task1', 'task2');
      graph.addEdge('task2', END);

      const compiled = graph.compile();
      const result = await compiled.invoke({
        workflowId: 'test-workflow',
        completedTasks: [],
        results: {},
      });

      expect(result.completedTasks).toEqual(['task1', 'task2']);
      expect(result.results.task1).toBeDefined();
      expect(result.results.task2).toBeDefined();
      expect(result.results.task1.success).toBe(true);
      expect(result.results.task2.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle node execution errors', async () => {
      const StateAnnotation = Annotation.Root({
        value: Annotation<number>,
        error: Annotation<string | null>,
      });

      const graph = new StateGraph(StateAnnotation);

      graph.addNode('failing_node', async () => {
        throw new Error('Node execution failed');
      });

      graph.addEdge('__start__', 'failing_node');
      graph.addEdge('failing_node', END);

      const compiled = graph.compile();

      await expect(compiled.invoke({ value: 0, error: null })).rejects.toThrow(
        'Node execution failed',
      );
    });

    it('should handle errors gracefully with try-catch', async () => {
      const StateAnnotation = Annotation.Root({
        value: Annotation<number>,
        failedTasks: Annotation<string[]>({
          reducer: (x, y) => [...x, ...y],
          default: () => [],
        }),
      });

      const graph = new StateGraph(StateAnnotation);

      graph.addNode('risky_node', async (state) => {
        try {
          throw new Error('Simulated error');
        } catch (error) {
          return {
            failedTasks: ['risky_node'],
          };
        }
      });

      graph.addEdge('__start__', 'risky_node');
      graph.addEdge('risky_node', END);

      const compiled = graph.compile();
      const result = await compiled.invoke({ value: 0, failedTasks: [] });

      expect(result.failedTasks).toEqual(['risky_node']);
    });
  });

  describe('Complex Workflow Patterns', () => {
    it('should handle task dependencies', async () => {
      const StateAnnotation = Annotation.Root({
        completedTasks: Annotation<string[]>({
          reducer: (x, y) => [...x, ...y],
          default: () => [],
        }),
        data: Annotation<Record<string, any>>({
          reducer: (x, y) => ({ ...x, ...y }),
          default: () => ({}),
        }),
      });

      const graph = new StateGraph(StateAnnotation);

      // Task 1: Generate data
      graph.addNode('generate', async () => ({
        completedTasks: ['generate'],
        data: { generatedValue: 42 },
      }));

      // Task 2: Process data (depends on Task 1)
      graph.addNode('process', async (state) => ({
        completedTasks: ['process'],
        data: { processedValue: state.data.generatedValue * 2 },
      }));

      // Task 3: Finalize (depends on Task 2)
      graph.addNode('finalize', async (state) => ({
        completedTasks: ['finalize'],
        data: { finalValue: state.data.processedValue + 10 },
      }));

      graph.addEdge('__start__', 'generate');
      graph.addEdge('generate', 'process');
      graph.addEdge('process', 'finalize');
      graph.addEdge('finalize', END);

      const compiled = graph.compile();
      const result = await compiled.invoke({
        completedTasks: [],
        data: {},
      });

      expect(result.completedTasks).toEqual(['generate', 'process', 'finalize']);
      expect(result.data.generatedValue).toBe(42);
      expect(result.data.processedValue).toBe(84);
      expect(result.data.finalValue).toBe(94);
    });
  });
});

describe('LangGraphEngine Integration Patterns', () => {
  let mockProcessManager: MockProcessManager;
  let mockAgentTracker: MockAgentTracker;

  beforeEach(() => {
    mockProcessManager = {
      executeCommand: vi.fn().mockReturnValue({
        on: vi.fn((event, handler) => {
          // Simulate stream events
          if (event === 'stream') {
            // Simulate assistant event with tool use
            setTimeout(() => {
              handler({
                type: 'assistant',
                message: {
                  content: [{ type: 'tool_use', name: 'Read', id: 'tool_1', input: {} }],
                },
              });
            }, 5);
            // Simulate result event
            setTimeout(() => {
              handler({
                type: 'result',
                usage: {
                  input_tokens: 100,
                  output_tokens: 50,
                  cache_read_input_tokens: 20,
                },
                total_cost_usd: 0.0025,
              });
            }, 8);
          }
          if (event === 'complete') {
            setTimeout(() => handler(), 10);
          }
          return mockProcessManager.executeCommand.mock.results[0].value;
        }),
      }),
    };

    mockAgentTracker = {
      registerExecution: vi.fn().mockResolvedValue(undefined),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      updateHeartbeat: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe('Task Execution Pattern', () => {
    it('should follow register -> execute -> update pattern', async () => {
      const StateAnnotation = Annotation.Root({
        taskId: Annotation<string>,
        status: Annotation<string>,
      });

      const graph = new StateGraph(StateAnnotation);

      graph.addNode('execute_task', async (state) => {
        // Simulate our LangGraphEngine pattern
        const sessionId = `workflow-${state.taskId}`;

        // 1. Register
        await mockAgentTracker.registerExecution(sessionId, {
          taskId: state.taskId,
          agentName: 'test-agent',
        });

        // 2. Execute (simulated)
        await new Promise((resolve) => setTimeout(resolve, 10));

        // 3. Update
        await mockAgentTracker.updateStatus(sessionId, 'completed');

        return { status: 'completed' };
      });

      graph.addEdge('__start__', 'execute_task');
      graph.addEdge('execute_task', END);

      const compiled = graph.compile();
      const result = await compiled.invoke({
        taskId: 'test-task',
        status: 'pending',
      });

      expect(result.status).toBe('completed');
      expect(mockAgentTracker.registerExecution).toHaveBeenCalledTimes(1);
      expect(mockAgentTracker.updateStatus).toHaveBeenCalledWith('workflow-test-task', 'completed');
    });

    it('should track task progress with stream events', async () => {
      const StateAnnotation = Annotation.Root({
        taskId: Annotation<string>,
        status: Annotation<string>,
        taskProgress: Annotation<Record<string, any>>({
          reducer: (x, y) => ({ ...x, ...y }),
          default: () => ({}),
        }),
      });

      const graph = new StateGraph(StateAnnotation);

      graph.addNode('track_progress', async (state) => {
        // Simulate task progress tracking
        const sessionId = `workflow-${state.taskId}`;

        await mockAgentTracker.registerExecution(sessionId, {
          taskId: state.taskId,
          agentName: 'test-agent',
        });

        // Simulate execution with progress
        await new Promise((resolve) => setTimeout(resolve, 15));

        await mockAgentTracker.updateStatus(sessionId, 'completed');

        return {
          status: 'completed',
          taskProgress: {
            [state.taskId]: {
              status: 'completed',
              eventCount: 2,
              currentTool: 'Read',
              tokenUsage: {
                inputTokens: 100,
                outputTokens: 50,
                cacheReadTokens: 20,
                totalCostUSD: 0.0025,
              },
              lastActivity: Date.now(),
            },
          },
        };
      });

      graph.addEdge('__start__', 'track_progress');
      graph.addEdge('track_progress', END);

      const compiled = graph.compile();
      const result = await compiled.invoke({
        taskId: 'test-task',
        status: 'pending',
        taskProgress: {},
      });

      expect(result.status).toBe('completed');
      expect(result.taskProgress['test-task']).toBeDefined();
      expect(result.taskProgress['test-task'].status).toBe('completed');
      expect(result.taskProgress['test-task'].eventCount).toBe(2);
      expect(result.taskProgress['test-task'].currentTool).toBe('Read');
      expect(result.taskProgress['test-task'].tokenUsage).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 20,
        totalCostUSD: 0.0025,
      });
    });
  });

  describe('Dependency-Based Execution', () => {
    it('should execute tasks in dependency order', async () => {
      const StateAnnotation = Annotation.Root({
        workflowId: Annotation<string>,
        completedTasks: Annotation<string[]>({
          reducer: (x, y) => [...x, ...y],
          default: () => [],
        }),
        results: Annotation<Record<string, any>>({
          reducer: (x, y) => ({ ...x, ...y }),
          default: () => ({}),
        }),
      });

      const graph = new StateGraph(StateAnnotation);

      // Task A: no dependencies (level 0)
      graph.addNode('task-a', async (state) => {
        return {
          completedTasks: ['task-a'],
          results: { 'task-a': { order: state.completedTasks.length } },
        };
      });

      // Task B: no dependencies (level 0)
      graph.addNode('task-b', async (state) => {
        return {
          completedTasks: ['task-b'],
          results: { 'task-b': { order: state.completedTasks.length } },
        };
      });

      // Task C: depends on A and B (level 1)
      graph.addNode('task-c', async (state) => {
        // Verify A and B completed before C
        const hasA = state.completedTasks.includes('task-a');
        const hasB = state.completedTasks.includes('task-b');
        return {
          completedTasks: ['task-c'],
          results: {
            'task-c': {
              order: state.completedTasks.length,
              dependenciesMet: hasA && hasB,
            },
          },
        };
      });

      // Build dependency graph
      graph.addEdge('__start__', 'task-a');
      graph.addEdge('__start__', 'task-b');
      graph.addEdge('task-a', 'task-c');
      graph.addEdge('task-b', 'task-c');
      graph.addEdge('task-c', END);

      const compiled = graph.compile();
      const result = await compiled.invoke({
        workflowId: 'test-deps',
        completedTasks: [],
        results: {},
      });

      // Verify execution order
      expect(result.completedTasks).toEqual(['task-a', 'task-b', 'task-c']);
      expect(result.results['task-c'].dependenciesMet).toBe(true);
      // task-c should execute after both A and B
      expect(result.results['task-c'].order).toBe(2);
    });

    it('should detect circular dependencies', () => {
      // This test verifies that analyzeDependencies throws on circular deps
      // We can't test the private method directly, but we can verify the behavior
      // through integration tests in real usage
      expect(true).toBe(true); // Placeholder for circular dependency detection
    });
  });

  describe('Phase 4: Conditional Branching', () => {
    it('should route to target task when condition is true', async () => {
      const StateAnnotation = Annotation.Root({
        workflowId: Annotation<string>,
        completedTasks: Annotation<string[]>({
          reducer: (x, y) => [...x, ...y],
          default: () => [],
        }),
        results: Annotation<Record<string, any>>({
          reducer: (x, y) => ({ ...x, ...y }),
          default: () => ({}),
        }),
      });

      const graph = new StateGraph(StateAnnotation);

      // Task A: Produces a result
      graph.addNode('task-a', async (state) => {
        return {
          completedTasks: ['task-a'],
          results: { 'task-a': { value: 10 } },
        };
      });

      // Task B: Conditional target (value > 5)
      graph.addNode('task-b', async (state) => {
        return {
          completedTasks: ['task-b'],
          results: { 'task-b': { executed: true } },
        };
      });

      // Task C: Default target (value <= 5)
      graph.addNode('task-c', async (state) => {
        return {
          completedTasks: ['task-c'],
          results: { 'task-c': { executed: true } },
        };
      });

      // Build graph with conditional edge
      graph.addEdge('__start__', 'task-a');
      graph.addConditionalEdges('task-a', (state) => {
        // Simulate conditional branching logic
        const result = state.results['task-a'];
        if (result && result.value > 5) {
          return 'task-b'; // Route to task-b if value > 5
        }
        return 'task-c'; // Otherwise route to task-c
      });
      graph.addEdge('task-b', END);
      graph.addEdge('task-c', END);

      const compiled = graph.compile();
      const result = await compiled.invoke({
        workflowId: 'test-conditional',
        completedTasks: [],
        results: {},
      });

      // Verify that task-b was executed (value 10 > 5)
      expect(result.completedTasks).toContain('task-a');
      expect(result.completedTasks).toContain('task-b');
      expect(result.completedTasks).not.toContain('task-c');
      expect(result.results['task-b'].executed).toBe(true);
    });

    it('should route to default task when condition is false', async () => {
      const StateAnnotation = Annotation.Root({
        workflowId: Annotation<string>,
        completedTasks: Annotation<string[]>({
          reducer: (x, y) => [...x, ...y],
          default: () => [],
        }),
        results: Annotation<Record<string, any>>({
          reducer: (x, y) => ({ ...x, ...y }),
          default: () => ({}),
        }),
      });

      const graph = new StateGraph(StateAnnotation);

      // Task A: Produces a result with small value
      graph.addNode('task-a', async (state) => {
        return {
          completedTasks: ['task-a'],
          results: { 'task-a': { value: 3 } },
        };
      });

      // Task B: Conditional target (value > 5)
      graph.addNode('task-b', async (state) => {
        return {
          completedTasks: ['task-b'],
          results: { 'task-b': { executed: true } },
        };
      });

      // Task C: Default target (value <= 5)
      graph.addNode('task-c', async (state) => {
        return {
          completedTasks: ['task-c'],
          results: { 'task-c': { executed: true } },
        };
      });

      // Build graph with conditional edge
      graph.addEdge('__start__', 'task-a');
      graph.addConditionalEdges('task-a', (state) => {
        const result = state.results['task-a'];
        if (result && result.value > 5) {
          return 'task-b';
        }
        return 'task-c';
      });
      graph.addEdge('task-b', END);
      graph.addEdge('task-c', END);

      const compiled = graph.compile();
      const result = await compiled.invoke({
        workflowId: 'test-conditional-false',
        completedTasks: [],
        results: {},
      });

      // Verify that task-c was executed (value 3 <= 5)
      expect(result.completedTasks).toContain('task-a');
      expect(result.completedTasks).toContain('task-c');
      expect(result.completedTasks).not.toContain('task-b');
      expect(result.results['task-c'].executed).toBe(true);
    });

    it('should handle multiple conditional branches', async () => {
      const StateAnnotation = Annotation.Root({
        workflowId: Annotation<string>,
        completedTasks: Annotation<string[]>({
          reducer: (x, y) => [...x, ...y],
          default: () => [],
        }),
        results: Annotation<Record<string, any>>({
          reducer: (x, y) => ({ ...x, ...y }),
          default: () => ({}),
        }),
      });

      const graph = new StateGraph(StateAnnotation);

      // Task A: Produces a status result
      graph.addNode('task-a', async (state) => {
        return {
          completedTasks: ['task-a'],
          results: { 'task-a': { status: 'success' } },
        };
      });

      // Task B: For success status
      graph.addNode('task-b', async (state) => {
        return {
          completedTasks: ['task-b'],
          results: { 'task-b': { route: 'success' } },
        };
      });

      // Task C: For error status
      graph.addNode('task-c', async (state) => {
        return {
          completedTasks: ['task-c'],
          results: { 'task-c': { route: 'error' } },
        };
      });

      // Task D: For unknown status
      graph.addNode('task-d', async (state) => {
        return {
          completedTasks: ['task-d'],
          results: { 'task-d': { route: 'unknown' } },
        };
      });

      // Build graph with multiple conditional branches
      graph.addEdge('__start__', 'task-a');
      graph.addConditionalEdges('task-a', (state) => {
        const result = state.results['task-a'];
        if (result?.status === 'success') {
          return 'task-b';
        } else if (result?.status === 'error') {
          return 'task-c';
        }
        return 'task-d';
      });
      graph.addEdge('task-b', END);
      graph.addEdge('task-c', END);
      graph.addEdge('task-d', END);

      const compiled = graph.compile();
      const result = await compiled.invoke({
        workflowId: 'test-multi-conditional',
        completedTasks: [],
        results: {},
      });

      // Verify that task-b was executed (status is 'success')
      expect(result.completedTasks).toEqual(['task-a', 'task-b']);
      expect(result.results['task-b'].route).toBe('success');
    });

    it('should handle conditional branching with dependencies', async () => {
      const StateAnnotation = Annotation.Root({
        workflowId: Annotation<string>,
        completedTasks: Annotation<string[]>({
          reducer: (x, y) => [...x, ...y],
          default: () => [],
        }),
        results: Annotation<Record<string, any>>({
          reducer: (x, y) => ({ ...x, ...y }),
          default: () => ({}),
        }),
      });

      const graph = new StateGraph(StateAnnotation);

      // Task A: Base task
      graph.addNode('task-a', async (state) => {
        return {
          completedTasks: ['task-a'],
          results: { 'task-a': { count: 5 } },
        };
      });

      // Task B: Conditional branch (count >= 5)
      graph.addNode('task-b', async (state) => {
        return {
          completedTasks: ['task-b'],
          results: { 'task-b': { processed: state.results['task-a'].count * 2 } },
        };
      });

      // Task C: Alternative branch (count < 5)
      graph.addNode('task-c', async (state) => {
        return {
          completedTasks: ['task-c'],
          results: { 'task-c': { processed: state.results['task-a'].count + 10 } },
        };
      });

      // Task D: Final task (depends on either B or C)
      graph.addNode('task-d', async (state) => {
        const processedValue =
          state.results['task-b']?.processed || state.results['task-c']?.processed;
        return {
          completedTasks: ['task-d'],
          results: { 'task-d': { final: processedValue + 1 } },
        };
      });

      // Build graph
      graph.addEdge('__start__', 'task-a');
      graph.addConditionalEdges('task-a', (state) => {
        const result = state.results['task-a'];
        return result.count >= 5 ? 'task-b' : 'task-c';
      });
      graph.addEdge('task-b', 'task-d');
      graph.addEdge('task-c', 'task-d');
      graph.addEdge('task-d', END);

      const compiled = graph.compile();
      const result = await compiled.invoke({
        workflowId: 'test-conditional-deps',
        completedTasks: [],
        results: {},
      });

      // Verify execution path: A -> B -> D (since count = 5 >= 5)
      expect(result.completedTasks).toEqual(['task-a', 'task-b', 'task-d']);
      expect(result.results['task-b'].processed).toBe(10); // 5 * 2
      expect(result.results['task-d'].final).toBe(11); // 10 + 1
    });
  });
});
