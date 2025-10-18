/**
 * Application context and global state
 */
import { app } from 'electron';
import path from 'node:path';
import { SessionManager } from '../lib/SessionManager';
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

// ProcessManager is now used for managing executions (see src/services/ProcessManager.ts)
// activeClients Map is no longer needed as ProcessManager handles all execution lifecycle
