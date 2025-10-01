import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import started from 'electron-squirrel-startup';
import { ClaudeClient } from './lib/ClaudeClient';
import { SessionManager } from './lib/SessionManager';
import type { StreamEvent } from './lib/StreamParser';
import { extractSessionId, isResultEvent, isSystemInitEvent } from './lib/types';
import {
  addBookmark,
  clearAllBookmarks,
  deleteBookmark,
  exportBookmarks,
  getAllBookmarks,
  getBookmark,
  getBookmarksByProject,
  getBookmarksByTag,
  importBookmarks,
  searchBookmarks,
  updateBookmark,
} from './services/bookmarks';
import {
  getAllClaudeProjects,
  getProjectSessions,
  getSessionSummary,
  readSessionLog,
} from './services/claudeSessions';
import {
  analyzeLogFile,
  createConfig,
  createSessionLogger,
  exportLogsAsJSON,
  getLogFileForSession,
  getLogFiles,
  readLogFile,
  rotateLogFiles,
} from './services/logger';
import {
  createBackup,
  deleteSettingsFile,
  findSettingsFiles,
  loadBackupFromFile,
  readSettingsFile,
  restoreBackup,
  saveBackupToFile,
  validateMcpJson,
  writeSettingsFile,
} from './services/settings';

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
const sessionManager = new SessionManager();
const activeClients = new Map<number, ClaudeClient>();

// Create functional logger
const loggerConfig = createConfig();
const logger = createSessionLogger(loggerConfig);

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  mainWindow.webContents.openDevTools();
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handler for directory selection
ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

