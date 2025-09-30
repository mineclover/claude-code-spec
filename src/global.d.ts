import type { ClaudeAPI, LoggerAPI, SessionInfo } from './preload';
import type { LogEntry } from './services/logger';
import type { StreamEvent } from './lib/types';

declare global {
  interface Window {
    claudeAPI: ClaudeAPI;
    loggerAPI: LoggerAPI;
  }

  // Vite environment variables for Electron Forge
  const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
  const MAIN_WINDOW_VITE_NAME: string;
}

export type { LogEntry, SessionInfo, StreamEvent };
