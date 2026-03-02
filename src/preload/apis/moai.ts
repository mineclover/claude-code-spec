/**
 * MoAI preload API
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { MoaiAPI, MoaiStatuslineConfig } from '../../types/api/moai';

export function exposeMoaiAPI(): void {
  contextBridge.exposeInMainWorld('moaiAPI', {
    getStatusline: () => ipcRenderer.invoke('moai:get-statusline'),
    saveStatuslineConfig: (config: MoaiStatuslineConfig) =>
      ipcRenderer.invoke('moai:save-statusline-config', config),
    setClaudeStatusLine: (enabled: boolean) =>
      ipcRenderer.invoke('moai:set-claude-statusline', enabled),
    runPreview: () => ipcRenderer.invoke('moai:run-preview'),
  } as MoaiAPI);
}
