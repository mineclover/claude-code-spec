import type { ExecuteAPI, SessionsAPI, SettingsAPI, ToolsAPI } from './types/api';
import type { DialogAPI } from './preload/apis/dialog';

declare global {
  interface Window {
    executeAPI: ExecuteAPI;
    sessionsAPI: SessionsAPI;
    settingsAPI: SettingsAPI;
    toolsAPI: ToolsAPI;
    dialogAPI: DialogAPI;
  }
}
