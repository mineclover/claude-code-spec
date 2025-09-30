// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

// Debug logging
const DEBUG = true;
const log = (...args: unknown[]) => {
  if (DEBUG) {
    console.log('[Preload]', ...args);
  }
};

export interface SessionInfo {
  sessionId: string;
  projectPath: string;
  query: string;
  timestamp: number;
  response?: string;
}

export interface ClaudeStatus {
  available: boolean;
  authenticated: boolean;
  error?: string;
  pid?: number;
}

export interface DirectoryValidation {
  valid: boolean;
  error?: string;
  realPath?: string;
}

export interface PersistentProcess {
  pid: number;
  currentPath: string;
  startTime: number;
  status: 'idle' | 'busy' | 'failed';
  lastQuery?: string;
  executionCount?: number; // Number of commands executed in this process
  lastExecutionTime?: number; // Timestamp of last execution
}

export interface RunningProcess {
  pid: number;
  projectPath: string;
  query: string;
  startTime: number;
  status: 'running' | 'completed' | 'failed';
  output: string[];
  errors: string[];
}

export interface ClaudeAPI {
  executeClaudeCommand: (projectPath: string, query: string, sessionId?: string) => Promise<void>;
  executeInProcess: (persistentPid: number, projectPath: string, query: string) => Promise<void>;
  changeDirectory: (persistentPid: number, projectPath: string) => Promise<{ success: boolean; error?: string }>;
  executeTestCommand: (persistentPid: number, command: string) => Promise<void>;
  onClaudeResponse: (callback: (pid: number, data: string) => void) => void;
  onClaudeError: (callback: (pid: number, error: string) => void) => void;
  onClaudeComplete: (callback: (pid: number) => void) => void;
  onSessionUpdate: (callback: (sessionId: string) => void) => void;
  onProcessStarted: (callback: (process: { pid: number; projectPath: string; query: string }) => void) => void;
  onPwdUpdate: (callback: (update: { pid: number; currentPath: string }) => void) => void;
  onDebugOutput: (callback: (data: { pid: number; output: string }) => void) => void;
  selectDirectory: () => Promise<string | null>;
  getSessions: () => Promise<SessionInfo[]>;
  getCurrentSession: () => Promise<string | null>;
  continueSession: (projectPath: string, query: string) => Promise<void>;
  checkStatus: () => Promise<ClaudeStatus>;
  validateDirectory: (path: string) => Promise<DirectoryValidation>;
  getProcesses: () => Promise<RunningProcess[]>;
  getPersistentProcesses: () => Promise<PersistentProcess[]>;
  createPersistentProcess: (cwd?: string) => Promise<number | null>;
  killProcess: (pid: number) => Promise<boolean>;
}

log('🔧 Exposing claudeAPI to renderer');

