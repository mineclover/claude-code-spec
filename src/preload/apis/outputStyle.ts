/**
 * Output Style API exposure
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { OutputStyleListItem } from '../../types/outputStyle';

export interface OutputStyleAPI {
  listOutputStyles: (projectPath: string) => Promise<OutputStyleListItem[]>;
  getOutputStyle: (
    name: string,
    type: 'builtin' | 'user' | 'project',
    projectPath?: string,
  ) => Promise<string | null>;
  createOutputStyle: (
    name: string,
    description: string,
    instructions: string,
    type: 'user' | 'project',
    projectPath?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  updateOutputStyle: (
    name: string,
    description: string,
    instructions: string,
    type: 'user' | 'project',
    projectPath?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteOutputStyle: (
    name: string,
    type: 'user' | 'project',
    projectPath?: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

export function exposeOutputStyleAPI(): void {
  const outputStyleAPI: OutputStyleAPI = {
    listOutputStyles: (projectPath: string) =>
      ipcRenderer.invoke('output-style:listOutputStyles', { projectPath }),

    getOutputStyle: (name: string, type: 'builtin' | 'user' | 'project', projectPath?: string) =>
      ipcRenderer.invoke('output-style:getOutputStyle', { name, type, projectPath }),

    createOutputStyle: (
      name: string,
      description: string,
      instructions: string,
      type: 'user' | 'project',
      projectPath?: string,
    ) =>
      ipcRenderer.invoke('output-style:createOutputStyle', {
        name,
        description,
        instructions,
        type,
        projectPath,
      }),

    updateOutputStyle: (
      name: string,
      description: string,
      instructions: string,
      type: 'user' | 'project',
      projectPath?: string,
    ) =>
      ipcRenderer.invoke('output-style:updateOutputStyle', {
        name,
        description,
        instructions,
        type,
        projectPath,
      }),

    deleteOutputStyle: (name: string, type: 'user' | 'project', projectPath?: string) =>
      ipcRenderer.invoke('output-style:deleteOutputStyle', { name, type, projectPath }),
  };

  contextBridge.exposeInMainWorld('outputStyleAPI', outputStyleAPI);
}
