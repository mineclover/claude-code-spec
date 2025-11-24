/**
 * Preload API for LangGraph
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { StateUpdateEvent, WorkflowState } from '../../services/LangGraphEngine';
import type { Task } from '../../types/task';

// Phase 4: Approval request event
export interface ApprovalRequestEvent {
  workflowId: string;
  taskId: string;
  request: {
    taskId: string;
    message: string;
    approver?: string;
    requestedAt: number;
  };
  state: WorkflowState;
}

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
  onStateUpdate: (callback: (event: StateUpdateEvent) => void) => () => void;
  onApprovalRequest: (callback: (event: ApprovalRequestEvent) => void) => () => void;
  respondToApproval: (taskId: string, approved: boolean) => Promise<void>;
}

export function exposeLangGraphAPI(): void {
  const api: LangGraphAPI = {
    startWorkflow: (workflowId: string, projectPath: string, tasks: Task[]) =>
      ipcRenderer.invoke('langgraph:startWorkflow', { workflowId, projectPath, tasks }),

    getWorkflowState: (workflowId: string) =>
      ipcRenderer.invoke('langgraph:getWorkflowState', workflowId),

    resumeWorkflow: (workflowId: string, tasks: Task[]) =>
      ipcRenderer.invoke('langgraph:resumeWorkflow', { workflowId, tasks }),

    onStateUpdate: (callback: (event: StateUpdateEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: StateUpdateEvent) => {
        callback(data);
      };
      ipcRenderer.on('langgraph:state-update', listener);

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('langgraph:state-update', listener);
      };
    },

    onApprovalRequest: (callback: (event: ApprovalRequestEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: ApprovalRequestEvent) => {
        callback(data);
      };
      ipcRenderer.on('langgraph:approval-request', listener);

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('langgraph:approval-request', listener);
      };
    },

    respondToApproval: (taskId: string, approved: boolean) =>
      ipcRenderer.invoke('langgraph:respondToApproval', { taskId, approved }),
  };

  contextBridge.exposeInMainWorld('langGraphAPI', api);
}
