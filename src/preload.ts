/**
 * Preload script
 * Exposes 5 safe IPC APIs to the renderer process
 */

import { exposeDialogAPI } from './preload/apis/dialog';
import { exposeExecuteAPI } from './preload/apis/execute';
import { exposeSessionsAPI } from './preload/apis/sessions';
import { exposeSettingsAPI } from './preload/apis/settings';
import { exposeToolsAPI } from './preload/apis/tools';

exposeDialogAPI();
exposeExecuteAPI();
exposeSessionsAPI();
exposeSettingsAPI();
exposeToolsAPI();
