/**
 * IPC Handlers for LangGraph operations
 */

import { processManager } from '../../services/ProcessManager';
import { BrowserWindow } from 'electron';
import {
  LangGraphEngine,
  type StateUpdateEvent,
  type WorkflowState,
} from '../../services/LangGraphEngine';
import type { Task } from '../../types/task';
import type { IPCRouter } from '../IPCRouter';
import { getAgentTracker } from './agentTrackerHandlers';
import { getCentralDatabase } from './centralDatabaseHandlers';

let langGraphEngine: LangGraphEngine | null = null;

/**
 * Get or create LangGraphEngine instance
 */
export function getLangGraphEngine(): LangGraphEngine {
  if (!langGraphEngine) {
    const agentTracker = getAgentTracker();
    const database = getCentralDatabase();
    langGraphEngine = new LangGraphEngine(processManager, agentTracker, database);

    // Set up state update listener
    langGraphEngine.on('stateUpdate', (event: StateUpdateEvent) => {
      // Send to all windows
      const windows = BrowserWindow.getAllWindows();
      for (const window of windows) {
        window.webContents.send('langgraph:state-update', event);
      }
    });

    // Phase 4: Set up approval request listener
    langGraphEngine.on('approvalRequest', (event: any) => {
      // Send to all windows
      const windows = BrowserWindow.getAllWindows();
      for (const window of windows) {
        window.webContents.send('langgraph:approval-request', event);
      }
    });
  }
  return langGraphEngine;
}

/**
 * Register all LangGraph handlers
 */
export function registerLangGraphHandlers(router: IPCRouter): void {
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

  // Phase 4: Respond to approval request
  router.handle(
    'respondToApproval',
    async ({ taskId, approved }: { taskId: string; approved: boolean }): Promise<void> => {
      const engine = getLangGraphEngine();
      engine.respondToApproval(taskId, approved);
    },
  );
}
