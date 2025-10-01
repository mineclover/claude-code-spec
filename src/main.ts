import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import { registerAppSettingsHandlers } from './ipc/handlers/appSettingsHandlers';
import { registerBookmarksHandlers } from './ipc/handlers/bookmarksHandlers';
import { registerClaudeHandlers } from './ipc/handlers/claudeHandlers';
import { registerClaudeSessionsHandlers } from './ipc/handlers/claudeSessionsHandlers';
import { registerDialogHandlers } from './ipc/handlers/dialogHandlers';
import { registerDocsHandlers } from './ipc/handlers/docsHandlers';
import { registerLoggerHandlers } from './ipc/handlers/loggerHandlers';
import { registerMetadataHandlers } from './ipc/handlers/metadataHandlers';
import { registerSettingsHandlers } from './ipc/handlers/settingsHandlers';
import { ipcRegistry } from './ipc/IPCRouter';
import type { ClaudeClient } from './lib/ClaudeClient';
import { SessionManager } from './lib/SessionManager';
import { settingsService } from './services/appSettings';
import { createConfig, createSessionLogger } from './services/logger';

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

// ============================================================================
// IPC Handler Registration - Router-based
// ============================================================================

// Register all IPC handlers using the router system
const dialogRouter = ipcRegistry.router('dialog');
registerDialogHandlers(dialogRouter);

const claudeRouter = ipcRegistry.router('claude');
registerClaudeHandlers(claudeRouter, {
  sessionManager,
  logger,
  activeClients,
});

const loggerRouter = ipcRegistry.router('logger');
registerLoggerHandlers(loggerRouter, loggerConfig);

const settingsRouter = ipcRegistry.router('settings');
registerSettingsHandlers(settingsRouter);

const bookmarksRouter = ipcRegistry.router('bookmarks');
registerBookmarksHandlers(bookmarksRouter);

const claudeSessionsRouter = ipcRegistry.router('claude-sessions');
registerClaudeSessionsHandlers(claudeSessionsRouter);

const appSettingsRouter = ipcRegistry.router('app-settings');
registerAppSettingsHandlers(appSettingsRouter, settingsService);

const docsRouter = ipcRegistry.router('docs');
registerDocsHandlers(docsRouter);

const metadataRouter = ipcRegistry.router('metadata');
registerMetadataHandlers(metadataRouter);

console.log('[Main] Registered IPC channels:', ipcRegistry.getAllChannels());
