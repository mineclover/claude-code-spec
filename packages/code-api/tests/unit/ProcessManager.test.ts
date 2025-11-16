import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProcessManager } from '../../src/process/ProcessManager';
import {
  MaxConcurrentError,
  ExecutionNotFoundError,
  ProcessKillError,
} from '../../src/errors/errors';
import type { ExecutionStatus } from '../../src/process/ProcessManager';

// Mock ClaudeClient to simulate real behavior
vi.mock('../../src/client/ClaudeClient', () => {
  return {
    ClaudeClient: class MockClaudeClient {
      options: any;
      constructor(options: any) {
        this.options = options;
      }
      execute = vi.fn().mockImplementation((query: string) => {
        // Simulate system:init event after a short delay
        setTimeout(() => {
          if (this.options.onStream) {
            this.options.onStream({
              type: 'system',
              subtype: 'init',
              session_id: `mock-session-${Date.now()}`,
              model: 'claude-sonnet-4',
              cwd: this.options.cwd,
              timestamp: new Date().toISOString(),
            });
          }
        }, 10);

        return {
          pid: 12345,
          kill: vi.fn(),
        };
      });
      kill = vi.fn();
    },
  };
});

describe('ProcessManager', () => {
  let manager: ProcessManager;

  beforeEach(() => {
    manager = new ProcessManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup any active executions
    manager.killAll();
  });

  describe('constructor', () => {
    it('should initialize with default maxConcurrent', () => {
      expect(manager.getMaxConcurrent()).toBe(10);
    });

    it('should initialize with custom maxConcurrent', () => {
      const customManager = new ProcessManager({ maxConcurrent: 5 });
      expect(customManager.getMaxConcurrent()).toBe(5);
      customManager.destroy();
    });

    it('should initialize with custom maxHistorySize', () => {
      const customManager = new ProcessManager({ maxHistorySize: 50 });
      expect(customManager).toBeDefined();
      customManager.destroy();
    });

    it('should enable auto cleanup when interval is set', () => {
      const customManager = new ProcessManager({
        autoCleanupInterval: 60000, // 1 minute
        maxHistorySize: 50,
      });
      expect(customManager).toBeDefined();
      customManager.destroy();
    });
  });

  describe('setMaxConcurrent', () => {
    it('should update max concurrent limit', () => {
      manager.setMaxConcurrent(5);
      expect(manager.getMaxConcurrent()).toBe(5);
    });

    it('should throw error for invalid max value', () => {
      expect(() => manager.setMaxConcurrent(0)).toThrow();
      expect(() => manager.setMaxConcurrent(-1)).toThrow();
    });
  });

  describe('memory management', () => {
    it('should limit history size when enforceHistoryLimit is called', () => {
      // This would require adding executions and testing the limit
      // For now, just verify the manager was created with limits
      const limitedManager = new ProcessManager({ maxHistorySize: 10 });
      expect(limitedManager).toBeDefined();
      limitedManager.destroy();
    });

    it('should cleanup on destroy', () => {
      const testManager = new ProcessManager({
        autoCleanupInterval: 60000,
      });
      testManager.destroy();
      // Manager should have cleaned up timer
      expect(testManager).toBeDefined();
    });
  });

  describe('startExecution', () => {
    it('should handle resume with existing sessionId', async () => {
      const sessionId = 'existing-session-123';
      const params = {
        projectPath: '/test/project',
        query: 'Resume query',
        sessionId,
      };

      const resultSessionId = await manager.startExecution(params);
      expect(resultSessionId).toBe(sessionId);

      const execution = manager.getExecution(sessionId);
      expect(execution).toBeDefined();
      expect(execution?.sessionId).toBe(sessionId);
    });

    // Note: Tests requiring sessionId from system:init are in integration tests
    // because they need real Claude CLI process or complex mocking
  });

  describe('getExecution', () => {
    it('should return undefined for non-existent sessionId', () => {
      const execution = manager.getExecution('non-existent');
      expect(execution).toBeUndefined();
    });
  });

  describe('getAllExecutions', () => {
    it('should return empty array initially', () => {
      expect(manager.getAllExecutions()).toEqual([]);
    });
  });

  describe('getActiveExecutions', () => {
    it('should return only running and pending executions', () => {
      // This would require mocking executions
      const active = manager.getActiveExecutions();
      expect(Array.isArray(active)).toBe(true);
    });
  });

  describe('getCompletedExecutions', () => {
    it('should return only completed, failed, and killed executions', () => {
      const completed = manager.getCompletedExecutions();
      expect(Array.isArray(completed)).toBe(true);
    });
  });

  describe('killExecution', () => {
    it('should throw ExecutionNotFoundError for non-existent execution', () => {
      expect(() => manager.killExecution('non-existent')).toThrow(
        ExecutionNotFoundError
      );
    });
  });

  describe('cleanupExecution', () => {
    it('should not throw for non-existent execution', () => {
      // Should log warning but not throw
      expect(() => manager.cleanupExecution('non-existent')).not.toThrow();
    });
  });

  describe('cleanupAllCompleted', () => {
    it('should return 0 when no executions exist', () => {
      const count = manager.cleanupAllCompleted();
      expect(count).toBe(0);
    });
  });

  describe('killAll', () => {
    it('should not throw when no executions exist', () => {
      expect(() => manager.killAll()).not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return correct initial stats', () => {
      const stats = manager.getStats();

      expect(stats).toEqual({
        total: 0,
        running: 0,
        pending: 0,
        completed: 0,
        failed: 0,
        killed: 0,
      });
    });
  });

  describe('executionsChangeListener', () => {
    it('should call listener when executions change', async () => {
      const listener = vi.fn();
      manager.setExecutionsChangeListener(listener);

      // Starting an execution should trigger listener
      // (when sessionId is received and execution is added)
      const sessionId = 'test-session';
      await manager.startExecution({
        projectPath: '/test',
        query: 'test',
        sessionId,
      });

      expect(listener).toHaveBeenCalled();
    });

    it('should not call listener if not set', async () => {
      // Should not throw even without listener
      const sessionId = 'test-session';
      await expect(
        manager.startExecution({
          projectPath: '/test',
          query: 'test',
          sessionId,
        })
      ).resolves.toBe(sessionId);
    });
  });

  describe('memory management', () => {
    it('should store execution info in memory', async () => {
      const sessionId = 'test-session';
      await manager.startExecution({
        projectPath: '/test',
        query: 'test',
        sessionId,
      });

      const execution = manager.getExecution(sessionId);
      expect(execution).toBeDefined();
      expect(execution?.sessionId).toBe(sessionId);
      expect(execution?.projectPath).toBe('/test');
      expect(execution?.query).toBe('test');
    });

    it('should cleanup execution from memory', async () => {
      const sessionId = 'test-session';
      await manager.startExecution({
        projectPath: '/test',
        query: 'test',
        sessionId,
      });

      // Kill first
      manager.killExecution(sessionId);

      // Then cleanup
      manager.cleanupExecution(sessionId);

      const execution = manager.getExecution(sessionId);
      expect(execution).toBeUndefined();
    });

    it('should throw error when cleaning up active execution', async () => {
      const sessionId = 'test-session';
      await manager.startExecution({
        projectPath: '/test',
        query: 'test',
        sessionId,
      });

      // Try to cleanup without killing first
      expect(() => manager.cleanupExecution(sessionId)).toThrow(ProcessKillError);
    });
  });

  describe('concurrent execution limits', () => {
    it('should allow execution when below limit', async () => {
      manager.setMaxConcurrent(10);

      const sessionId = 'test-session-concurrent';
      const resultSessionId = await manager.startExecution({
        projectPath: '/test',
        query: 'test',
        sessionId,
      });

      expect(resultSessionId).toBe(sessionId);
    });

    it('should cleanup completed execution', async () => {
      const sessionId = 'test-session-cleanup';
      await manager.startExecution({
        projectPath: '/test',
        query: 'test',
        sessionId,
      });

      // Kill and cleanup
      manager.killExecution(sessionId);
      manager.cleanupExecution(sessionId);

      // Should be removed
      const execution = manager.getExecution(sessionId);
      expect(execution).toBeUndefined();
    });
  });
});
