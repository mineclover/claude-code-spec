/**
 * Work Area API for renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { WorkArea } from '../../types/workArea';

export interface WorkAreaAPI {
  getWorkAreas: (projectPath: string) => Promise<WorkArea[]>;
  updateWorkAreas: (
    projectPath: string,
    areas: WorkArea[],
  ) => Promise<{ success: boolean; error?: string }>;
}

export function exposeWorkAreaAPI(): void {
  const workAreaAPI: WorkAreaAPI = {
    getWorkAreas: (projectPath) => ipcRenderer.invoke('work-area:getWorkAreas', { projectPath }),
    updateWorkAreas: (projectPath, areas) =>
      ipcRenderer.invoke('work-area:updateWorkAreas', { projectPath, areas }),
  };

  contextBridge.exposeInMainWorld('workAreaAPI', workAreaAPI);
}
