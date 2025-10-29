/**
 * Main process entry point
 */
import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import { setupIPCHandlers } from './main/ipc-setup';
import { createWindow } from './main/window';
import { processManager } from '@context-action/code-api';

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

// Clean up all running processes before quitting
app.on('will-quit', (event) => {
  console.log('[Main] App will quit - killing all running processes');

  const activeExecutions = processManager.getActiveExecutions();

  if (activeExecutions.length > 0) {
    event.preventDefault(); // Prevent quit until cleanup is done

    console.log(`[Main] Found ${activeExecutions.length} active executions, killing...`);
    processManager.killAll();

    // Give processes a moment to terminate gracefully
    setTimeout(() => {
      console.log('[Main] Cleanup complete, quitting');
      app.exit(0);
    }, 500);
  }
});
