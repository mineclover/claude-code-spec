/**
 * Workflow-related IPC handlers
 */
import { processManager } from '@context-action/code-api';
import { agentPoolManager, appLogger } from '../../main/app-context';
import { TaskRouter } from '../../services/TaskRouter';
import type {
  WorkflowConfig,
  WorkflowEngine,
  WorkflowEvent,
  WorkflowStats,
} from '../../services/WorkflowEngine';
import type { IPCRouter } from '../IPCRouter';
import { getAgentTracker } from './agentTrackerHandlers';
import { getCentralDatabase } from './centralDatabaseHandlers';

// Store workflow instances per project
const workflowInstances = new Map<string, WorkflowEngine>();

/**
 * Get or create workflow instance for a project
 */
async function getWorkflowInstance(projectPath: string): Promise<WorkflowEngine> {
  let instance = workflowInstances.get(projectPath);

  if (!instance) {
    // Create new instance
    const { WorkflowEngine } = await import('../../services/WorkflowEngine');
    const taskRouter = new TaskRouter(agentPoolManager, processManager);
    const agentTracker = getAgentTracker();
    const centralDatabase = getCentralDatabase();

    const config: WorkflowConfig = {
      projectPath,
      maxConcurrent: 3,
      maxRetries: 3,
      retryDelay: 5000,
      autoStart: false,
    };

    instance = new WorkflowEngine(config, taskRouter, agentPoolManager, processManager, agentTracker, centralDatabase);
    workflowInstances.set(projectPath, instance);

    appLogger.info('Created workflow instance', {
      module: 'workflowHandlers',
      projectPath,
    });
  }

  return instance;
}

export function registerWorkflowHandlers(router: IPCRouter): void {
  // Start workflow
  router.handle<[string], void>('startWorkflow', async (event, projectPath) => {
    try {
      appLogger.info('Starting workflow', {
        module: 'workflowHandlers',
        projectPath,
      });

      const workflow = await getWorkflowInstance(projectPath);

      // Subscribe to workflow events and forward to renderer
      workflow.on((workflowEvent: WorkflowEvent) => {
        event.sender.send('workflow:event', workflowEvent);
      });

      await workflow.startWorkflow();
    } catch (error) {
      appLogger.error(
        'Failed to start workflow',
        error instanceof Error ? error : undefined,
        {
          module: 'workflowHandlers',
          projectPath,
        },
      );
      throw error;
    }
  });

  // Pause workflow
  router.handle<[string], void>('pauseWorkflow', async (_event, projectPath) => {
    try {
      appLogger.info('Pausing workflow', {
        module: 'workflowHandlers',
        projectPath,
      });

      const workflow = await getWorkflowInstance(projectPath);
      await workflow.pauseWorkflow();
    } catch (error) {
      appLogger.error(
        'Failed to pause workflow',
        error instanceof Error ? error : undefined,
        {
          module: 'workflowHandlers',
          projectPath,
        },
      );
      throw error;
    }
  });

  // Resume workflow
  router.handle<[string], void>('resumeWorkflow', async (_event, projectPath) => {
    try {
      appLogger.info('Resuming workflow', {
        module: 'workflowHandlers',
        projectPath,
      });

      const workflow = await getWorkflowInstance(projectPath);
      await workflow.resumeWorkflow();
    } catch (error) {
      appLogger.error(
        'Failed to resume workflow',
        error instanceof Error ? error : undefined,
        {
          module: 'workflowHandlers',
          projectPath,
        },
      );
      throw error;
    }
  });

  // Stop workflow
  router.handle<[string], void>('stopWorkflow', async (_event, projectPath) => {
    try {
      appLogger.info('Stopping workflow', {
        module: 'workflowHandlers',
        projectPath,
      });

      const workflow = await getWorkflowInstance(projectPath);
      await workflow.stopWorkflow();

      // Remove instance after stopping
      workflowInstances.delete(projectPath);
    } catch (error) {
      appLogger.error(
        'Failed to stop workflow',
        error instanceof Error ? error : undefined,
        {
          module: 'workflowHandlers',
          projectPath,
        },
      );
      throw error;
    }
  });

  // Get workflow statistics
  router.handle<[string], WorkflowStats>('getWorkflowStats', async (_event, projectPath) => {
    try {
      const workflow = await getWorkflowInstance(projectPath);
      return await workflow.getStats();
    } catch (error) {
      appLogger.error(
        'Failed to get workflow stats',
        error instanceof Error ? error : undefined,
        {
          module: 'workflowHandlers',
          projectPath,
        },
      );

      // Return default stats on error
      return {
        status: 'idle',
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        inProgressTasks: 0,
        pendingTasks: 0,
        elapsedTime: 0,
      };
    }
  });

  // Check if workflow is running
  router.handle<[string], boolean>('isWorkflowRunning', async (_event, projectPath) => {
    try {
      const workflow = workflowInstances.get(projectPath);
      if (!workflow) {
        return false;
      }

      const stats = await workflow.getStats();
      return stats.status === 'running';
    } catch (error) {
      appLogger.error(
        'Failed to check workflow status',
        error instanceof Error ? error : undefined,
        {
          module: 'workflowHandlers',
          projectPath,
        },
      );
      return false;
    }
  });
}
