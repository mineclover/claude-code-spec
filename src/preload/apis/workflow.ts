/**
 * Workflow API exposure
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { WorkflowEvent, WorkflowStats } from '../../services/WorkflowEngine';

export interface WorkflowAPI {
  startWorkflow: (projectPath: string) => Promise<void>;
  pauseWorkflow: (projectPath: string) => Promise<void>;
  resumeWorkflow: (projectPath: string) => Promise<void>;
  stopWorkflow: (projectPath: string) => Promise<void>;
  getWorkflowStats: (projectPath: string) => Promise<WorkflowStats>;
  isWorkflowRunning: (projectPath: string) => Promise<boolean>;
  onWorkflowEvent: (callback: (event: WorkflowEvent) => void) => () => void;
}

export function exposeWorkflowAPI(): void {
  const workflowAPI: WorkflowAPI = {
    startWorkflow: (projectPath: string) =>
      ipcRenderer.invoke('workflow:startWorkflow', { projectPath }),

    pauseWorkflow: (projectPath: string) =>
      ipcRenderer.invoke('workflow:pauseWorkflow', { projectPath }),

    resumeWorkflow: (projectPath: string) =>
      ipcRenderer.invoke('workflow:resumeWorkflow', { projectPath }),

    stopWorkflow: (projectPath: string) =>
      ipcRenderer.invoke('workflow:stopWorkflow', { projectPath }),

    getWorkflowStats: (projectPath: string) =>
      ipcRenderer.invoke('workflow:getWorkflowStats', { projectPath }),

    isWorkflowRunning: (projectPath: string) =>
      ipcRenderer.invoke('workflow:isWorkflowRunning', { projectPath }),

    onWorkflowEvent: (callback: (event: WorkflowEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, workflowEvent: WorkflowEvent) => {
        callback(workflowEvent);
      };

      ipcRenderer.on('workflow:event', listener);

      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener('workflow:event', listener);
      };
    },
  };

  contextBridge.exposeInMainWorld('workflowAPI', workflowAPI);
}
