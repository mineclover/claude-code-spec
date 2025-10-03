import type { TaskAPI } from './preload/apis/task';
import type {
  AppSettingsAPI,
  BookmarksAPI,
  ClaudeAPI,
  ClaudeSessionsAPI,
  DocsAPI,
  FileAPI,
  LoggerAPI,
  MetadataAPI,
  SettingsAPI,
} from './types/api';

declare global {
  interface Window {
    claudeAPI: ClaudeAPI;
    loggerAPI: LoggerAPI;
    settingsAPI: SettingsAPI;
    bookmarksAPI: BookmarksAPI;
    claudeSessionsAPI: ClaudeSessionsAPI;
    appSettingsAPI: AppSettingsAPI;
    docsAPI: DocsAPI;
    metadataAPI: MetadataAPI;
    fileAPI: FileAPI;
    taskAPI: TaskAPI;
  }
}
