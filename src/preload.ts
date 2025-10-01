import { contextBridge, ipcRenderer } from 'electron';
import type { StreamEvent } from './lib/types';
import type { LogEntry } from './services/logger';

export interface SessionInfo {
  sessionId: string;
  cwd: string;
  query: string;
  timestamp: number;
  lastResult?: string;
}

export interface ClaudeStreamData {
  pid: number;
  data: StreamEvent;
}

export interface ClaudeErrorData {
  pid?: number;
  error: string;
}

export interface ClaudeCompleteData {
  pid: number;
  code: number;
}

export interface ClaudeStartedData {
  pid: number;
}

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

export interface SessionBookmark {
  id: string;
  sessionId: string;
  projectPath: string;
  description: string;
  timestamp: number;
  query?: string;
  tags?: string[];
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
}

export interface BookmarksAPI {
  // CRUD operations
  getAll: () => Promise<SessionBookmark[]>;
  get: (id: string) => Promise<SessionBookmark | null>;
  add: (bookmark: Omit<SessionBookmark, 'id' | 'timestamp'>) => Promise<SessionBookmark>;
  update: (
    id: string,
    updates: Partial<Omit<SessionBookmark, 'id' | 'timestamp'>>,
  ) => Promise<SessionBookmark | null>;
  delete: (id: string) => Promise<boolean>;

  // Query operations
  search: (query: string) => Promise<SessionBookmark[]>;
  getByProject: (projectPath: string) => Promise<SessionBookmark[]>;
  getByTag: (tag: string) => Promise<SessionBookmark[]>;

  // Utility
  clearAll: () => Promise<boolean>;
  export: (outputPath: string) => Promise<boolean>;
  import: (inputPath: string, merge?: boolean) => Promise<boolean>;
}

export interface ClaudeSessionEntry {
  type: string;
  summary?: string;
  leafUuid?: string;
  [key: string]: unknown;
}

export interface ClaudeProjectInfo {
  projectPath: string;
  claudeProjectDir: string;
  sessions: ClaudeSessionInfo[];
}

export interface ClaudeSessionInfo {
  sessionId: string;
  filePath: string;
  fileSize: number;
  lastModified: number;
}

export interface ClaudeSessionsAPI {
  // Get all projects with Claude sessions
  getAllProjects: () => Promise<ClaudeProjectInfo[]>;

  // Get sessions for a specific project
  getProjectSessions: (projectPath: string) => Promise<ClaudeSessionInfo[]>;

  // Read session log
  readLog: (projectPath: string, sessionId: string) => Promise<ClaudeSessionEntry[]>;

  // Get session summary
  getSummary: (projectPath: string, sessionId: string) => Promise<string | null>;
}

export interface LoggerAPI {
  // Get list of log files
  getLogFiles: () => Promise<string[]>;

  // Read log entries from a file
  readLogFile: (filePath: string) => Promise<LogEntry[]>;

  // Analyze event patterns
  analyzePatterns: (filePath: string) => Promise<Record<string, number>>;

  // Export logs as JSON
  exportJSON: (filePath: string, outputPath: string) => Promise<{ success: boolean }>;

  // Rotate (clean up) old log files
  rotateLogs: () => Promise<{ success: boolean }>;

  // Get log file path for session
  getSessionLog: (sessionId: string) => Promise<string | null>;

  // Read session log entries
  readSessionLog: (sessionId: string) => Promise<LogEntry[]>;
}

export interface ClaudeAPI {
  // Execute claude command
  executeClaudeCommand: (
    projectPath: string,
    query: string,
    sessionId?: string,
  ) => Promise<{ success: boolean; pid?: number; error?: string }>;

  // Directory selection
  selectDirectory: () => Promise<string | null>;

  // Session management
  getSessions: () => Promise<SessionInfo[]>;
  getCurrentSession: () => Promise<string | null>;
  resumeSession: (
    sessionId: string,
    projectPath: string,
    query: string,
  ) => Promise<{ success: boolean; pid?: number; error?: string }>;
  clearSessions: () => Promise<{ success: boolean }>;

  // Event listeners
  onClaudeStarted: (callback: (data: ClaudeStartedData) => void) => void;
  onClaudeStream: (callback: (data: ClaudeStreamData) => void) => void;
  onClaudeError: (callback: (data: ClaudeErrorData) => void) => void;
  onClaudeComplete: (callback: (data: ClaudeCompleteData) => void) => void;
}

