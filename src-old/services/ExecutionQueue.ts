/**
 * ExecutionQueue - Priority-based queue for managing concurrent executions
 *
 * Features:
 * - Priority-based queue (higher priority executes first)
 * - Automatic processing when slots available
 * - Timeout handling for queued items
 * - Observable queue state changes
 */

import type { StartExecutionParams } from './ProcessManager';
import { appLogger } from '../main/app-context';

export interface QueuedExecution {
  id: string;
  params: StartExecutionParams;
  priority: number;
  createdAt: number;
  timeoutMs?: number;
  resolve: (sessionId: string) => void;
  reject: (error: Error) => void;
}

export interface QueueStats {
  queueSize: number;
  processing: number;
  completed: number;
  failed: number;
  timeout: number;
}

export type QueueEventType = 'added' | 'started' | 'completed' | 'failed' | 'timeout';

export interface QueueEvent {
  type: QueueEventType;
  executionId: string;
  timestamp: number;
}

export type QueueEventListener = (event: QueueEvent) => void;

export class ExecutionQueue {
  private queue: QueuedExecution[] = [];
  private processing = 0;
  private stats = {
    completed: 0,
    failed: 0,
    timeout: 0,
  };
  private listeners: QueueEventListener[] = [];
  private nextExecutionId = 1;

  constructor(private maxConcurrent: number) {
    appLogger.info('ExecutionQueue initialized', {
      module: 'ExecutionQueue',
      maxConcurrent,
    });
  }

  /**
   * Add an execution to the queue
   * Returns a Promise that resolves with sessionId when execution completes
   */
  async enqueue(params: StartExecutionParams, priority = 0, timeoutMs?: number): Promise<string> {
    const executionId = `queue-${this.nextExecutionId++}`;

    return new Promise<string>((resolve, reject) => {
      const queuedExecution: QueuedExecution = {
        id: executionId,
        params,
        priority,
        createdAt: Date.now(),
        timeoutMs,
        resolve,
        reject,
      };

      // Add to queue (sorted by priority, highest first)
      this.queue.push(queuedExecution);
      this.queue.sort((a, b) => b.priority - a.priority);

      appLogger.debug('Execution added to queue', {
        module: 'ExecutionQueue',
        executionId,
        priority,
        queueSize: this.queue.length,
      });

      this.emitEvent({
        type: 'added',
        executionId,
        timestamp: Date.now(),
      });

      // Setup timeout if specified
      if (timeoutMs) {
        setTimeout(() => {
          const index = this.queue.findIndex((e) => e.id === executionId);
          if (index !== -1) {
            this.queue.splice(index, 1);
            this.stats.timeout++;

            appLogger.warn('Queued execution timeout', {
              module: 'ExecutionQueue',
              executionId,
              waitTime: Date.now() - queuedExecution.createdAt,
            });

            this.emitEvent({
              type: 'timeout',
              executionId,
              timestamp: Date.now(),
            });

            reject(new Error(`Execution timed out in queue after ${timeoutMs}ms`));
          }
        }, timeoutMs);
      }

      // Try to process immediately
      this.processNext();
    });
  }

  /**
   * Process next execution in queue if slots available
   */
  private async processNext(): Promise<void> {
    // Check if we can process more
    if (this.processing >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // Get highest priority item
    const queuedExecution = this.queue.shift();
    if (!queuedExecution) {
      return;
    }

    this.processing++;

    const waitTime = Date.now() - queuedExecution.createdAt;

    appLogger.info('Starting queued execution', {
      module: 'ExecutionQueue',
      executionId: queuedExecution.id,
      waitTime,
      priority: queuedExecution.priority,
    });

    this.emitEvent({
      type: 'started',
      executionId: queuedExecution.id,
      timestamp: Date.now(),
    });

    try {
      // This will be overridden by ProcessManager integration
      // For now, just resolve immediately for testing
      const sessionId = `temp-${queuedExecution.id}`;
      queuedExecution.resolve(sessionId);

      this.stats.completed++;

      appLogger.info('Queued execution completed', {
        module: 'ExecutionQueue',
        executionId: queuedExecution.id,
        sessionId,
      });

      this.emitEvent({
        type: 'completed',
        executionId: queuedExecution.id,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.stats.failed++;

      const errorMsg = error instanceof Error ? error.message : String(error);

      appLogger.error('Queued execution failed', error instanceof Error ? error : undefined, {
        module: 'ExecutionQueue',
        executionId: queuedExecution.id,
        error: errorMsg,
      });

      this.emitEvent({
        type: 'failed',
        executionId: queuedExecution.id,
        timestamp: Date.now(),
      });

      queuedExecution.reject(error instanceof Error ? error : new Error(errorMsg));
    } finally {
      this.processing--;

      // Process next item
      this.processNext();
    }
  }

  /**
   * Set processor function (called by ProcessManager)
   */
  setProcessor(_processor: (params: StartExecutionParams) => Promise<string>): void {
    // This will be implemented when integrating with ProcessManager
    appLogger.info('Processor set', {
      module: 'ExecutionQueue',
    });
  }

  /**
   * Get current queue statistics
   */
  getStats(): QueueStats {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      completed: this.stats.completed,
      failed: this.stats.failed,
      timeout: this.stats.timeout,
    };
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get number of processing executions
   */
  getProcessingCount(): number {
    return this.processing;
  }

  /**
   * Check if queue has capacity
   */
  hasCapacity(): boolean {
    return this.processing < this.maxConcurrent;
  }

  /**
   * Set maximum concurrent executions
   */
  setMaxConcurrent(max: number): void {
    if (max < 1) {
      throw new Error('Maximum concurrent executions must be at least 1');
    }

    const oldMax = this.maxConcurrent;
    this.maxConcurrent = max;

    appLogger.info('Max concurrent updated', {
      module: 'ExecutionQueue',
      oldMax,
      newMax: max,
    });

    // If increasing limit, try to process more items
    if (max > oldMax) {
      this.processNext();
    }
  }

  /**
   * Get maximum concurrent executions
   */
  getMaxConcurrent(): number {
    return this.maxConcurrent;
  }

  /**
   * Add event listener
   */
  addEventListener(listener: QueueEventListener): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit queue event
   */
  private emitEvent(event: QueueEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        appLogger.error('Queue event listener error', error instanceof Error ? error : undefined, {
          module: 'ExecutionQueue',
          eventType: event.type,
        });
      }
    }
  }

  /**
   * Clear all queued executions (reject them)
   */
  clear(): void {
    const count = this.queue.length;

    for (const queuedExecution of this.queue) {
      queuedExecution.reject(new Error('Queue cleared'));
    }

    this.queue = [];

    appLogger.info('Queue cleared', {
      module: 'ExecutionQueue',
      clearedCount: count,
    });
  }
}
