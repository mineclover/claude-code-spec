/**
 * AgentTracker - Monitors and tracks all running agent executions
 *
 * Responsibilities:
 * - Register agent executions
 * - Track execution status in real-time
 * - Detect zombie processes (no activity for extended period)
 * - Perform periodic health checks
 * - Auto-cleanup unresponsive processes
 */

import type { ProcessManager } from '@context-action/code-api';
import { appLogger } from '../main/app-context';
import type { ExecutionRecord } from '../types/report';
import { CentralDatabase } from './CentralDatabase';

export interface TrackedExecution {
  sessionId: string;
  pid: number;
  projectPath: string;
  agentName: string;
  taskId?: string;
  startTime: number;
  lastHeartbeat: number;
  status: 'running' | 'zombie' | 'completed' | 'failed';
}

export interface HealthStatus {
  sessionId: string;
  isAlive: boolean;
  lastHeartbeat: number;
  timeSinceHeartbeat: number;
  isZombie: boolean;
  recommendation?: 'monitor' | 'cleanup' | 'ok';
}

export interface ExecutionMetadata {
  projectPath: string;
  agentName: string;
  taskId?: string;
}

export class AgentTracker {
  private trackedExecutions: Map<string, TrackedExecution> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private zombieThresholdMs: number = 10 * 60 * 1000; // 10 minutes
  private healthCheckIntervalMs: number = 5 * 60 * 1000; // 5 minutes

  constructor(
    private processManager: ProcessManager,
    private database: CentralDatabase,
  ) {
    appLogger.info('AgentTracker initialized', {
      module: 'AgentTracker',
      zombieThreshold: this.zombieThresholdMs,
      healthCheckInterval: this.healthCheckIntervalMs,
    });
  }

  // ========== Execution Registration ==========

  /**
   * Register a new execution for tracking
   */
  registerExecution(sessionId: string, metadata: ExecutionMetadata): void {
    appLogger.info('Registering execution', {
      module: 'AgentTracker',
      sessionId,
      agentName: metadata.agentName,
      taskId: metadata.taskId,
    });

    const execution = this.processManager.getExecution(sessionId);
    if (!execution) {
      appLogger.warn('Cannot register execution - not found in ProcessManager', {
        module: 'AgentTracker',
        sessionId,
      });
      return;
    }

    const tracked: TrackedExecution = {
      sessionId,
      pid: execution.pid ?? 0,
      projectPath: metadata.projectPath,
      agentName: metadata.agentName,
      taskId: metadata.taskId,
      startTime: execution.startTime,
      lastHeartbeat: Date.now(),
      status: 'running',
    };

    this.trackedExecutions.set(sessionId, tracked);

    // Save to database
    this.saveExecutionRecord(tracked).catch((error) => {
      appLogger.error('Failed to save execution record', error as Error, {
        module: 'AgentTracker',
        sessionId,
      });
    });

    appLogger.info('Execution registered', {
      module: 'AgentTracker',
      sessionId,
      trackedCount: this.trackedExecutions.size,
    });
  }

  /**
   * Update execution status
   */
  updateStatus(sessionId: string, status: 'running' | 'completed' | 'failed'): void {
    const tracked = this.trackedExecutions.get(sessionId);
    if (!tracked) {
      appLogger.warn('Cannot update status - execution not tracked', {
        module: 'AgentTracker',
        sessionId,
      });
      return;
    }

    appLogger.info('Updating execution status', {
      module: 'AgentTracker',
      sessionId,
      oldStatus: tracked.status,
      newStatus: status,
    });

    tracked.status = status;
    tracked.lastHeartbeat = Date.now();

    // Save to database
    this.saveExecutionRecord(tracked).catch((error) => {
      appLogger.error('Failed to save execution record', error as Error, {
        module: 'AgentTracker',
        sessionId,
      });
    });
  }

  /**
   * Update heartbeat for an execution
   */
  updateHeartbeat(sessionId: string): void {
    const tracked = this.trackedExecutions.get(sessionId);
    if (!tracked) {
      return;
    }

    tracked.lastHeartbeat = Date.now();

    // If it was marked as zombie, clear that status
    if (tracked.status === 'zombie') {
      tracked.status = 'running';
      appLogger.info('Execution recovered from zombie state', {
        module: 'AgentTracker',
        sessionId,
      });
    }
  }

  /**
   * Unregister an execution (when completed or cleaned up)
   */
  unregisterExecution(sessionId: string): void {
    appLogger.info('Unregistering execution', {
      module: 'AgentTracker',
      sessionId,
    });

    const tracked = this.trackedExecutions.get(sessionId);
    if (tracked) {
      // Final save to database before removing
      this.saveExecutionRecord(tracked).catch((error) => {
        appLogger.error('Failed to save final execution record', error as Error, {
          module: 'AgentTracker',
          sessionId,
        });
      });
    }

    this.trackedExecutions.delete(sessionId);

    appLogger.info('Execution unregistered', {
      module: 'AgentTracker',
      sessionId,
      remainingCount: this.trackedExecutions.size,
    });
  }

  // ========== Monitoring ==========

  /**
   * Get all active executions
   */
  getActiveExecutions(): TrackedExecution[] {
    return Array.from(this.trackedExecutions.values()).filter((e) => e.status === 'running');
  }

