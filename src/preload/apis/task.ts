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
  };

  contextBridge.exposeInMainWorld('taskAPI', taskAPI);
}
