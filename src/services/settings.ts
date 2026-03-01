/**
 * Settings File Management Service
 * Handles backup, editing, and restoration of project configuration files
 */

import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// Types
// ============================================================================

export interface SettingsFile {
  path: string;
  name: string;
  exists: boolean;
  content?: string;
  backup?: string;
  lastModified?: number;
}

export interface ProjectSettings {
  projectPath: string;
  claudeMd?: SettingsFile;
  mcpJson?: SettingsFile;
  claudeDir?: string[];
}

export interface SettingsBackup {
  timestamp: number;
  projectPath: string;
  files: Record<string, string>; // filename -> content
}

// ============================================================================
// File Discovery
// ============================================================================

export const findSettingsFiles = (projectPath: string): ProjectSettings => {
  const settings: ProjectSettings = {
    projectPath,
  };

  // Check CLAUDE.md
  const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
  if (fs.existsSync(claudeMdPath)) {
    const stats = fs.statSync(claudeMdPath);
    settings.claudeMd = {
      path: claudeMdPath,
      name: 'CLAUDE.md',
      exists: true,
      content: fs.readFileSync(claudeMdPath, 'utf-8'),
      lastModified: stats.mtimeMs,
    };
  } else {
    settings.claudeMd = {
      path: claudeMdPath,
      name: 'CLAUDE.md',
      exists: false,
    };
  }

  // Check .mcp.json
  const mcpJsonPath = path.join(projectPath, '.mcp.json');
  if (fs.existsSync(mcpJsonPath)) {
    const stats = fs.statSync(mcpJsonPath);
    settings.mcpJson = {
      path: mcpJsonPath,
      name: '.mcp.json',
      exists: true,
      content: fs.readFileSync(mcpJsonPath, 'utf-8'),
      lastModified: stats.mtimeMs,
    };
  } else {
    settings.mcpJson = {
      path: mcpJsonPath,
      name: '.mcp.json',
      exists: false,
    };
  }

  // Check .claude/ directory
  const claudeDirPath = path.join(projectPath, '.claude');
  if (fs.existsSync(claudeDirPath) && fs.statSync(claudeDirPath).isDirectory()) {
    settings.claudeDir = fs.readdirSync(claudeDirPath).filter((file) => {
      const filePath = path.join(claudeDirPath, file);
      return fs.statSync(filePath).isFile();
    });
  }

  return settings;
};

// ============================================================================
// Backup Operations
// ============================================================================

export const createBackup = (projectPath: string): SettingsBackup => {
  const settings = findSettingsFiles(projectPath);
  const backup: SettingsBackup = {
    timestamp: Date.now(),
    projectPath,
    files: {},
  };

  // Backup CLAUDE.md
  if (settings.claudeMd?.exists && settings.claudeMd.content) {
    backup.files['CLAUDE.md'] = settings.claudeMd.content;
  }

  // Backup .mcp.json
  if (settings.mcpJson?.exists && settings.mcpJson.content) {
    backup.files['.mcp.json'] = settings.mcpJson.content;
  }

  // Backup .claude/ files
  if (settings.claudeDir) {
    const claudeDirPath = path.join(projectPath, '.claude');
    for (const file of settings.claudeDir) {
      const filePath = path.join(claudeDirPath, file);
      backup.files[`.claude/${file}`] = fs.readFileSync(filePath, 'utf-8');
    }
  }

  return backup;
};

export const saveBackupToFile = (backup: SettingsBackup, outputPath: string): void => {
  fs.writeFileSync(outputPath, JSON.stringify(backup, null, 2), 'utf-8');
  console.log(`[Settings] Backup saved to: ${outputPath}`);
};

export const loadBackupFromFile = (backupPath: string): SettingsBackup => {
  const content = fs.readFileSync(backupPath, 'utf-8');
  return JSON.parse(content) as SettingsBackup;
};

export const restoreBackup = (backup: SettingsBackup): void => {
  for (const [filename, content] of Object.entries(backup.files)) {
    const filePath = path.join(backup.projectPath, filename);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[Settings] Restored: ${filename}`);
  }
};

// ============================================================================
// File Operations
// ============================================================================

export const readSettingsFile = (filePath: string): string | null => {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
  } catch (error) {
    console.error('[Settings] Failed to read file:', filePath, error);
    return null;
  }
};

export const writeSettingsFile = (filePath: string, content: string): boolean => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[Settings] Wrote file: ${filePath}`);
    return true;
  } catch (error) {
    console.error('[Settings] Failed to write file:', filePath, error);
    return false;
  }
};

