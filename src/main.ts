/**
 * Main process entry point
 */
import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import { setupIPCHandlers } from './main/ipc-setup';
import { createWindow } from './main/window';

if (started) {
  app.quit();
}

// Create main window
const handleCreateWindow = () => {
  createWindow();
};

// Setup IPC handlers on app ready
app.on('ready', () => {
  setupIPCHandlers();
  handleCreateWindow();
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Recreate window when dock icon is clicked (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    handleCreateWindow();
  }
});