contextBridge.exposeInMainWorld('claudeAPI', {
  executeClaudeCommand: (projectPath: string, query: string, sessionId?: string) =>
    ipcRenderer.invoke('claude:execute', projectPath, query, sessionId),

  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),

  getSessions: () => ipcRenderer.invoke('claude:get-sessions'),

  getCurrentSession: () => ipcRenderer.invoke('claude:get-current-session'),

  resumeSession: (sessionId: string, projectPath: string, query: string) =>
    ipcRenderer.invoke('claude:resume-session', sessionId, projectPath, query),

  clearSessions: () => ipcRenderer.invoke('claude:clear-sessions'),

  onClaudeStarted: (callback: (data: { pid: number }) => void) => {
    ipcRenderer.on('claude:started', (_event, data) => callback(data));
  },

  onClaudeStream: (callback: (data: { pid: number; data: StreamEvent }) => void) => {
    ipcRenderer.on('claude:stream', (_event, data) => callback(data));
  },

  onClaudeError: (callback: (data: { pid?: number; error: string }) => void) => {
    ipcRenderer.on('claude:error', (_event, data) => callback(data));
  },

  onClaudeComplete: (callback: (data: { pid: number; code: number }) => void) => {
    ipcRenderer.on('claude:complete', (_event, data) => callback(data));
  },
} as ClaudeAPI);

// Expose LoggerAPI
contextBridge.exposeInMainWorld('loggerAPI', {
  getLogFiles: () => ipcRenderer.invoke('logger:get-files'),

  readLogFile: (filePath: string) => ipcRenderer.invoke('logger:read-file', filePath),

  analyzePatterns: (filePath: string) => ipcRenderer.invoke('logger:analyze-patterns', filePath),

  exportJSON: (filePath: string, outputPath: string) =>
    ipcRenderer.invoke('logger:export-json', filePath, outputPath),

  rotateLogs: () => ipcRenderer.invoke('logger:rotate'),

  getSessionLog: (sessionId: string) => ipcRenderer.invoke('logger:get-session-log', sessionId),

  readSessionLog: (sessionId: string) => ipcRenderer.invoke('logger:read-session-log', sessionId),
} as LoggerAPI);

// Expose SettingsAPI
contextBridge.exposeInMainWorld('settingsAPI', {
  findFiles: (projectPath: string) => ipcRenderer.invoke('settings:find-files', projectPath),

  createBackup: (projectPath: string) => ipcRenderer.invoke('settings:create-backup', projectPath),

  saveBackup: (backup: SettingsBackup, filePath: string) =>
    ipcRenderer.invoke('settings:save-backup', backup, filePath),

  loadBackup: (filePath: string) => ipcRenderer.invoke('settings:load-backup', filePath),

  restoreBackup: (backup: SettingsBackup) => ipcRenderer.invoke('settings:restore-backup', backup),

  readFile: (filePath: string) => ipcRenderer.invoke('settings:read-file', filePath),

  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('settings:write-file', filePath, content),

  deleteFile: (filePath: string) => ipcRenderer.invoke('settings:delete-file', filePath),

  validateMcpJson: (content: string) => ipcRenderer.invoke('settings:validate-mcp-json', content),
} as SettingsAPI);

// Expose BookmarksAPI
contextBridge.exposeInMainWorld('bookmarksAPI', {
  getAll: () => ipcRenderer.invoke('bookmarks:get-all'),

  get: (id: string) => ipcRenderer.invoke('bookmarks:get', id),

  add: (bookmark: Omit<SessionBookmark, 'id' | 'timestamp'>) =>
    ipcRenderer.invoke('bookmarks:add', bookmark),

  update: (id: string, updates: Partial<Omit<SessionBookmark, 'id' | 'timestamp'>>) =>
    ipcRenderer.invoke('bookmarks:update', id, updates),

  delete: (id: string) => ipcRenderer.invoke('bookmarks:delete', id),

  search: (query: string) => ipcRenderer.invoke('bookmarks:search', query),

  getByProject: (projectPath: string) =>
    ipcRenderer.invoke('bookmarks:get-by-project', projectPath),

  getByTag: (tag: string) => ipcRenderer.invoke('bookmarks:get-by-tag', tag),

  clearAll: () => ipcRenderer.invoke('bookmarks:clear-all'),

  export: (outputPath: string) => ipcRenderer.invoke('bookmarks:export', outputPath),

  import: (inputPath: string, merge?: boolean) =>
    ipcRenderer.invoke('bookmarks:import', inputPath, merge),
} as BookmarksAPI);

// Expose ClaudeSessionsAPI
contextBridge.exposeInMainWorld('claudeSessionsAPI', {
  getAllProjects: () => ipcRenderer.invoke('claude-sessions:get-all-projects'),

  getProjectSessions: (projectPath: string) =>
    ipcRenderer.invoke('claude-sessions:get-project-sessions', projectPath),

  readLog: (projectPath: string, sessionId: string) =>
    ipcRenderer.invoke('claude-sessions:read-log', projectPath, sessionId),

  getSummary: (projectPath: string, sessionId: string) =>
    ipcRenderer.invoke('claude-sessions:get-summary', projectPath, sessionId),
} as ClaudeSessionsAPI);
