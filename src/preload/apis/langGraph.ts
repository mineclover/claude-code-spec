/**
 * Preload API for LangGraph
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { WorkflowState } from '../../services/LangGraphEngine';
import type { Task } from '../../types/task';

export interface LangGraphAPI {
  startWorkflow: (
    workflowId: string,
    projectPath: string,
    tasks: Task[],
  ) => Promise<{ success: boolean; state: WorkflowState }>;
  getWorkflowState: (workflowId: string) => Promise<WorkflowState | null>;
  resumeWorkflow: (
    workflowId: string,
    tasks: Task[],
  ) => Promise<{ success: boolean; state: WorkflowState }>;
}

export function exposeLangGraphAPI(): void {
  const api: LangGraphAPI = {
    startWorkflow: (workflowId: string, projectPath: string, tasks: Task[]) =>
      ipcRenderer.invoke('langgraph:startWorkflow', { workflowId, projectPath, tasks }),

    getWorkflowState: (workflowId: string) =>
      ipcRenderer.invoke('langgraph:getWorkflowState', workflowId),

    resumeWorkflow: (workflowId: string, tasks: Task[]) =>
      ipcRenderer.invoke('langgraph:resumeWorkflow', { workflowId, tasks }),
  };

  contextBridge.exposeInMainWorld('langGraphAPI', api);
}
