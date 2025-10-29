/**
 * Output-Style API exposure
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { OutputStyleAPI } from '../../types/api/outputStyle';

export function exposeOutputStyleAPI(): void {
  const outputStyleAPI: OutputStyleAPI = {
    listStyles: (projectPath) =>
      ipcRenderer.invoke('output-style:list', { projectPath }),

    getStyle: (projectPath, name) =>
      ipcRenderer.invoke('output-style:get', { projectPath, name }),

    createStyle: (projectPath, style) =>
      ipcRenderer.invoke('output-style:create', { projectPath, style }),

    updateStyle: (projectPath, name, style) =>
      ipcRenderer.invoke('output-style:update', { projectPath, name, style }),

    deleteStyle: (projectPath, name) =>
      ipcRenderer.invoke('output-style:delete', { projectPath, name }),

    listNames: (projectPath) =>
      ipcRenderer.invoke('output-style:list-names', { projectPath })
  };

  contextBridge.exposeInMainWorld('outputStyleAPI', outputStyleAPI);
}
