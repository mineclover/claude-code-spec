/**
 * Dialog preload API
 */

import { contextBridge, ipcRenderer } from 'electron';

export interface DialogAPI {
  selectDirectory: () => Promise<string | null>;
}

export function exposeDialogAPI(): void {
  contextBridge.exposeInMainWorld('dialogAPI', {
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  } as DialogAPI);
}
