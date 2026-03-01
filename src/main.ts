/**
 * Main process entry point
 */

import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import { initializeAppContext } from './main/app-context';
import { setupIPCHandlers } from './main/ipc-setup';
import { createWindow, setupSessionCSP } from './main/window';
import { multiCliExecutionService } from './services/MultiCliExecutionService';

if (started) {
  app.quit();
}

const handleCreateWindow = () => {
  createWindow();
};

app.on('ready', () => {
  setupSessionCSP();
  initializeAppContext();
  setupIPCHandlers();
  handleCreateWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    handleCreateWindow();
  }
});

app.on('will-quit', (event) => {
  const activeExecutions = multiCliExecutionService.getActiveExecutions();
  if (activeExecutions.length > 0) {
    event.preventDefault();
    console.log(`[Main] Killing ${activeExecutions.length} active executions...`);
    multiCliExecutionService.killAll();
    setTimeout(() => {
      app.exit(0);
    }, 500);
  }
});
