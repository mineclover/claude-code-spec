/**
 * ToolsAPI type contract
 */

import type { CLIToolDefinition } from '../cli-tool';
import type {
  ReferenceAssetActionResult,
  ReferenceAssetItem,
  ReferenceAssetPreference,
  ReferenceAssetPreferenceMap,
  ReferenceAssetPreferenceUpdate,
  ReferenceAssetReadResult,
  ReferenceAssetType,
  ReferenceProvider,
} from '../reference-assets';
import type {
  CliToolBatchUpdateSummary,
  CliToolUpdateLogEntry,
  CliToolUpdateResult,
  CliToolVersionInfo,
  InstalledSkillInfo,
  ManagedCliTool,
  SkillActivationAuditEvent,
  SkillInstallPathInfo,
  SkillProvider,
} from '../tool-maintenance';

export interface ToolsAPI {
  getRegisteredTools: () => Promise<CLIToolDefinition[]>;
  getToolById: (toolId: string) => Promise<CLIToolDefinition | null>;
  getMaintenanceTools: () => Promise<ManagedCliTool[]>;
  checkToolVersions: (toolIds?: string[]) => Promise<CliToolVersionInfo[]>;
  runToolUpdate: (toolId: string) => Promise<CliToolUpdateResult>;
  runToolUpdates: (toolIds: string[]) => Promise<CliToolBatchUpdateSummary>;
  getToolUpdateLogs: (limit?: number, toolId?: string) => Promise<CliToolUpdateLogEntry[]>;
  getSkillInstallPaths: () => Promise<SkillInstallPathInfo[]>;
  getInstalledSkills: () => Promise<InstalledSkillInfo[]>;
  getSkillActivationEvents: (limit?: number) => Promise<SkillActivationAuditEvent[]>;
  listReferenceAssets: (
    assetType: ReferenceAssetType,
    provider?: ReferenceProvider,
  ) => Promise<ReferenceAssetItem[]>;
  readReferenceAsset: (relativePath: string) => Promise<ReferenceAssetReadResult>;
  openReferenceAsset: (relativePath: string) => Promise<ReferenceAssetActionResult>;
  revealReferenceAsset: (relativePath: string) => Promise<ReferenceAssetActionResult>;
  getReferenceAssetPreferences: () => Promise<ReferenceAssetPreferenceMap>;
  setReferenceAssetPreference: (
    relativePath: string,
    preference: ReferenceAssetPreference,
  ) => Promise<{ success: boolean }>;
  setReferenceAssetPreferencesBatch: (
    updates: ReferenceAssetPreferenceUpdate[],
  ) => Promise<{ success: boolean; updated: number }>;
  setSkillActivation: (
    provider: SkillProvider,
    skillId: string,
    active: boolean,
  ) => Promise<InstalledSkillInfo>;
}
