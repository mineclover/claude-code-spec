import type { AppSettingsAPI, BookmarksAPI, ClaudeAPI, ClaudeSessionsAPI, LoggerAPI, SettingsAPI } from './preload';

declare global {
  interface Window {
    claudeAPI: ClaudeAPI;
    loggerAPI: LoggerAPI;
    settingsAPI: SettingsAPI;
    bookmarksAPI: BookmarksAPI;
    claudeSessionsAPI: ClaudeSessionsAPI;
    appSettingsAPI: AppSettingsAPI;
  }
}