contextBridge.exposeInMainWorld('claudeAPI', {
  executeClaudeCommand: (projectPath: string, query: string, sessionId?: string) => {
    log('📤 IPC Invoke: claude:execute', { projectPath, query, sessionId });
    return ipcRenderer.invoke('claude:execute', projectPath, query, sessionId);
  },
  onClaudeResponse: (callback: (pid: number, data: string) => void) => {
    log('🔗 Registered listener: claude:response');
    ipcRenderer.on('claude:response', (_event, payload) => {
      log('📥 IPC Event: claude:response', `PID: ${payload.pid}`, payload.data.substring(0, 50) + '...');
      callback(payload.pid, payload.data);
    });
  },
  onClaudeError: (callback: (pid: number, error: string) => void) => {
    log('🔗 Registered listener: claude:error');
    ipcRenderer.on('claude:error', (_event, payload) => {
      log('⚠️ IPC Event: claude:error', `PID: ${payload.pid}`, payload.error.substring(0, 50) + '...');
      callback(payload.pid, payload.error);
    });
  },
  onClaudeComplete: (callback: (pid: number) => void) => {
    log('🔗 Registered listener: claude:complete');
    ipcRenderer.on('claude:complete', (_event, payload) => {
      log('✅ IPC Event: claude:complete', `PID: ${payload.pid}`);
      callback(payload.pid);
    });
  },
  onProcessStarted: (callback: (process: { pid: number; projectPath: string; query: string }) => void) => {
    log('🔗 Registered listener: claude:process-started');
    ipcRenderer.on('claude:process-started', (_event, process) => {
      log('🚀 IPC Event: claude:process-started', `PID: ${process.pid}`);
      callback(process);
    });
  },
  onSessionUpdate: (callback: (sessionId: string) => void) => {
    log('🔗 Registered listener: claude:session-update');
    ipcRenderer.on('claude:session-update', (_event, sessionId) => {
      log('💾 IPC Event: claude:session-update', sessionId);
      callback(sessionId);
    });
  },
  selectDirectory: () => {
    log('📤 IPC Invoke: dialog:selectDirectory');
    return ipcRenderer.invoke('dialog:selectDirectory');
  },
  getSessions: () => {
    log('📤 IPC Invoke: claude:get-sessions');
    return ipcRenderer.invoke('claude:get-sessions');
  },
  getCurrentSession: () => {
    log('📤 IPC Invoke: claude:get-current-session');
    return ipcRenderer.invoke('claude:get-current-session');
  },
  continueSession: (projectPath: string, query: string) => {
    log('📤 IPC Invoke: claude:continue');
    return ipcRenderer.invoke('claude:continue', projectPath, query);
  },
  checkStatus: () => {
    log('📤 IPC Invoke: claude:check-status');
    return ipcRenderer.invoke('claude:check-status');
  },
  validateDirectory: (path: string) => {
    log('📤 IPC Invoke: claude:validate-directory', path);
    return ipcRenderer.invoke('claude:validate-directory', path);
  },
  getProcesses: () => {
    log('📤 IPC Invoke: claude:get-processes');
    return ipcRenderer.invoke('claude:get-processes');
  },
  killProcess: (pid: number) => {
    log('📤 IPC Invoke: claude:kill-process', pid);
    return ipcRenderer.invoke('claude:kill-process', pid);
  },
  getPersistentProcesses: () => {
    log('📤 IPC Invoke: claude:get-persistent-processes');
    return ipcRenderer.invoke('claude:get-persistent-processes');
  },
  createPersistentProcess: (cwd?: string) => {
    log('📤 IPC Invoke: claude:create-persistent-process', cwd);
    return ipcRenderer.invoke('claude:create-persistent-process', cwd);
  },
  executeInProcess: (persistentPid: number, projectPath: string, query: string) => {
    log('📤 IPC Invoke: claude:execute-in-process', { persistentPid, projectPath, query });
    return ipcRenderer.invoke('claude:execute-in-process', persistentPid, projectPath, query);
  },
  changeDirectory: (persistentPid: number, projectPath: string) => {
    log('📤 IPC Invoke: claude:change-directory', { persistentPid, projectPath });
    return ipcRenderer.invoke('claude:change-directory', persistentPid, projectPath);
  },
  onPwdUpdate: (callback: (update: { pid: number; currentPath: string }) => void) => {
    log('🔗 Registered listener: claude:pwd-update');
    ipcRenderer.on('claude:pwd-update', (_event, update) => {
      log('📍 IPC Event: claude:pwd-update', `PID: ${update.pid}`, update.currentPath);
      callback(update);
    });
  },
  executeTestCommand: (persistentPid: number, command: string) => {
    log('📤 IPC Invoke: claude:execute-test-command', { persistentPid, command });
    return ipcRenderer.invoke('claude:execute-test-command', persistentPid, command);
  },
  onDebugOutput: (callback: (data: { pid: number; output: string }) => void) => {
    log('🔗 Registered listener: claude:debug-output');
    ipcRenderer.on('claude:debug-output', (_event, data) => {
      log('🐛 IPC Event: claude:debug-output', `PID: ${data.pid}`, data.output.substring(0, 100));
      callback(data);
    });
  },
} as ClaudeAPI);
