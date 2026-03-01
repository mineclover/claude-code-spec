/**
 * SettingsAPI type contract
 * Merged: App settings + MCP config management
 */

import type { MaintenanceRegistryService } from '../maintenance-registry';

export interface McpConfigFile {
  name: string;
  path: string;
  content: string;
  lastModified: number;
}

export interface McpServer {
  name: string;
  type: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

export type McpDefaultConfigTarget = 'project' | 'claude' | 'codex' | 'gemini';

export interface ProjectSettings {
  projectPath: string;
  claudeMd?: {
    path: string;
    name: string;
    exists: boolean;
    content?: string;
    lastModified?: number;
  };
  mcpJson?: {
    path: string;
    name: string;
    exists: boolean;
    content?: string;
    lastModified?: number;
  };
  claudeDir?: string[];
}

export interface SettingsBackup {
  timestamp: number;
  projectPath: string;
  files: Record<string, string>;
}

export interface SettingsAPI {
  // App settings
  getAllSettings: () => Promise<Record<string, unknown>>;
  getSettingsPath: () => Promise<string>;
  getClaudeProjectsPath: () => Promise<string | undefined>;
  setClaudeProjectsPath: (path: string) => Promise<{ success: boolean }>;
  getCurrentProjectPath: () => Promise<string | undefined>;
  getCurrentProjectDirName: () => Promise<string | undefined>;
  setCurrentProject: (projectPath: string, projectDirName: string) => Promise<{ success: boolean }>;
  clearCurrentProject: () => Promise<{ success: boolean }>;
  getMaintenanceServices: () => Promise<MaintenanceRegistryService[]>;
  setMaintenanceServices: (services: MaintenanceRegistryService[]) => Promise<{ success: boolean }>;

  // MCP resource paths
  getMcpResourcePaths: () => Promise<string[]>;
  setMcpResourcePaths: (paths: string[]) => Promise<{ success: boolean }>;
  addMcpResourcePath: (path: string) => Promise<{ success: boolean }>;
  removeMcpResourcePath: (path: string) => Promise<{ success: boolean }>;
  getDefaultPaths: () => Promise<{
    claudeProjectsPath: string;
    mcpConfigPath: string;
    claudeDocsPath: string;
    controllerDocsPath: string;
    metadataPath: string;
  }>;
  getDefaultMcpResourcePaths: () => Promise<string[]>;

  // Project settings files
  findFiles: (projectPath: string) => Promise<ProjectSettings>;
  readFile: (filePath: string) => Promise<string | null>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  deleteFile: (filePath: string) => Promise<boolean>;
  validateMcpJson: (content: string) => Promise<{ valid: boolean; error?: string }>;

  // MCP config management
  listMcpConfigs: (projectPath: string) => Promise<McpConfigFile[]>;
  getMcpServers: (
    projectPath?: string,
  ) => Promise<{ servers: McpServer[]; error?: string; sourcePaths: string[] }>;
  createMcpConfig: (
    projectPath: string,
    name: string,
    servers: string[],
  ) => Promise<{ success: boolean; path?: string; error?: string }>;
  createMcpDefaultConfig: (
    projectPath: string,
    target: McpDefaultConfigTarget,
    servers: string[],
  ) => Promise<{ success: boolean; path?: string; error?: string }>;

  // Backup
  createBackup: (projectPath: string) => Promise<SettingsBackup>;
  saveBackup: (backup: SettingsBackup, filePath: string) => Promise<void>;
  loadBackup: (filePath: string) => Promise<SettingsBackup>;
  restoreBackup: (backup: SettingsBackup) => Promise<void>;
}
