export interface SettingsFileInfo {
  path: string;
  name: string;
  exists: boolean;
  content?: string;
  lastModified?: number;
}

export interface ProjectSettings {
  projectPath: string;
  claudeMd?: SettingsFileInfo;
  mcpJson?: SettingsFileInfo;
  claudeDir?: SettingsFileInfo;
}

export interface SettingsBackup {
  timestamp: number;
  projectPath: string;
  files: Record<string, string>;
}

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

export interface SettingsAPI {
  // Find settings files in project
  findFiles: (projectPath: string) => Promise<ProjectSettings>;

  // Backup operations
  createBackup: (projectPath: string) => Promise<SettingsBackup>;
  saveBackup: (backup: SettingsBackup, filePath: string) => Promise<boolean>;
  loadBackup: (filePath: string) => Promise<SettingsBackup>;
  restoreBackup: (backup: SettingsBackup) => Promise<boolean>;

  // File operations
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  deleteFile: (filePath: string) => Promise<boolean>;

  // Validation
  validateMcpJson: (content: string) => Promise<{ valid: boolean; error?: string }>;

  // MCP Configuration Management
  listMcpConfigs: (projectPath: string) => Promise<McpConfigFile[]>;
  getMcpServers: () => Promise<{ servers: McpServer[]; error?: string; sourcePaths: string[] }>;
  createMcpConfig: (
    projectPath: string,
    name: string,
    servers: string[],
  ) => Promise<{ success: boolean; path?: string; error?: string }>;
}
