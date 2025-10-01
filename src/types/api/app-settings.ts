export interface AppSettings {
  claudeProjectsPath?: string;
  currentProjectPath?: string;
  currentProjectDirName?: string;
  mcpResourcePaths?: string[]; // Additional MCP config file paths
}

export interface DefaultPaths {
  claudeProjectsPath: string;
  mcpConfigPath: string;
}

export interface AppSettingsAPI {
  getAllSettings: () => Promise<AppSettings>;
  getClaudeProjectsPath: () => Promise<string | undefined>;
  setClaudeProjectsPath: (path: string) => Promise<{ success: boolean }>;
  getCurrentProjectPath: () => Promise<string | undefined>;
  getCurrentProjectDirName: () => Promise<string | undefined>;
  setCurrentProject: (projectPath: string, projectDirName: string) => Promise<{ success: boolean }>;
  clearCurrentProject: () => Promise<{ success: boolean }>;
  getMcpResourcePaths: () => Promise<string[]>;
  setMcpResourcePaths: (paths: string[]) => Promise<{ success: boolean }>;
  addMcpResourcePath: (path: string) => Promise<{ success: boolean }>;
  removeMcpResourcePath: (path: string) => Promise<{ success: boolean }>;
  getDefaultPaths: () => Promise<DefaultPaths>;
  getDefaultMcpResourcePaths: () => Promise<string[]>;
}
