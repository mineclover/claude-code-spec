import type { AgentAPI } from './preload/apis/agent';
import type { OutputStyleAPI } from './preload/apis/outputStyle';
import type { SkillAPI } from './preload/apis/skill';
import type { SkillRepositoryAPI } from './preload/apis/skillRepository';
import type { TaskAPI } from './preload/apis/task';
import type { WorkAreaAPI } from './preload/apis/workArea';
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
    agentAPI: AgentAPI;
    skillAPI: SkillAPI;
    skillRepositoryAPI: SkillRepositoryAPI;
    workAreaAPI: WorkAreaAPI;
    outputStyleAPI: OutputStyleAPI;
  }
}
