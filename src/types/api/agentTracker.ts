/**
 * Type declarations for window.agentTrackerAPI
 */

import type { AgentTrackerAPI } from '../../preload/apis/agentTracker';

declare global {
  interface Window {
    agentTrackerAPI: AgentTrackerAPI;
  }
}

export {};
