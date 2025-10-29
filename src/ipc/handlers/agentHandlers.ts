/**
 * Agent-related IPC handlers
 */
import * as os from 'node:os';
import * as path from 'node:path';
import { parseAgentMarkdown } from '../../lib/agentParser';
import type { AgentPoolStats, AgentStats } from '../../lib/agent-types';
import {
  deleteMarkdownFile,
  ensureDirectory,
  fileExists,
  listMarkdownFiles,
  readMarkdownFile,
  writeMarkdownFile,
} from '../../lib/fileLoader';
import { agentPoolManager } from '../../main/app-context';
import type { AgentListItem } from '../../types/agent';
import type { IPCRouter } from '../IPCRouter';

const PROJECT_AGENTS_DIR = 'workflow/agents';

/**
 * Get user-level agents directory path
 */
function getUserAgentsDir(): string {
  return path.join(os.homedir(), '.claude', 'agents');
}

/**
 * Get project-level agents directory path
 */
function getProjectAgentsDir(projectPath: string): string {
  return path.join(projectPath, PROJECT_AGENTS_DIR);
}

// Removed: Using parseAgentMarkdown from agentParser.ts instead

/**
 * Register agent-related IPC handlers
 */
export function registerAgentHandlers(router: IPCRouter): void {
  // List all agents (both project and user level)
  router.handle(
    'listAgents',
    async (_event, args: { projectPath: string }): Promise<AgentListItem[]> => {
      const { projectPath } = args;
      console.log('[AgentHandlers] listAgents called with projectPath:', projectPath);
      try {
        const agents: AgentListItem[] = [];

        // Get project-level agents
        const projectAgentsDir = getProjectAgentsDir(projectPath);
        console.log('[AgentHandlers] Project agents dir:', projectAgentsDir);

        const projectFiles = await listMarkdownFiles(projectAgentsDir);
        console.log('[AgentHandlers] Found project files:', projectFiles.length, projectFiles);

        for (const filePath of projectFiles) {
          try {
            const content = await readMarkdownFile(filePath);
            if (!content) {
              console.warn(`[AgentHandlers] No content for file:`, filePath);
              continue;
            }

            const agent = parseAgentMarkdown(content, filePath, 'project');
            console.log(`[AgentHandlers] Parsed agent:`, agent.name, {
              tools: agent.allowedTools?.length,
              permissions: !!agent.permissions,
            });

            agents.push({
              name: agent.name,
              description: agent.description,
              source: 'project',
              filePath: path.relative(projectPath, filePath),
              allowedToolsCount: agent.allowedTools?.length || 0,
              hasPermissions: !!agent.permissions,
            });
          } catch (error) {
            console.error(`[AgentHandlers] Failed to parse agent ${filePath}:`, error);
          }
        }

        // Get user-level agents
        const userAgentsDir = getUserAgentsDir();
        const userFiles = await listMarkdownFiles(userAgentsDir);

        for (const filePath of userFiles) {
          try {
            const content = await readMarkdownFile(filePath);
            if (!content) continue;

            const agent = parseAgentMarkdown(content, filePath, 'user');

            agents.push({
              name: agent.name,
              description: agent.description,
              source: 'user',
              filePath: filePath,
              allowedToolsCount: agent.allowedTools?.length || 0,
              hasPermissions: !!agent.permissions,
            });
          } catch (error) {
            console.warn(`[AgentHandlers] Failed to parse agent ${filePath}:`, error);
          }
        }

        // Sort by name
        agents.sort((a, b) => a.name.localeCompare(b.name));

        console.log(
          `[AgentHandlers] Returning ${agents.length} agents:`,
          agents.map((a) => a.name),
        );
        return agents;
      } catch (error) {
        console.error('[AgentHandlers] Failed to list agents:', error);
        return [];
      }
    },
  );

  // Get a single agent
  router.handle(
    'getAgent',
    async (
      _event,
      args: { source: 'project' | 'user'; agentName: string; projectPath?: string },
    ): Promise<string | null> => {
      const { source, agentName, projectPath } = args;
      try {
        let agentsDir: string;

        if (source === 'project') {
          if (!projectPath) {
            throw new Error('projectPath is required for project-level agents');
          }
          agentsDir = getProjectAgentsDir(projectPath);
        } else {
          agentsDir = getUserAgentsDir();
        }

        const filePath = path.join(agentsDir, `${agentName}.md`);
        return await readMarkdownFile(filePath);
      } catch (error) {
        console.error(`[AgentHandlers] Failed to get agent ${agentName}:`, error);
        return null;
      }
    },
  );

  // Create a new agent
  router.handle(
    'createAgent',
    async (
      _event,
      args: {
        source: 'project' | 'user';
        agentName: string;
        content: string;
        projectPath?: string;
      },
    ): Promise<{ success: boolean; error?: string }> => {
      const { source, agentName, content, projectPath } = args;
      try {
        let agentsDir: string;

        if (source === 'project') {
          if (!projectPath) {
            return { success: false, error: 'projectPath is required for project-level agents' };
          }
          agentsDir = getProjectAgentsDir(projectPath);
        } else {
          agentsDir = getUserAgentsDir();
        }

        await ensureDirectory(agentsDir);
        const filePath = path.join(agentsDir, `${agentName}.md`);

        // Check if file already exists
        if (await fileExists(filePath)) {
          return { success: false, error: 'Agent already exists' };
        }

        await writeMarkdownFile(filePath, content);
        return { success: true };
      } catch (error) {
        console.error(`[AgentHandlers] Failed to create agent ${agentName}:`, error);
        return { success: false, error: String(error) };
      }
    },
  );

  // Update an existing agent
  router.handle(
    'updateAgent',
    async (
      _event,
      args: {
        source: 'project' | 'user';
        agentName: string;
        content: string;
        projectPath?: string;
      },
    ): Promise<{ success: boolean; error?: string }> => {
      const { source, agentName, content, projectPath } = args;
      try {
        let agentsDir: string;

        if (source === 'project') {
          if (!projectPath) {
            return { success: false, error: 'projectPath is required for project-level agents' };
          }
          agentsDir = getProjectAgentsDir(projectPath);
        } else {
          agentsDir = getUserAgentsDir();
        }

        const filePath = path.join(agentsDir, `${agentName}.md`);
        await writeMarkdownFile(filePath, content);
        return { success: true };
      } catch (error) {
        console.error(`[AgentHandlers] Failed to update agent ${agentName}:`, error);
        return { success: false, error: String(error) };
      }
    },
  );

  // Delete an agent
  router.handle(
    'deleteAgent',
    async (
      _event,
      args: { source: 'project' | 'user'; agentName: string; projectPath?: string },
    ): Promise<{ success: boolean; error?: string }> => {
      const { source, agentName, projectPath } = args;
      try {
        let agentsDir: string;

        if (source === 'project') {
          if (!projectPath) {
            return { success: false, error: 'projectPath is required for project-level agents' };
          }
          agentsDir = getProjectAgentsDir(projectPath);
        } else {
          agentsDir = getUserAgentsDir();
        }

        const filePath = path.join(agentsDir, `${agentName}.md`);
        await deleteMarkdownFile(filePath);
        return { success: true };
      } catch (error) {
        console.error(`[AgentHandlers] Failed to delete agent ${agentName}:`, error);
        return { success: false, error: String(error) };
      }
    },
  );

  // Get agent runtime statistics
  router.handle(
    'getAgentStats',
    async (_event, args: { agentName: string }): Promise<AgentStats | null> => {
      const { agentName } = args;
      try {
        const stats = agentPoolManager.getAgentStats(agentName);
        return stats;
      } catch (error) {
        console.error(`[AgentHandlers] Failed to get agent stats for ${agentName}:`, error);
        return null;
      }
    },
  );

  // Get agent pool statistics
  router.handle('getPoolStats', async (): Promise<AgentPoolStats> => {
    try {
      return agentPoolManager.getPoolStats();
    } catch (error) {
      console.error('[AgentHandlers] Failed to get pool stats:', error);
      return {
        totalAgents: 0,
        idleAgents: 0,
        busyAgents: 0,
        agentsByName: new Map(),
      };
    }
  });
}
