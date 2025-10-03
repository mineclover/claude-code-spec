/**
 * Application context and global state
 */
import { SessionManager } from '../lib/SessionManager';
import { createConfig, createSessionLogger } from '../services/logger';

// Session manager
export const sessionManager = new SessionManager();

// Logger configuration and instance
export const loggerConfig = createConfig();
export const logger = createSessionLogger(loggerConfig);

// ProcessManager is now used for managing executions (see src/services/ProcessManager.ts)
// activeClients Map is no longer needed as ProcessManager handles all execution lifecycle
