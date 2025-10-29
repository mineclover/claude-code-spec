/**
 * Application context and global state
 */

import path from 'node:path';
import { SessionManager } from '@context-action/code-api';
import { app } from 'electron';
import { AgentPoolManager } from '../services/AgentPoolManager';
import { AppLogger, ConsoleTransport, FileTransport, parseLogLevel } from '../services/AppLogger';
import { createConfig, createSessionLogger } from '../services/logger';

// Session manager
export const sessionManager = new SessionManager();

// Logger configuration and instance
// Use Electron's userData directory for logs in production
const logDir = app.isPackaged
  ? path.join(app.getPath('userData'), 'logs')
  : path.join(process.cwd(), 'logs');

export const loggerConfig = createConfig({ logDir });
export const logger = createSessionLogger(loggerConfig);

// Application logger (for general app logging, not stream events)
const appLogDir = path.join(logDir, 'app');
const logLevel = parseLogLevel(process.env.LOG_LEVEL || 'info');

export const appLogger = new AppLogger({
  level: logLevel,
  transports: [
    new ConsoleTransport(!app.isPackaged), // Colors in dev mode only
    new FileTransport({
      logDir: appLogDir,
      filename: 'app.log',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],
});

// Cleanup on app quit
app.on('will-quit', () => {
  appLogger.close();
});

// Agent Pool Manager (for LangGraph-style agent routing)
export const agentPoolManager = new AgentPoolManager();

// ProcessManager is now used for managing executions (see src/services/ProcessManager.ts)
// activeClients Map is no longer needed as ProcessManager handles all execution lifecycle
