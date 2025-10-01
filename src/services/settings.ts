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

/**
 * List all MCP configuration files in project's .claude/ directory
 */
export const listMcpConfigs = (projectPath: string): McpConfigFile[] => {
  const claudeDir = path.join(projectPath, '.claude');

  if (!fs.existsSync(claudeDir)) {
    return [];
  }

  const files = fs.readdirSync(claudeDir)
    .filter(file => file.startsWith('.mcp-') && file.endsWith('.json'))
    .map(file => {
      const filePath = path.join(claudeDir, file);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');

      return {
        name: file,
        path: filePath,
        content,
        lastModified: stats.mtimeMs,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return files;
};

/**
 * Get available MCP servers from user config (~/.claude.json) and additional resource paths
 * @param additionalPaths - Optional additional config file paths to read
 */
export const getMcpServerList = (additionalPaths?: string[]): { servers: McpServer[], error?: string, sourcePaths: string[] } => {
  const allServers: McpServer[] = [];
  const sourcePathsSet = new Set<string>(); // Track unique source paths
  const errors: string[] = [];
  const serverNames = new Set<string>(); // Track unique server names

  // Helper function to read servers from a config file
  const readServersFromPath = (configPath: string): McpServer[] => {
    try {
      if (!fs.existsSync(configPath)) {
        return [];
      }

      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);

      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        return [];
      }

      const servers: McpServer[] = Object.entries(config.mcpServers).map(([name, server]: [string, any]) => ({
        name,
        type: server.type || 'stdio',
        command: server.command || '',
        args: server.args || [],
        env: server.env || {},
      }));

      // Normalize path and add to set (prevents duplicates)
      const normalizedPath = path.normalize(configPath);
      sourcePathsSet.add(normalizedPath);
      return servers;
    } catch (error) {
      errors.push(`Failed to read ${configPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  };

  // Read from default ~/.claude.json
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (homeDir) {
    const claudeConfigPath = path.join(homeDir, '.claude.json');
    const defaultServers = readServersFromPath(claudeConfigPath);
    for (const server of defaultServers) {
      if (!serverNames.has(server.name)) {
        allServers.push(server);
        serverNames.add(server.name);
      }
    }
  }

  // Read from additional paths
  if (additionalPaths && additionalPaths.length > 0) {
    for (const additionalPath of additionalPaths) {
      // Expand ~ in path
      const expandedPath = additionalPath.startsWith('~')
        ? path.join(homeDir || '', additionalPath.slice(1))
        : additionalPath;

      // Normalize and check if we've already read this path
      const normalizedPath = path.normalize(expandedPath);
      if (sourcePathsSet.has(normalizedPath)) {
        continue; // Skip duplicate paths
      }

      const additionalServers = readServersFromPath(expandedPath);
      for (const server of additionalServers) {
        if (!serverNames.has(server.name)) {
          allServers.push(server);
          serverNames.add(server.name);
        }
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
  servers: string[]
): { success: boolean; path?: string; error?: string } => {
  try {
    // Get available servers
    const { servers: availableServers, error } = getMcpServerList();
    if (error) {
      return { success: false, error };
    }

    // Filter selected servers
    const selectedServers = availableServers.filter(s => servers.includes(s.name));
    if (selectedServers.length === 0) {
      return { success: false, error: 'No servers selected' };
    }

    // Build MCP config
    const mcpConfig: Record<string, any> = {
      mcpServers: {},
    };

    for (const server of selectedServers) {
      mcpConfig.mcpServers[server.name] = {
        type: server.type,
        command: server.command,
        args: server.args,
        env: server.env,
      };
    }

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
