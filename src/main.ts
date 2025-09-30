import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { ClaudeClient } from './lib/ClaudeClient';
import { SessionManager } from './lib/SessionManager';
import { StreamEvent } from './lib/StreamParser';
import { isSystemInitEvent, isResultEvent } from './lib/types';

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
const sessionManager = new SessionManager();
const activeClients = new Map<number, ClaudeClient>();

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
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
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
ipcMain.handle('claude:execute', async (event, projectPath: string, query: string, sessionId?: string) => {
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
        }

        // Save result from result event
        if (isResultEvent(streamEvent)) {
          const currentSessionId = client.getSessionId();
          if (currentSessionId) {
            sessionManager.updateSessionResult(currentSessionId, streamEvent.result);
          }
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
});

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
ipcMain.handle('claude:resume-session', async (event, sessionId: string, projectPath: string, query: string) => {
  console.log('[Main] Resume session:', sessionId);

  // Execute with session ID
  return ipcMain.emit('claude:execute', event, projectPath, query, sessionId);
});

// IPC handler for clearing sessions
ipcMain.handle('claude:clear-sessions', async () => {
  sessionManager.clearSessions();
  console.log('[Main] Sessions cleared');
  return { success: true };
});