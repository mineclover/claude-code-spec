/**
 * Preload script
 * Exposes safe IPC APIs and environment constants to the renderer process
 */

import { contextBridge } from 'electron';
import { exposeDialogAPI } from './preload/apis/dialog';
import { exposeExecuteAPI } from './preload/apis/execute';
import { exposeMoaiAPI } from './preload/apis/moai';
import { exposeSessionsAPI } from './preload/apis/sessions';
import { exposeSettingsAPI } from './preload/apis/settings';
import { exposeToolsAPI } from './preload/apis/tools';

contextBridge.exposeInMainWorld('osPlatform', process.platform);

exposeDialogAPI();
exposeExecuteAPI();
exposeSessionsAPI();
exposeSettingsAPI();
exposeToolsAPI();
exposeMoaiAPI();
