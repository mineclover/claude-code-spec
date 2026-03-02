/**
 * Tools preload API
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { ToolsAPI } from '../../types/api';
import type {
  ReferenceAssetPreference,
  ReferenceAssetPreferenceUpdate,
  ReferenceAssetType,
  ReferenceProvider,
} from '../../types/reference-assets';

export function exposeToolsAPI(): void {
  contextBridge.exposeInMainWorld('toolsAPI', {
    getRegisteredTools: () => ipcRenderer.invoke('tools:get-registered-tools'),
    getToolById: (toolId: string) => ipcRenderer.invoke('tools:get-tool-by-id', toolId),
    getMaintenanceTools: () => ipcRenderer.invoke('tools:get-maintenance-tools'),
    checkToolVersions: (toolIds?: string[]) =>
      ipcRenderer.invoke('tools:check-tool-versions', toolIds),
    runToolUpdate: (toolId: string) => ipcRenderer.invoke('tools:run-tool-update', toolId),
    runToolUpdates: (toolIds: string[]) => ipcRenderer.invoke('tools:run-tool-updates', toolIds),
    getToolUpdateLogs: (limit?: number, toolId?: string) =>
      ipcRenderer.invoke('tools:get-tool-update-logs', { limit, toolId }),
    getSkillInstallPaths: () => ipcRenderer.invoke('tools:get-skill-install-paths'),
    getInstalledSkills: () => ipcRenderer.invoke('tools:get-installed-skills'),
    getSkillActivationEvents: (limit?: number) =>
      ipcRenderer.invoke('tools:get-skill-activation-events', limit),
    listReferenceAssets: (assetType: ReferenceAssetType, provider?: ReferenceProvider) =>
      ipcRenderer.invoke('tools:list-reference-assets', assetType, provider),
    readReferenceAsset: (relativePath: string) =>
      ipcRenderer.invoke('tools:read-reference-asset', relativePath),
    openReferenceAsset: (relativePath: string) =>
      ipcRenderer.invoke('tools:open-reference-asset', relativePath),
    revealReferenceAsset: (relativePath: string) =>
      ipcRenderer.invoke('tools:reveal-reference-asset', relativePath),
    getReferenceAssetPreferences: () => ipcRenderer.invoke('tools:get-reference-asset-preferences'),
    setReferenceAssetPreference: (relativePath: string, preference: ReferenceAssetPreference) =>
      ipcRenderer.invoke('tools:set-reference-asset-preference', relativePath, preference),
    setReferenceAssetPreferencesBatch: (updates: ReferenceAssetPreferenceUpdate[]) =>
      ipcRenderer.invoke('tools:set-reference-asset-preferences-batch', updates),
    setSkillActivation: (provider, skillId, active) =>
      ipcRenderer.invoke('tools:set-skill-activation', { provider, skillId, active }),
    readSkillContent: (provider, skillId) =>
      ipcRenderer.invoke('tools:get-skill-content', { provider, skillId }),
    getCliStatus: () => ipcRenderer.invoke('tools:get-cli-status'),
    openCliStatusFile: () => ipcRenderer.invoke('tools:open-cli-status-file'),
  } as ToolsAPI);
}
