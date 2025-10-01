import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettingsAPI } from '../../types/api';

export function exposeAppSettingsAPI(): void {
  contextBridge.exposeInMainWorld('appSettingsAPI', {
    getAllSettings: () => ipcRenderer.invoke('app-settings:get-all'),
    getSettingsPath: () => ipcRenderer.invoke('app-settings:get-settings-path'),
    getClaudeProjectsPath: () => ipcRenderer.invoke('app-settings:get-claude-projects-path'),
    setClaudeProjectsPath: (path: string) =>
      ipcRenderer.invoke('app-settings:set-claude-projects-path', path),
    getCurrentProjectPath: () => ipcRenderer.invoke('app-settings:get-current-project-path'),
    getCurrentProjectDirName: () =>
      ipcRenderer.invoke('app-settings:get-current-project-dir-name'),
    setCurrentProject: (projectPath: string, projectDirName: string) =>
      ipcRenderer.invoke('app-settings:set-current-project', projectPath, projectDirName),
    clearCurrentProject: () => ipcRenderer.invoke('app-settings:clear-current-project'),
    getMcpResourcePaths: () => ipcRenderer.invoke('app-settings:get-mcp-resource-paths'),
    setMcpResourcePaths: (paths: string[]) =>
      ipcRenderer.invoke('app-settings:set-mcp-resource-paths', paths),
    addMcpResourcePath: (path: string) =>
      ipcRenderer.invoke('app-settings:add-mcp-resource-path', path),
    removeMcpResourcePath: (path: string) =>
      ipcRenderer.invoke('app-settings:remove-mcp-resource-path', path),
    getDefaultPaths: () => ipcRenderer.invoke('app-settings:get-default-paths'),
    getDefaultMcpResourcePaths: () =>
      ipcRenderer.invoke('app-settings:get-default-mcp-resource-paths'),

    // Document paths
    getClaudeDocsPath: () => ipcRenderer.invoke('app-settings:get-claude-docs-path'),
    setClaudeDocsPath: (path: string) =>
      ipcRenderer.invoke('app-settings:set-claude-docs-path', path),
    getControllerDocsPath: () => ipcRenderer.invoke('app-settings:get-controller-docs-path'),
    setControllerDocsPath: (path: string) =>
      ipcRenderer.invoke('app-settings:set-controller-docs-path', path),
    getMetadataPath: () => ipcRenderer.invoke('app-settings:get-metadata-path'),
    setMetadataPath: (path: string) =>
      ipcRenderer.invoke('app-settings:set-metadata-path', path),
  } as AppSettingsAPI);
}
