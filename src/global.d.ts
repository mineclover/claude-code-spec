import type { ClaudeAPI, SessionInfo } from './preload';
import type { StreamEvent } from './lib/types';

declare global {
  interface Window {
    claudeAPI: ClaudeAPI;
  }
}

export type { StreamEvent, SessionInfo };