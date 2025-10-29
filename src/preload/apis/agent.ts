/**
 * Agent API exposure
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { AgentPoolStats, AgentStats } from '../../lib/agent-types';
import type { AgentListItem } from '../../types/agent';

export interface AgentAPI {
  listAgents: (projectPath: string) => Promise<AgentListItem[]>;
  getAgent: (
    source: 'project' | 'user',
    agentName: string,
    projectPath?: string,
  ) => Promise<string | null>;
  createAgent: (
    source: 'project' | 'user',
    agentName: string,
    content: string,
    projectPath?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  updateAgent: (
    source: 'project' | 'user',
    agentName: string,
    content: string,
    projectPath?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteAgent: (
    source: 'project' | 'user',
    agentName: string,
    projectPath?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  getAgentStats: (agentName: string) => Promise<AgentStats | null>;
  getPoolStats: () => Promise<AgentPoolStats>;
}

export function exposeAgentAPI(): void {
  const agentAPI: AgentAPI = {
    listAgents: (projectPath: string) => ipcRenderer.invoke('agent:listAgents', { projectPath }),

    getAgent: (source: 'project' | 'user', agentName: string, projectPath?: string) =>
      ipcRenderer.invoke('agent:getAgent', { source, agentName, projectPath }),

    createAgent: (
      source: 'project' | 'user',
      agentName: string,
      content: string,
      projectPath?: string,
    ) => ipcRenderer.invoke('agent:createAgent', { source, agentName, content, projectPath }),

    updateAgent: (
      source: 'project' | 'user',
      agentName: string,
      content: string,
      projectPath?: string,
    ) => ipcRenderer.invoke('agent:updateAgent', { source, agentName, content, projectPath }),

    deleteAgent: (source: 'project' | 'user', agentName: string, projectPath?: string) =>
      ipcRenderer.invoke('agent:deleteAgent', { source, agentName, projectPath }),

    getAgentStats: (agentName: string) =>
      ipcRenderer.invoke('agent:getAgentStats', { agentName }),

    getPoolStats: () => ipcRenderer.invoke('agent:getPoolStats'),
  };

  contextBridge.exposeInMainWorld('agentAPI', agentAPI);
}
