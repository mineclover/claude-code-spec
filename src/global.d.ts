import { ClaudeAPI, SessionInfo, ClaudeStatus, RunningProcess, PersistentProcess } from './preload';

declare global {
  interface Window {
    claudeAPI: ClaudeAPI;
  }
}

export type { SessionInfo, ClaudeStatus, RunningProcess, PersistentProcess };