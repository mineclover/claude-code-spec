/**
 * MCP preload API
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  McpAPI,
  McpEntryScope,
  McpResolveRequest,
} from '../../types/api/mcp';
import type { McpPolicyFile, McpPreset, McpRegistryEntry } from '../../types/mcp-policy';

export function exposeMcpAPI(): void {
  contextBridge.exposeInMainWorld('mcpAPI', {
    getRegistry: (projectPath: string | null) =>
      ipcRenderer.invoke('mcp:get-registry', projectPath),
    saveRegistryEntry: (
      scope: McpEntryScope,
      entry: McpRegistryEntry,
      projectPath: string | null,
    ) => ipcRenderer.invoke('mcp:save-registry-entry', scope, entry, projectPath),
    deleteRegistryEntry: (scope: McpEntryScope, id: string, projectPath: string | null) =>
      ipcRenderer.invoke('mcp:delete-registry-entry', scope, id, projectPath),
    getPolicy: (projectPath: string) => ipcRenderer.invoke('mcp:get-policy', projectPath),
    savePolicy: (projectPath: string, policy: McpPolicyFile) =>
      ipcRenderer.invoke('mcp:save-policy', projectPath, policy),
    resolve: (request: McpResolveRequest) => ipcRenderer.invoke('mcp:resolve', request),
    listPresets: (projectPath: string) => ipcRenderer.invoke('mcp:list-presets', projectPath),
    savePreset: (projectPath: string, preset: McpPreset) =>
      ipcRenderer.invoke('mcp:save-preset', projectPath, preset),
    deletePreset: (projectPath: string, id: string) =>
      ipcRenderer.invoke('mcp:delete-preset', projectPath, id),
  } as McpAPI);
}
