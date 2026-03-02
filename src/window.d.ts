import type { ExecuteAPI, SessionsAPI, SettingsAPI, ToolsAPI } from './types/api';
import type { MoaiAPI } from './types/api/moai';
import type { DialogAPI } from './preload/apis/dialog';
import type { OsPlatform } from './types/tool-maintenance';

declare global {
  interface Window {
    executeAPI: ExecuteAPI;
    sessionsAPI: SessionsAPI;
    settingsAPI: SettingsAPI;
    toolsAPI: ToolsAPI;
    dialogAPI: DialogAPI;
    moaiAPI: MoaiAPI;
    osPlatform: OsPlatform;
  }
}
