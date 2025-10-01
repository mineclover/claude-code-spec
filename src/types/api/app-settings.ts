export interface AppSettings {
  claudeProjectsPath?: string;
  currentProjectPath?: string;
  currentProjectDirName?: string;
  mcpResourcePaths?: string[]; // Additional MCP config file paths

  // Document paths
  claudeDocsPath?: string; // Claude documentation root path
  controllerDocsPath?: string; // Controller documentation root path
  metadataPath?: string; // Metadata directory path
}

export interface DefaultPaths {
  claudeProjectsPath: string;
  mcpConfigPath: string;
  claudeDocsPath: string;
  controllerDocsPath: string;
  metadataPath: string;
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

  // Document paths
  getClaudeDocsPath: () => Promise<string | undefined>;
  setClaudeDocsPath: (path: string) => Promise<{ success: boolean }>;
  getControllerDocsPath: () => Promise<string | undefined>;
  setControllerDocsPath: (path: string) => Promise<{ success: boolean }>;
  getMetadataPath: () => Promise<string | undefined>;
  setMetadataPath: (path: string) => Promise<{ success: boolean }>;
}