  /**
   * Get zombie processes (no heartbeat for extended period)
   */
  getZombieProcesses(): TrackedExecution[] {
    const now = Date.now();
    const zombies: TrackedExecution[] = [];

    for (const tracked of this.trackedExecutions.values()) {
      const timeSinceHeartbeat = now - tracked.lastHeartbeat;

      if (tracked.status === 'running' && timeSinceHeartbeat > this.zombieThresholdMs) {
        tracked.status = 'zombie';
        zombies.push(tracked);

        appLogger.warn('Zombie process detected', {
          module: 'AgentTracker',
          sessionId: tracked.sessionId,
          agentName: tracked.agentName,
          timeSinceHeartbeat,
        });
      }
    }

    return zombies;
  }

  /**
   * Get all tracked executions
   */
  getAllTracked(): TrackedExecution[] {
    return Array.from(this.trackedExecutions.values());
  }

  // ========== Health Checking ==========

  /**
   * Start periodic health checking
   */
  startHealthCheck(interval?: number): void {
    if (this.healthCheckInterval) {
      this.stopHealthCheck();
    }

    const checkInterval = interval || this.healthCheckIntervalMs;

    appLogger.info('Starting health check', {
      module: 'AgentTracker',
      interval: checkInterval,
    });

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, checkInterval);

    // Do initial check immediately
    this.performHealthCheck();
  }

  /**
   * Stop health checking
   */
  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;

      appLogger.info('Health check stopped', {
        module: 'AgentTracker',
      });
    }
  }

  /**
   * Perform health check on all tracked executions
   */
  private performHealthCheck(): void {
    appLogger.debug('Performing health check', {
      module: 'AgentTracker',
      trackedCount: this.trackedExecutions.size,
    });

    const now = Date.now();
    let healthyCount = 0;
    let zombieCount = 0;
    let completedCount = 0;

    for (const tracked of this.trackedExecutions.values()) {
      const health = this.checkExecution(tracked.sessionId);

      if (health.isZombie) {
        zombieCount++;

        // Auto-cleanup zombies if configured
        if (health.recommendation === 'cleanup') {
          this.cleanupZombie(tracked.sessionId);
        }
      } else if (tracked.status === 'completed' || tracked.status === 'failed') {
        completedCount++;
      } else if (health.isAlive) {
        healthyCount++;
      }
    }

    appLogger.info('Health check completed', {
      module: 'AgentTracker',
      healthy: healthyCount,
      zombies: zombieCount,
      completed: completedCount,
      total: this.trackedExecutions.size,
    });
  }

  /**
   * Check health of a specific execution
   */
  checkExecution(sessionId: string): HealthStatus {
    const tracked = this.trackedExecutions.get(sessionId);
    const now = Date.now();

    if (!tracked) {
      return {
        sessionId,
        isAlive: false,
        lastHeartbeat: 0,
        timeSinceHeartbeat: 0,
        isZombie: false,
      };
    }

    const timeSinceHeartbeat = now - tracked.lastHeartbeat;
    const isZombie = timeSinceHeartbeat > this.zombieThresholdMs && tracked.status === 'running';

    // Check if process still exists
    const execution = this.processManager.getExecution(sessionId);
    const isAlive = execution !== null && execution.pid !== null;

    let recommendation: 'monitor' | 'cleanup' | 'ok' = 'ok';

    if (isZombie) {
      // Zombie for > 20 minutes = cleanup
      if (timeSinceHeartbeat > 20 * 60 * 1000) {
        recommendation = 'cleanup';
      } else {
        recommendation = 'monitor';
      }
    }

    return {
      sessionId,
      isAlive,
      lastHeartbeat: tracked.lastHeartbeat,
      timeSinceHeartbeat,
      isZombie,
      recommendation,
    };
  }

  /**
   * Cleanup a zombie process
   */
  private async cleanupZombie(sessionId: string): Promise<void> {
    appLogger.warn('Cleaning up zombie process', {
      module: 'AgentTracker',
      sessionId,
    });

    try {
      // Try to kill the process
      await this.processManager.killExecution(sessionId);

      // Update status
      this.updateStatus(sessionId, 'failed');

      // Unregister after a delay
      setTimeout(() => {
        this.unregisterExecution(sessionId);
      }, 5000);

      appLogger.info('Zombie process cleaned up', {
        module: 'AgentTracker',
        sessionId,
      });
    } catch (error) {
      appLogger.error('Failed to cleanup zombie', error as Error, {
        module: 'AgentTracker',
        sessionId,
      });
    }
  }

  // ========== Database Integration ==========

  /**
   * Save execution record to database
   */
  private async saveExecutionRecord(tracked: TrackedExecution): Promise<void> {
    const record: ExecutionRecord = {
      executionId: tracked.sessionId,
      projectPath: tracked.projectPath,
      agentName: tracked.agentName,
      taskId: tracked.taskId,
      sessionId: tracked.sessionId,
      pid: tracked.pid,
      status: tracked.status,
      startedAt: new Date(tracked.startTime).toISOString(),
      lastHeartbeat: new Date(tracked.lastHeartbeat).toISOString(),
      completedAt:
        tracked.status === 'completed' || tracked.status === 'failed'
          ? new Date().toISOString()
          : undefined,
    };

    await this.database.saveExecution(record);
  }

  // ========== Cleanup ==========

  /**
   * Cleanup and shutdown tracker
   */
  shutdown(): void {
    appLogger.info('Shutting down AgentTracker', {
      module: 'AgentTracker',
    });

    this.stopHealthCheck();
    this.trackedExecutions.clear();
  }
}
