/**
 * Task API exposure
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { TaskListItem } from '../../types/task';

export interface TaskAPI {
  listTasks: (projectPath: string) => Promise<TaskListItem[]>;
  getTask: (projectPath: string, taskId: string) => Promise<string | null>;
  createTask: (
    projectPath: string,
    taskId: string,
    content: string,
  ) => Promise<{ success: boolean; error?: string }>;
  updateTask: (
    projectPath: string,
    taskId: string,
    content: string,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteTask: (
    projectPath: string,
    taskId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  executeTask: (
    projectPath: string,
    taskId: string,
  ) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  validateTask: (
    projectPath: string,
    content: string,
  ) => Promise<{ valid: boolean; errors: any[]; warnings: any[] }>;
  updateTaskStatus: (
    projectPath: string,
    taskId: string,
    newStatus: string,
    updatedBy?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  canExecuteTask: (
    projectPath: string,
    taskId: string,
  ) => Promise<{ canExecute: boolean; reason?: string; blockingTasks?: string[] }>;
  getNextTask: (projectPath: string) => Promise<any>;
  getTaskStats: (projectPath: string) => Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    executable: number;
  }>;
  startTask: (
    projectPath: string,
    taskId: string,
    agentName?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  completeTask: (
    projectPath: string,
    taskId: string,
    agentName?: string,
    reviewNotes?: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

export function exposeTaskAPI(): void {
  const taskAPI: TaskAPI = {
    listTasks: (projectPath: string) => ipcRenderer.invoke('task:listTasks', { projectPath }),

    getTask: (projectPath: string, taskId: string) =>
      ipcRenderer.invoke('task:getTask', { projectPath, taskId }),

    createTask: (projectPath: string, taskId: string, content: string) =>
      ipcRenderer.invoke('task:createTask', { projectPath, taskId, content }),

    updateTask: (projectPath: string, taskId: string, content: string) =>
      ipcRenderer.invoke('task:updateTask', { projectPath, taskId, content }),

    deleteTask: (projectPath: string, taskId: string) =>
      ipcRenderer.invoke('task:deleteTask', { projectPath, taskId }),

    executeTask: (projectPath: string, taskId: string) =>
      ipcRenderer.invoke('task:executeTask', { projectPath, taskId }),

    validateTask: (projectPath: string, content: string) =>
      ipcRenderer.invoke('task:validateTask', { projectPath, content }),

    updateTaskStatus: (
      projectPath: string,
      taskId: string,
      newStatus: string,
      updatedBy?: string,
    ) => ipcRenderer.invoke('task:updateTaskStatus', { projectPath, taskId, newStatus, updatedBy }),

    canExecuteTask: (projectPath: string, taskId: string) =>
      ipcRenderer.invoke('task:canExecuteTask', { projectPath, taskId }),

    getNextTask: (projectPath: string) => ipcRenderer.invoke('task:getNextTask', { projectPath }),

    getTaskStats: (projectPath: string) => ipcRenderer.invoke('task:getTaskStats', { projectPath }),

    startTask: (projectPath: string, taskId: string, agentName?: string) =>
      ipcRenderer.invoke('task:startTask', { projectPath, taskId, agentName }),

    completeTask: (projectPath: string, taskId: string, agentName?: string, reviewNotes?: string) =>
      ipcRenderer.invoke('task:completeTask', { projectPath, taskId, agentName, reviewNotes }),
  };

  contextBridge.exposeInMainWorld('taskAPI', taskAPI);
}
