import { ClaudeAPI, SessionInfo, ClaudeStatus, RunningProcess, PersistentProcess, ClaudeExecutionOptions } from './preload';

declare global {
  interface Window {
    claudeAPI: ClaudeAPI;
  }
}

export type { SessionInfo, ClaudeStatus, RunningProcess, PersistentProcess, ClaudeExecutionOptions };