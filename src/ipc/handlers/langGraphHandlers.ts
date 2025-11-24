/**
 * IPC Handlers for LangGraph operations
 */

import { processManager } from '@context-action/code-api';
import { LangGraphEngine, type WorkflowState } from '../../services/LangGraphEngine';
import type { Task } from '../../types/task';
import type { IpcRouter } from '../IpcRouter';
import { getAgentTracker } from './agentTrackerHandlers';

let langGraphEngine: LangGraphEngine | null = null;

/**
 * Get or create LangGraphEngine instance
 */
export function getLangGraphEngine(): LangGraphEngine {
  if (!langGraphEngine) {
    const agentTracker = getAgentTracker();
    langGraphEngine = new LangGraphEngine(processManager, agentTracker);
  }
  return langGraphEngine;
}

/**
 * Register all LangGraph handlers
 */
export function registerLangGraphHandlers(router: IpcRouter): void {
  // Start workflow
  router.handle(
    'startWorkflow',
    async ({
      workflowId,
      projectPath,
      tasks,
    }: {
      workflowId: string;
      projectPath: string;
      tasks: Task[];
    }): Promise<{ success: boolean; state: WorkflowState }> => {
      const engine = getLangGraphEngine();
      const finalState = await engine.startWorkflow(workflowId, projectPath, tasks);
      return { success: true, state: finalState };
    },
  );

  // Get workflow state
  router.handle('getWorkflowState', async (workflowId: string): Promise<WorkflowState | null> => {
    const engine = getLangGraphEngine();
    return engine.getWorkflowState(workflowId);
  });

  // Resume workflow
  router.handle(
    'resumeWorkflow',
    async ({
      workflowId,
      tasks,
    }: {
      workflowId: string;
      tasks: Task[];
    }): Promise<{ success: boolean; state: WorkflowState }> => {
      const engine = getLangGraphEngine();
      const finalState = await engine.resumeWorkflow(workflowId, tasks);
      return { success: true, state: finalState };
    },
  );
}
