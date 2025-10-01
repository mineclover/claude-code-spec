/**
 * Application context and global state
 */
import type { ClaudeClient } from '../lib/ClaudeClient';
import { SessionManager } from '../lib/SessionManager';
import { createConfig, createSessionLogger } from '../services/logger';

// Session manager
export const sessionManager = new SessionManager();

// Active Claude CLI clients
export const activeClients = new Map<number, ClaudeClient>();

// Logger configuration and instance
export const loggerConfig = createConfig();
export const logger = createSessionLogger(loggerConfig);
