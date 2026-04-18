/**
 * MCP Registry / Policy / Resolver API type contract.
 */

import type {
  McpExecutionOverride,
  McpPolicyFile,
  McpPreset,
  McpPresetsFile,
  McpRegistryEntry,
  ResolvedMcpConfig,
  ResolvedRegistry,
} from '../mcp-policy';

export type McpEntryScope = 'user' | 'project';

export interface McpResolveRequest {
  projectPath: string;
  override?: McpExecutionOverride;
  /** When true, also write the resolved config to .claude/.mcp-generated-<hash>.json */
  materialize?: boolean;
}

export interface McpResolveResult {
  resolved: ResolvedMcpConfig;
  registry: ResolvedRegistry;
  policy: McpPolicyFile;
  /** Set when `materialize: true`. */
  writtenPath?: string;
}

export interface McpAPI {
  getRegistry: (projectPath: string | null) => Promise<ResolvedRegistry>;
  saveRegistryEntry: (
    scope: McpEntryScope,
    entry: McpRegistryEntry,
    projectPath: string | null,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteRegistryEntry: (
    scope: McpEntryScope,
    id: string,
    projectPath: string | null,
  ) => Promise<{ success: boolean; error?: string }>;
  getPolicy: (projectPath: string) => Promise<McpPolicyFile>;
  savePolicy: (
    projectPath: string,
    policy: McpPolicyFile,
  ) => Promise<{ success: boolean; error?: string }>;
  resolve: (request: McpResolveRequest) => Promise<McpResolveResult>;
  listPresets: (projectPath: string) => Promise<McpPresetsFile>;
  savePreset: (
    projectPath: string,
    preset: McpPreset,
  ) => Promise<{ success: boolean; error?: string }>;
  deletePreset: (
    projectPath: string,
    id: string,
  ) => Promise<{ success: boolean; error?: string }>;
}
