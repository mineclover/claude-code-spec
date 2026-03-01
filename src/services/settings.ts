/**
 * Settings File Management Service
 * Handles backup, editing, and restoration of project configuration files
 */

import fs from 'node:fs';
import os from 'node:os';
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

export type McpServerSourceScope = 'global' | 'project' | 'projectLocal';

export interface McpServerCandidate extends McpServer {
  sourcePath: string;
  sourceScope: McpServerSourceScope;
}

export type McpDefaultConfigTarget = 'project' | 'claude' | 'codex' | 'gemini';

interface McpServerListOptions {
  additionalPaths?: string[];
  projectPath?: string;
}

interface McpSourceCandidate {
  path: string;
  sourceScope: McpServerSourceScope;
  priority: number;
  order: number;
}

interface RankedMcpServerCandidate {
  candidate: McpServerCandidate;
  priority: number;
  order: number;
}

const MCP_FILE_PATTERN = /^\.mcp(?:[-.].+)?\.json$/;
const PROJECT_MCP_DIRECTORIES = ['.claude', '.codex', '.gemini'] as const;
const MCP_SOURCE_PRIORITY: Record<McpServerSourceScope, number> = {
  global: 0,
  project: 1,
  projectLocal: 2,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeConfigPath(targetPath: string, homeDir?: string): string {
  const expandedPath =
    targetPath.startsWith('~') && homeDir ? path.join(homeDir, targetPath.slice(1)) : targetPath;
  return path.normalize(path.resolve(expandedPath));
}

function isPathWithinRoot(targetPath: string, rootPath: string): boolean {
  return targetPath === rootPath || targetPath.startsWith(`${rootPath}${path.sep}`);
}

function resolveMcpSourceScope(
  normalizedPath: string,
  normalizedProjectPath?: string,
): McpServerSourceScope {
  if (!normalizedProjectPath || !isPathWithinRoot(normalizedPath, normalizedProjectPath)) {
    return 'global';
  }

  return path.basename(normalizedPath).toLowerCase() === '.mcp.local.json'
    ? 'projectLocal'
    : 'project';
}

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

function collectMcpSourceCandidates(
  options: McpServerListOptions,
  homeDir?: string,
): McpSourceCandidate[] {
  const { additionalPaths, projectPath } = options;
  const projectCandidates = projectPath ? collectProjectMcpCandidates(projectPath) : [];
  const rawCandidates = [
    homeDir ? path.join(homeDir, '.claude.json') : null,
    ...(additionalPaths ?? []),
    ...projectCandidates,
  ].filter((item): item is string => Boolean(item));

  const normalizedProjectPath = projectPath ? path.normalize(path.resolve(projectPath)) : undefined;
  const seen = new Set<string>();
  const candidates: McpSourceCandidate[] = [];

  for (const rawPath of rawCandidates) {
    const normalizedPath = normalizeConfigPath(rawPath, homeDir);
    if (seen.has(normalizedPath)) {
      continue;
    }

    seen.add(normalizedPath);
    const sourceScope = resolveMcpSourceScope(normalizedPath, normalizedProjectPath);
    candidates.push({
      path: normalizedPath,
      sourceScope,
      priority: MCP_SOURCE_PRIORITY[sourceScope],
      order: candidates.length,
    });
  }

  return candidates;
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

function readServersFromConfigPath(configPath: string): { servers: McpServer[]; error?: string } {
  try {
    if (!fs.existsSync(configPath) || !fs.statSync(configPath).isFile()) {
      return { servers: [] };
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    if (!isRecord(parsed) || !isRecord(parsed.mcpServers)) {
      return { servers: [] };
    }

    const servers: McpServer[] = Object.entries(parsed.mcpServers).map(([name, rawServer]) => {
      const serverConfig = isRecord(rawServer) ? rawServer : {};
      const args = Array.isArray(serverConfig.args)
        ? serverConfig.args.map((arg) => String(arg))
        : [];
      const env = isRecord(serverConfig.env)
        ? Object.fromEntries(
            Object.entries(serverConfig.env).filter((entry): entry is [string, string] => {
              return typeof entry[1] === 'string';
            }),
          )
        : {};

      return {
        name,
        type: typeof serverConfig.type === 'string' ? serverConfig.type : 'stdio',
        command: typeof serverConfig.command === 'string' ? serverConfig.command : '',
        args,
        env,
      };
    });

    return { servers };
  } catch (error) {
    return {
      servers: [],
      error: `Failed to read ${configPath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

function shouldReplaceCandidate(
  current: RankedMcpServerCandidate,
  incoming: RankedMcpServerCandidate,
): boolean {
  if (incoming.priority !== current.priority) {
    return incoming.priority > current.priority;
  }

  if (incoming.order !== current.order) {
    return incoming.order > current.order;
  }

  return incoming.candidate.sourcePath.localeCompare(current.candidate.sourcePath) > 0;
}

function stripCandidateSource(candidate: McpServerCandidate): McpServer {
  return {
    name: candidate.name,
    type: candidate.type,
    command: candidate.command,
    args: candidate.args,
    env: candidate.env,
  };
}

/**
 * Aggregate global/project MCP sources into deterministic server candidates.
 */
export const getMcpServerCandidates = (
  options: McpServerListOptions = {},
): { candidates: McpServerCandidate[]; error?: string; sourcePaths: string[] } => {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const sourceCandidates = collectMcpSourceCandidates(options, homeDir);
  const mergedByName = new Map<string, RankedMcpServerCandidate>();
  const sourcePathsSet = new Set<string>();
  const errors: string[] = [];

  for (const sourceCandidate of sourceCandidates) {
    const { servers, error } = readServersFromConfigPath(sourceCandidate.path);
    if (error) {
      errors.push(error);
      continue;
    }

    if (servers.length > 0) {
      sourcePathsSet.add(sourceCandidate.path);
    }

    for (const server of servers) {
      const incoming: RankedMcpServerCandidate = {
        candidate: {
          ...server,
          sourcePath: sourceCandidate.path,
          sourceScope: sourceCandidate.sourceScope,
        },
        priority: sourceCandidate.priority,
        order: sourceCandidate.order,
      };
      const current = mergedByName.get(server.name);
      if (!current || shouldReplaceCandidate(current, incoming)) {
        mergedByName.set(server.name, incoming);
      }
    }
  }

  const candidates = Array.from(mergedByName.values())
    .map((item) => item.candidate)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (candidates.length === 0 && errors.length > 0) {
    return { candidates: [], error: errors.join('; '), sourcePaths: Array.from(sourcePathsSet) };
  }

  return { candidates, sourcePaths: Array.from(sourcePathsSet) };
};

function resolveSelectedServers(
  projectPath: string,
  selectedServerNames: string[],
  options: Pick<McpServerListOptions, 'additionalPaths'> = {},
): { selectedServers: McpServer[]; error?: string } {
  const { candidates, error } = getMcpServerCandidates({
    additionalPaths: options.additionalPaths,
    projectPath,
  });

  if (error) {
    return { selectedServers: [], error };
  }

  const selectedServerSet = new Set(selectedServerNames);
  const selectedServers = candidates
    .filter((candidate) => selectedServerSet.has(candidate.name))
    .map(stripCandidateSource);
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
 * Get merged MCP server list for legacy consumers.
 */
export const getMcpServerList = (
  options: McpServerListOptions = {},
): { servers: McpServer[]; error?: string; sourcePaths: string[] } => {
  const { candidates, error, sourcePaths } = getMcpServerCandidates(options);
  return {
    servers: candidates.map(stripCandidateSource),
    error,
    sourcePaths,
  };
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

// ============================================================================
// Active Hooks (Claude Code settings.json)
// ============================================================================

import type {
  ActiveHookItem,
  ActiveHooksResult,
  HookEvent,
  HookMatcherEntry,
} from '../types/active-hooks';

const HOOK_EVENTS: HookEvent[] = [
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'Notification',
  'SubagentStop',
];

function parseHooksFromContent(
  content: string,
  scope: 'user' | 'project',
  scopePath: string,
): { items: ActiveHookItem[]; error?: string } {
  try {
    const data = JSON.parse(content);
    const hooks = data?.hooks;
    if (!hooks || typeof hooks !== 'object') {
      return { items: [] };
    }

    const items: ActiveHookItem[] = [];
    let idx = 0;

    for (const event of HOOK_EVENTS) {
      const matchers: unknown = hooks[event];
      if (!Array.isArray(matchers)) continue;

      for (const matcherEntry of matchers as HookMatcherEntry[]) {
        const hooksArr = matcherEntry.hooks;
        if (!Array.isArray(hooksArr)) continue;

        for (const hook of hooksArr) {
          if (hook.type !== 'command' || !hook.command) continue;
          items.push({
            id: `${scope}:${event}:${idx++}`,
            scope,
            scopePath,
            event,
            matcher: matcherEntry.matcher,
            command: hook.command,
            timeout: hook.timeout,
            background: hook.background,
          });
        }
      }
    }

    return { items };
  } catch (error) {
    return {
      items: [],
      error: error instanceof Error ? error.message : 'Failed to parse hooks',
    };
  }
}

/**
 * Read configured hooks from user (~/.claude/settings.json) and
 * project (<projectPath>/.claude/settings.json) settings files.
 */
export const listActiveHooks = (projectPath?: string): ActiveHooksResult => {
  const homeDir = os.homedir();
  const userSettingsPath = path.join(homeDir, '.claude', 'settings.json');
  const projectSettingsPath = projectPath
    ? path.join(projectPath, '.claude', 'settings.json')
    : null;

  const userSettingsExists = fs.existsSync(userSettingsPath);
  const projectSettingsExists = projectSettingsPath !== null && fs.existsSync(projectSettingsPath);

  const items: ActiveHookItem[] = [];
  let userError: string | undefined;
  let projectError: string | undefined;

  if (userSettingsExists) {
    try {
      const content = fs.readFileSync(userSettingsPath, 'utf-8');
      const { items: userItems, error } = parseHooksFromContent(content, 'user', userSettingsPath);
      items.push(...userItems);
      userError = error;
    } catch (error) {
      userError = error instanceof Error ? error.message : 'Failed to read user settings';
    }
  }

  if (projectSettingsExists && projectSettingsPath) {
    try {
      const content = fs.readFileSync(projectSettingsPath, 'utf-8');
      const { items: projectItems, error } = parseHooksFromContent(
        content,
        'project',
        projectSettingsPath,
      );
      items.push(...projectItems);
      projectError = error;
    } catch (error) {
      projectError = error instanceof Error ? error.message : 'Failed to read project settings';
    }
  }

  return {
    items,
    userSettingsPath,
    projectSettingsPath,
    userSettingsExists,
    projectSettingsExists,
    userError,
    projectError,
  };
};
