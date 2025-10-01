import { contextBridge, ipcRenderer } from 'electron';
import type { SettingsAPI, SettingsBackup } from '../../types/api';

export function exposeSettingsAPI(): void {
  contextBridge.exposeInMainWorld('settingsAPI', {
    findFiles: (projectPath: string) => ipcRenderer.invoke('settings:find-files', projectPath),

    createBackup: (projectPath: string) =>
      ipcRenderer.invoke('settings:create-backup', projectPath),

    saveBackup: (backup: SettingsBackup, filePath: string) =>
      ipcRenderer.invoke('settings:save-backup', backup, filePath),

    loadBackup: (filePath: string) => ipcRenderer.invoke('settings:load-backup', filePath),

    restoreBackup: (backup: SettingsBackup) =>
      ipcRenderer.invoke('settings:restore-backup', backup),

    readFile: (filePath: string) => ipcRenderer.invoke('settings:read-file', filePath),

    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke('settings:write-file', filePath, content),

    deleteFile: (filePath: string) => ipcRenderer.invoke('settings:delete-file', filePath),

    validateMcpJson: (content: string) =>
      ipcRenderer.invoke('settings:validate-mcp-json', content),

    // MCP Configuration Management
    listMcpConfigs: (projectPath: string) =>
      ipcRenderer.invoke('settings:list-mcp-configs', projectPath),

    getMcpServers: () => ipcRenderer.invoke('settings:get-mcp-servers'),

    createMcpConfig: (projectPath: string, name: string, servers: string[]) =>
      ipcRenderer.invoke('settings:create-mcp-config', projectPath, name, servers),
  } as SettingsAPI);
}
