/**
 * Settings preload API
 * Merged: App settings + MCP config + project settings
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { SettingsAPI, SettingsBackup } from '../../types/api';
import type { McpDefaultConfigTarget } from '../../types/api/settings';
import type { MaintenanceRegistryService } from '../../types/maintenance-registry';

export function exposeSettingsAPI(): void {
  contextBridge.exposeInMainWorld('settingsAPI', {
    // App settings
    getAllSettings: () => ipcRenderer.invoke('settings:get-all'),
    getSettingsPath: () => ipcRenderer.invoke('settings:get-settings-path'),
    getClaudeProjectsPath: () => ipcRenderer.invoke('settings:get-claude-projects-path'),
    setClaudeProjectsPath: (path: string) =>
      ipcRenderer.invoke('settings:set-claude-projects-path', path),
    getCurrentProjectPath: () => ipcRenderer.invoke('settings:get-current-project-path'),
    getCurrentProjectDirName: () => ipcRenderer.invoke('settings:get-current-project-dir-name'),
    setCurrentProject: (projectPath: string, projectDirName: string) =>
      ipcRenderer.invoke('settings:set-current-project', projectPath, projectDirName),
    clearCurrentProject: () => ipcRenderer.invoke('settings:clear-current-project'),
    getMaintenanceServices: () => ipcRenderer.invoke('settings:get-maintenance-services'),
    setMaintenanceServices: (services: MaintenanceRegistryService[]) =>
      ipcRenderer.invoke('settings:set-maintenance-services', services),

    // MCP resource paths
    getMcpResourcePaths: () => ipcRenderer.invoke('settings:get-mcp-resource-paths'),
    setMcpResourcePaths: (paths: string[]) =>
      ipcRenderer.invoke('settings:set-mcp-resource-paths', paths),
    addMcpResourcePath: (path: string) =>
      ipcRenderer.invoke('settings:add-mcp-resource-path', path),
    removeMcpResourcePath: (path: string) =>
      ipcRenderer.invoke('settings:remove-mcp-resource-path', path),
    getDefaultPaths: () => ipcRenderer.invoke('settings:get-default-paths'),
    getDefaultMcpResourcePaths: () => ipcRenderer.invoke('settings:get-default-mcp-resource-paths'),

    // Project settings files
    findFiles: (projectPath: string) => ipcRenderer.invoke('settings:find-files', projectPath),
    readFile: (filePath: string) => ipcRenderer.invoke('settings:read-file', filePath),
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke('settings:write-file', filePath, content),
    deleteFile: (filePath: string) => ipcRenderer.invoke('settings:delete-file', filePath),
    validateMcpJson: (content: string) => ipcRenderer.invoke('settings:validate-mcp-json', content),

    // MCP config management
    listMcpConfigs: (projectPath: string) =>
      ipcRenderer.invoke('settings:list-mcp-configs', projectPath),
    getMcpServers: (projectPath?: string) =>
      ipcRenderer.invoke('settings:get-mcp-servers', projectPath),
    createMcpConfig: (projectPath: string, name: string, servers: string[]) =>
      ipcRenderer.invoke('settings:create-mcp-config', projectPath, name, servers),
    createMcpDefaultConfig: (
      projectPath: string,
      target: McpDefaultConfigTarget,
      servers: string[],
    ) => ipcRenderer.invoke('settings:create-mcp-default-config', projectPath, target, servers),

    // Backup
    createBackup: (projectPath: string) =>
      ipcRenderer.invoke('settings:create-backup', projectPath),
    saveBackup: (backup: SettingsBackup, filePath: string) =>
      ipcRenderer.invoke('settings:save-backup', backup, filePath),
    loadBackup: (filePath: string) => ipcRenderer.invoke('settings:load-backup', filePath),
    restoreBackup: (backup: SettingsBackup) =>
      ipcRenderer.invoke('settings:restore-backup', backup),
  } as SettingsAPI);
}
