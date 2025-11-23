/**
 * Preload script
 * Exposes safe IPC APIs to the renderer process
 */

// Import all API exposure functions
import { exposeAgentAPI } from './preload/apis/agent';
import { exposeAppSettingsAPI } from './preload/apis/app-settings';
import { exposeBookmarksAPI } from './preload/apis/bookmarks';
import { exposeCentralDatabaseAPI } from './preload/apis/centralDatabase';
import { exposeClaudeAPI } from './preload/apis/claude';
import { exposeDocsAPI } from './preload/apis/docs';
import { exposeFileAPI } from './preload/apis/file';
import { exposeLoggerAPI } from './preload/apis/logger';
import { exposeMetadataAPI } from './preload/apis/metadata';
import { exposeOutputStyleAPI } from './preload/apis/outputStyle';
import { exposeQueryAPI } from './preload/apis/query';
import { exposeSessionsAPI } from './preload/apis/sessions';
import { exposeSettingsAPI } from './preload/apis/settings';
import { exposeSkillAPI } from './preload/apis/skill';
import { exposeSkillRepositoryAPI } from './preload/apis/skillRepository';
import { exposeTaskAPI } from './preload/apis/task';
import { exposeWorkAreaAPI } from './preload/apis/workArea';
import { exposeWorkflowAPI } from './preload/apis/workflow';

// Expose all APIs to the renderer
exposeClaudeAPI();
exposeLoggerAPI();
exposeSettingsAPI();
exposeBookmarksAPI();
exposeSessionsAPI();
exposeAppSettingsAPI();
exposeDocsAPI();
exposeMetadataAPI();
exposeFileAPI();
exposeTaskAPI();
exposeAgentAPI();
exposeSkillAPI();
exposeSkillRepositoryAPI();
exposeWorkAreaAPI();
exposeOutputStyleAPI();
exposeQueryAPI();
exposeWorkflowAPI();
exposeCentralDatabaseAPI();

// Re-export types for convenience
export * from './types/api';
