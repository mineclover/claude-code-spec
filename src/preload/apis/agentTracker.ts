/**
 * Preload API for AgentTracker
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  ExecutionMetadata,
  HealthStatus,
  TrackedExecution,
} from '../../services/AgentTracker';

export interface AgentTrackerAPI {
  // Execution registration
  registerExecution: (sessionId: string, metadata: ExecutionMetadata) => Promise<{ success: boolean }>;
  updateStatus: (sessionId: string, status: 'running' | 'completed' | 'failed') => Promise<{ success: boolean }>;
  updateHeartbeat: (sessionId: string) => Promise<{ success: boolean }>;
  unregisterExecution: (sessionId: string) => Promise<{ success: boolean }>;

  // Monitoring
  getActiveExecutions: () => Promise<TrackedExecution[]>;
  getZombieProcesses: () => Promise<TrackedExecution[]>;
  getAllTracked: () => Promise<TrackedExecution[]>;

  // Health checking
  startHealthCheck: (interval?: number) => Promise<{ success: boolean }>;
  stopHealthCheck: () => Promise<{ success: boolean }>;
  checkExecution: (sessionId: string) => Promise<HealthStatus>;
}

export function exposeAgentTrackerAPI(): void {
  const api: AgentTrackerAPI = {
    // Execution registration
    registerExecution: (sessionId: string, metadata: ExecutionMetadata) =>
      ipcRenderer.invoke('agent-tracker:registerExecution', { sessionId, metadata }),

    updateStatus: (sessionId: string, status: 'running' | 'completed' | 'failed') =>
      ipcRenderer.invoke('agent-tracker:updateStatus', { sessionId, status }),

    updateHeartbeat: (sessionId: string) =>
      ipcRenderer.invoke('agent-tracker:updateHeartbeat', sessionId),

    unregisterExecution: (sessionId: string) =>
      ipcRenderer.invoke('agent-tracker:unregisterExecution', sessionId),

    // Monitoring
    getActiveExecutions: () => ipcRenderer.invoke('agent-tracker:getActiveExecutions'),

    getZombieProcesses: () => ipcRenderer.invoke('agent-tracker:getZombieProcesses'),

    getAllTracked: () => ipcRenderer.invoke('agent-tracker:getAllTracked'),

    // Health checking
    startHealthCheck: (interval?: number) =>
      ipcRenderer.invoke('agent-tracker:startHealthCheck', interval),

    stopHealthCheck: () => ipcRenderer.invoke('agent-tracker:stopHealthCheck'),

    checkExecution: (sessionId: string) =>
      ipcRenderer.invoke('agent-tracker:checkExecution', sessionId),
  };

  contextBridge.exposeInMainWorld('agentTrackerAPI', api);
}