// IPC handler for executing Claude CLI with stream-json
ipcMain.handle(
  'claude:execute',
  async (event, projectPath: string, query: string, sessionId?: string) => {
    console.log('[Main] Execute request:', { projectPath, query, sessionId });

    try {
      // Create Claude client
      const client = new ClaudeClient({
        cwd: projectPath,
        sessionId: sessionId || undefined,
        onStream: (streamEvent: StreamEvent) => {
          // Forward stream event to renderer
          event.sender.send('claude:stream', {
            pid: client.isRunning() ? process.pid : null,
            data: streamEvent,
          });

          // Extract and save session info from system init event
          if (isSystemInitEvent(streamEvent)) {
            sessionManager.saveSession(streamEvent.session_id, {
              cwd: projectPath,
              query,
              timestamp: Date.now(),
            });
            // Start logging session BEFORE logging the event
            logger.startSession(streamEvent.session_id);
          }

          // Log stream event (now session is started for system init events)
          const sessionId = extractSessionId(streamEvent);
          logger.logEvent(streamEvent, sessionId);

          // Save result from result event
          if (isResultEvent(streamEvent)) {
            const currentSessionId = client.getSessionId();
            if (currentSessionId) {
              sessionManager.updateSessionResult(currentSessionId, streamEvent.result);
            }
            // Close logging session
            logger.closeSession();
          }
        },
        onError: (error: string) => {
          event.sender.send('claude:error', {
            pid: client.isRunning() ? process.pid : null,
            error,
          });
        },
        onClose: (code: number) => {
          const pid = process.pid;
          console.log('[Main] Client closed:', code);
          event.sender.send('claude:complete', { pid, code });
          activeClients.delete(pid);
        },
      });

      // Execute query
      const childProcess = client.execute(query);
      const pid = childProcess.pid;

      if (!pid) {
        throw new Error('Failed to get process PID');
      }

      // Store active client
      activeClients.set(pid, client);

      // Notify renderer
      event.sender.send('claude:started', { pid });

      return { success: true, pid };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Main] Execution error:', error);
      event.sender.send('claude:error', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },
);

// IPC handler for getting session list
ipcMain.handle('claude:get-sessions', async () => {
  const sessions = sessionManager.getAllSessions();
  console.log('[Main] Returning sessions:', sessions.length);
  return sessions;
});

// IPC handler for getting current session
ipcMain.handle('claude:get-current-session', async () => {
  const sessionId = sessionManager.getCurrentSessionId();
  console.log('[Main] Current session:', sessionId);
  return sessionId;
});

// IPC handler for resuming a session
ipcMain.handle(
  'claude:resume-session',
  async (event, sessionId: string, projectPath: string, query: string) => {
    console.log('[Main] Resume session:', sessionId);

    // Execute with session ID
    return ipcMain.emit('claude:execute', event, projectPath, query, sessionId);
  },
);

// IPC handler for clearing sessions
ipcMain.handle('claude:clear-sessions', async () => {
  sessionManager.clearSessions();
  console.log('[Main] Sessions cleared');
  return { success: true };
});

// ============================================================================
// Logger IPC Handlers
// ============================================================================

// Get all log files
ipcMain.handle('logger:get-files', async () => {
  return getLogFiles(loggerConfig);
});

// Get log entries from a specific file
ipcMain.handle('logger:read-file', async (_event, filePath: string) => {
  return readLogFile(filePath);
});

// Analyze event patterns from a log file
ipcMain.handle('logger:analyze-patterns', async (_event, filePath: string) => {
  return analyzeLogFile(filePath);
});

// Export logs as JSON
ipcMain.handle('logger:export-json', async (_event, filePath: string, outputPath: string) => {
  exportLogsAsJSON(filePath, outputPath);
  return { success: true };
});

// Rotate log files (clean up old ones)
ipcMain.handle('logger:rotate', async () => {
  rotateLogFiles(loggerConfig);
  return { success: true };
});

// Get log file path for session
ipcMain.handle('logger:get-session-log', async (_event, sessionId: string) => {
  return getLogFileForSession(loggerConfig, sessionId);
});

// Read session log entries
ipcMain.handle('logger:read-session-log', async (_event, sessionId: string) => {
  const logFile = getLogFileForSession(loggerConfig, sessionId);
  if (!logFile) {
    return [];
  }
  return readLogFile(logFile);
});

// ============================================================================
// Settings IPC Handlers
// ============================================================================

// Find all settings files in project
ipcMain.handle('settings:find-files', async (_event, projectPath: string) => {
  return findSettingsFiles(projectPath);
});

// Create backup of current settings
ipcMain.handle('settings:create-backup', async (_event, projectPath: string) => {
  return createBackup(projectPath);
});

// Save backup to file
ipcMain.handle('settings:save-backup', async (_event, backup: unknown, filePath: string) => {
  return saveBackupToFile(backup, filePath);
});

// Load backup from file
ipcMain.handle('settings:load-backup', async (_event, filePath: string) => {
  return loadBackupFromFile(filePath);
});

// Restore backup to project
ipcMain.handle('settings:restore-backup', async (_event, backup: unknown) => {
  return restoreBackup(backup);
});

// Read settings file
ipcMain.handle('settings:read-file', async (_event, filePath: string) => {
  return readSettingsFile(filePath);
});

// Write settings file
ipcMain.handle('settings:write-file', async (_event, filePath: string, content: string) => {
  return writeSettingsFile(filePath, content);
});

// Delete settings file
ipcMain.handle('settings:delete-file', async (_event, filePath: string) => {
  return deleteSettingsFile(filePath);
});

// Validate MCP JSON
ipcMain.handle('settings:validate-mcp-json', async (_event, content: string) => {
  return validateMcpJson(content);
});

// ============================================================================
// Bookmarks IPC Handlers
// ============================================================================

// Get all bookmarks
ipcMain.handle('bookmarks:get-all', async () => {
  return getAllBookmarks();
});

// Get single bookmark
ipcMain.handle('bookmarks:get', async (_event, id: string) => {
  return getBookmark(id);
});

// Add new bookmark
ipcMain.handle('bookmarks:add', async (_event, bookmark: unknown) => {
  return addBookmark(bookmark as Parameters<typeof addBookmark>[0]);
});

// Update bookmark
ipcMain.handle('bookmarks:update', async (_event, id: string, updates: unknown) => {
  return updateBookmark(id, updates as Parameters<typeof updateBookmark>[1]);
});

// Delete bookmark
ipcMain.handle('bookmarks:delete', async (_event, id: string) => {
  return deleteBookmark(id);
});

// Search bookmarks
ipcMain.handle('bookmarks:search', async (_event, query: string) => {
  return searchBookmarks(query);
});

// Get bookmarks by project
ipcMain.handle('bookmarks:get-by-project', async (_event, projectPath: string) => {
  return getBookmarksByProject(projectPath);
});

// Get bookmarks by tag
ipcMain.handle('bookmarks:get-by-tag', async (_event, tag: string) => {
  return getBookmarksByTag(tag);
});

// Clear all bookmarks
ipcMain.handle('bookmarks:clear-all', async () => {
  return clearAllBookmarks();
});

// Export bookmarks
ipcMain.handle('bookmarks:export', async (_event, outputPath: string) => {
  return exportBookmarks(outputPath);
});

// Import bookmarks
ipcMain.handle('bookmarks:import', async (_event, inputPath: string, merge = true) => {
  return importBookmarks(inputPath, merge);
});

// ============================================================================
// Claude Sessions IPC Handlers
// ============================================================================

// Get all Claude projects with sessions
ipcMain.handle('claude-sessions:get-all-projects', async () => {
  return getAllClaudeProjects();
});

// Get sessions for a specific project
ipcMain.handle('claude-sessions:get-project-sessions', async (_event, projectPath: string) => {
  return getProjectSessions(projectPath);
});

// Read session log
ipcMain.handle(
  'claude-sessions:read-log',
  async (_event, projectPath: string, sessionId: string) => {
    return readSessionLog(projectPath, sessionId);
  },
);

// Get session summary
ipcMain.handle(
  'claude-sessions:get-summary',
  async (_event, projectPath: string, sessionId: string) => {
    return getSessionSummary(projectPath, sessionId);
  },
);
