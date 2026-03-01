/**
 * Type declarations for window.langGraphAPI
 */

import type { LangGraphAPI } from '../../preload/apis/langGraph';

declare global {
  interface Window {
    langGraphAPI: LangGraphAPI;
  }
}
