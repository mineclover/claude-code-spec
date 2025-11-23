/**
 * IPC Handlers for AgentTracker operations
 */

import { processManager } from '@context-action/code-api';
import { AgentTracker, type ExecutionMetadata, type HealthStatus, type TrackedExecution } from '../../services/AgentTracker';
import { CentralDatabase } from '../../services/CentralDatabase';
import type { IpcRouter } from '../IpcRouter';

let agentTracker: AgentTracker | null = null;

/**
 * Get or create AgentTracker instance
 */
export function getAgentTracker(): AgentTracker {
  if (!agentTracker) {
    const database = new CentralDatabase();
    database.initialize().catch((error) => {
      console.error('Failed to initialize CentralDatabase:', error);
    });

    agentTracker = new AgentTracker(processManager, database);
    // Start health checking by default
    agentTracker.startHealthCheck();
  }
  return agentTracker;
}

/**
 * Register all agent tracker handlers
 */
export function registerAgentTrackerHandlers(router: IpcRouter): void {
  // Execution registration
  router.handle(
    'registerExecution',
    async ({ sessionId, metadata }: { sessionId: string; metadata: ExecutionMetadata }) => {
      const tracker = getAgentTracker();
      tracker.registerExecution(sessionId, metadata);
      return { success: true };
    },
  );

  router.handle(
    'updateStatus',
    async ({
      sessionId,
      status,
    }: {
      sessionId: string;
      status: 'running' | 'completed' | 'failed';
    }) => {
      const tracker = getAgentTracker();
      tracker.updateStatus(sessionId, status);
      return { success: true };
    },
  );

  router.handle('updateHeartbeat', async (sessionId: string) => {
    const tracker = getAgentTracker();
    tracker.updateHeartbeat(sessionId);
    return { success: true };
  });

  router.handle('unregisterExecution', async (sessionId: string) => {
    const tracker = getAgentTracker();
    tracker.unregisterExecution(sessionId);
    return { success: true };
  });

  // Monitoring
  router.handle('getActiveExecutions', async (): Promise<TrackedExecution[]> => {
    const tracker = getAgentTracker();
    return tracker.getActiveExecutions();
  });

  router.handle('getZombieProcesses', async (): Promise<TrackedExecution[]> => {
    const tracker = getAgentTracker();
    return tracker.getZombieProcesses();
  });

  router.handle('getAllTracked', async (): Promise<TrackedExecution[]> => {
    const tracker = getAgentTracker();
    return tracker.getAllTracked();
  });

  // Health checking
  router.handle('startHealthCheck', async (interval?: number) => {
    const tracker = getAgentTracker();
    tracker.startHealthCheck(interval);
    return { success: true };
  });

  router.handle('stopHealthCheck', async () => {
    const tracker = getAgentTracker();
    tracker.stopHealthCheck();
    return { success: true };
  });

  router.handle('checkExecution', async (sessionId: string): Promise<HealthStatus> => {
    const tracker = getAgentTracker();
    return tracker.checkExecution(sessionId);
  });
}