export const deleteSettingsFile = (filePath: string): boolean => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Settings] Deleted file: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Settings] Failed to delete file:', filePath, error);
    return false;
  }
};

// ============================================================================
// Validation
// ============================================================================

export const validateMcpJson = (content: string): { valid: boolean; error?: string } => {
  try {
    JSON.parse(content);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    };
  }
};

// ============================================================================
// MCP Configuration Management
// ============================================================================

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

interface McpServerListOptions {
  additionalPaths?: string[];
  projectPath?: string;
}

const MCP_FILE_PATTERN = /^\.mcp(?:[-.].+)?\.json$/;
const PROJECT_MCP_DIRECTORIES = ['.claude', '.codex', '.gemini'] as const;

function listMcpConfigFilesInDirectory(dirPath: string): string[] {
  try {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      return [];
    }

    return fs
      .readdirSync(dirPath)
      .filter((fileName) => MCP_FILE_PATTERN.test(fileName))
      .map((fileName) => path.join(dirPath, fileName))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function collectProjectMcpCandidates(projectPath: string): string[] {
  const ordered = new Set<string>();
  const add = (targetPath: string) => {
    ordered.add(targetPath);
  };

  // Root-level primary files first.
  add(path.join(projectPath, '.mcp.json'));
  add(path.join(projectPath, '.mcp.local.json'));

  // Root-level profile files (.mcp-dev.json, .mcp-analysis.json, ...)
  for (const targetPath of listMcpConfigFilesInDirectory(projectPath)) {
    add(targetPath);
  }

  // Tool directories (shared MCP schema across CLIs).
  for (const dirName of PROJECT_MCP_DIRECTORIES) {
    const toolDir = path.join(projectPath, dirName);
    add(path.join(toolDir, '.mcp.json'));
    add(path.join(toolDir, '.mcp.local.json'));
    for (const targetPath of listMcpConfigFilesInDirectory(toolDir)) {
      add(targetPath);
    }
  }

  return Array.from(ordered);
}

function toProjectRelativePath(filePath: string, projectPath: string): string {
  const normalizedProjectPath = path.normalize(path.resolve(projectPath));
  const normalizedFilePath = path.normalize(path.resolve(filePath));
  if (normalizedFilePath.startsWith(`${normalizedProjectPath}${path.sep}`)) {
    return normalizedFilePath.slice(normalizedProjectPath.length + 1);
  }
  return path.basename(normalizedFilePath);
}

function buildMcpConfigPayload(servers: McpServer[]): {
  mcpServers: Record<string, Omit<McpServer, 'name'>>;
} {
  const mcpConfig: {
    mcpServers: Record<string, Omit<McpServer, 'name'>>;
  } = {
    mcpServers: {},
  };

  for (const server of servers) {
    mcpConfig.mcpServers[server.name] = {
      type: server.type,
      command: server.command,
      args: server.args,
      env: server.env,
    };
  }

  return mcpConfig;
}

function resolveDefaultMcpConfigPath(projectPath: string, target: McpDefaultConfigTarget): string {
  switch (target) {
    case 'project':
      return path.join(projectPath, '.mcp.json');
    case 'claude':
      return path.join(projectPath, '.claude', '.mcp.json');
    case 'codex':
      return path.join(projectPath, '.codex', '.mcp.json');
    case 'gemini':
      return path.join(projectPath, '.gemini', '.mcp.json');
    default:
      return path.join(projectPath, '.mcp.json');
  }
}

function resolveSelectedServers(
  projectPath: string,
  selectedServerNames: string[],
  options: Pick<McpServerListOptions, 'additionalPaths'> = {},
): { selectedServers: McpServer[]; error?: string } {
  const { servers: availableServers, error } = getMcpServerList({
    additionalPaths: options.additionalPaths,
    projectPath,
  });

  if (error) {
    return { selectedServers: [], error };
  }

  const selectedServers = availableServers.filter((server) =>
    selectedServerNames.includes(server.name),
  );
  if (selectedServers.length === 0) {
    return { selectedServers: [], error: 'No servers selected' };
  }

  return { selectedServers };
}

/**
 * List MCP configuration files from project root and tool-specific directories.
 */
export const listMcpConfigs = (projectPath: string): McpConfigFile[] => {
  const candidatePaths = collectProjectMcpCandidates(projectPath);

  return candidatePaths
    .filter((candidatePath) => fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile())
    .map((candidatePath) => {
      const stats = fs.statSync(candidatePath);
      const content = fs.readFileSync(candidatePath, 'utf-8');

      return {
        name: toProjectRelativePath(candidatePath, projectPath),
        path: candidatePath,
        content,
        lastModified: stats.mtimeMs,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Get available MCP servers from user config (~/.claude.json) and additional resource paths
 * @param additionalPaths - Optional additional config file paths to read
 */
export const getMcpServerList = (
  options: McpServerListOptions = {},
): { servers: McpServer[]; error?: string; sourcePaths: string[] } => {
  const { additionalPaths, projectPath } = options;
  const allServers: McpServer[] = [];
  const sourcePathsSet = new Set<string>(); // Track unique source paths
  const attemptedPaths = new Set<string>();
  const errors: string[] = [];
  const serverNames = new Set<string>(); // Track unique server names
  const homeDir = process.env.HOME || process.env.USERPROFILE;

  const normalizeConfigPath = (targetPath: string): string => {
    const expandedPath =
      targetPath.startsWith('~') && homeDir ? path.join(homeDir, targetPath.slice(1)) : targetPath;
    return path.normalize(path.resolve(expandedPath));
  };

  const projectCandidates = projectPath ? collectProjectMcpCandidates(projectPath) : [];
  const sourceCandidates = [
    homeDir ? path.join(homeDir, '.claude.json') : null,
    ...projectCandidates,
    ...(additionalPaths ?? []),
  ].filter((item): item is string => Boolean(item));

  // Helper function to read servers from a config file
  const readServersFromPath = (configPath: string): McpServer[] => {
    const normalizedPath = normalizeConfigPath(configPath);
    if (attemptedPaths.has(normalizedPath)) {
      return [];
    }
    attemptedPaths.add(normalizedPath);

    try {
      if (!fs.existsSync(normalizedPath)) {
        return [];
      }

      const content = fs.readFileSync(normalizedPath, 'utf-8');
      const config = JSON.parse(content);

      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        return [];
      }

      const servers: McpServer[] = Object.entries(config.mcpServers).map(
        ([name, server]: [string, unknown]) => {
          const serverConfig = server as Partial<McpServer>;
          return {
            name,
            type: serverConfig.type || 'stdio',
            command: serverConfig.command || '',
            args: serverConfig.args || [],
            env: serverConfig.env || {},
          };
        },
      );

      sourcePathsSet.add(normalizedPath);
      return servers;
    } catch (error) {
      errors.push(
        `Failed to read ${normalizedPath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  };

  for (const candidatePath of sourceCandidates) {
    const discoveredServers = readServersFromPath(candidatePath);
    for (const server of discoveredServers) {
      if (!serverNames.has(server.name)) {
        allServers.push(server);
        serverNames.add(server.name);
      }
    }
  }

  if (allServers.length === 0 && errors.length > 0) {
    return { servers: [], error: errors.join('; '), sourcePaths: Array.from(sourcePathsSet) };
  }

  return { servers: allServers, sourcePaths: Array.from(sourcePathsSet) };
};

/**
 * Create a new MCP configuration file with template
 */
export const createMcpConfig = (
  projectPath: string,
  name: string,
  servers: string[],
  options: Pick<McpServerListOptions, 'additionalPaths'> = {},
): { success: boolean; path?: string; error?: string } => {
  try {
    const { selectedServers, error } = resolveSelectedServers(projectPath, servers, options);
    if (error) {
      return { success: false, error };
    }

    const mcpConfig = buildMcpConfigPayload(selectedServers);

    // Ensure .claude/ directory exists
    const claudeDir = path.join(projectPath, '.claude');
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    // Write config file
    const fileName = name.startsWith('.mcp-') ? name : `.mcp-${name}.json`;
    const filePath = path.join(claudeDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
    console.log(`[Settings] Created MCP config: ${filePath}`);

    return { success: true, path: filePath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create MCP config',
    };
  }
};

/**
 * Create default MCP config file without a profile suffix.
 * Examples: .mcp.json, .claude/.mcp.json, .codex/.mcp.json
 */
export const createMcpDefaultConfig = (
  projectPath: string,
  target: McpDefaultConfigTarget,
  servers: string[],
  options: Pick<McpServerListOptions, 'additionalPaths'> = {},
): { success: boolean; path?: string; error?: string } => {
  try {
    const { selectedServers, error } = resolveSelectedServers(projectPath, servers, options);
    if (error) {
      return { success: false, error };
    }

    const mcpConfig = buildMcpConfigPayload(selectedServers);
    const filePath = resolveDefaultMcpConfigPath(projectPath, target);
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
    console.log(`[Settings] Created default MCP config: ${filePath}`);

    return { success: true, path: filePath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create default MCP config',
    };
  }
};
