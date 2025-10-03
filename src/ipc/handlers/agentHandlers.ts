/**
 * Agent-related IPC handlers
 */
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { parseAgentMarkdown } from '../../lib/agentParser';
import type { AgentListItem } from '../../types/agent';
import type { IPCRouter } from '../IPCRouter';

const PROJECT_AGENTS_DIR = '.claude/agents';

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

/**
 * Ensure agents directory exists
 */
async function ensureAgentsDirectory(agentsPath: string): Promise<void> {
  await fs.mkdir(agentsPath, { recursive: true });
}

// Removed: Using parseAgentMarkdown from agentParser.ts instead

/**
 * Register agent-related IPC handlers
 */
export function registerAgentHandlers(router: IPCRouter): void {
  // List all agents (both project and user level)
  router.handle<{ projectPath: string }, AgentListItem[]>('listAgents', async ({ projectPath }) => {
    try {
      const agents: AgentListItem[] = [];

      // Get project-level agents
      const projectAgentsDir = getProjectAgentsDir(projectPath);
      try {
        await ensureAgentsDirectory(projectAgentsDir);
        const projectFiles = await fs.readdir(projectAgentsDir);
        const projectAgentFiles = projectFiles.filter((f) => f.endsWith('.md'));

        for (const file of projectAgentFiles) {
          try {
            const filePath = path.join(projectAgentsDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const agent = parseAgentMarkdown(content, filePath, 'project');

            agents.push({
              name: agent.name,
              description: agent.description,
              source: 'project',
              filePath: path.relative(projectPath, filePath),
              allowedToolsCount: agent.allowedTools?.length || 0,
              hasPermissions: !!agent.permissions,
            });
          } catch (error) {
            console.warn(`[AgentHandlers] Failed to parse agent ${file}:`, error);
          }
        }
      } catch (error) {
        console.warn('[AgentHandlers] Failed to read project agents:', error);
      }

      // Get user-level agents
      const userAgentsDir = getUserAgentsDir();
      try {
        await ensureAgentsDirectory(userAgentsDir);
        const userFiles = await fs.readdir(userAgentsDir);
        const userAgentFiles = userFiles.filter((f) => f.endsWith('.md'));

        for (const file of userAgentFiles) {
          try {
            const filePath = path.join(userAgentsDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
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
            console.warn(`[AgentHandlers] Failed to parse agent ${file}:`, error);
          }
        }
      } catch (error) {
        console.warn('[AgentHandlers] Failed to read user agents:', error);
      }

      // Sort by name
      agents.sort((a, b) => a.name.localeCompare(b.name));

      return agents;
    } catch (error) {
      console.error('[AgentHandlers] Failed to list agents:', error);
      return [];
    }
  });

  // Get a single agent
  router.handle<
    { source: 'project' | 'user'; agentName: string; projectPath?: string },
    string | null
  >('getAgent', async ({ source, agentName, projectPath }) => {
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
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error(`[AgentHandlers] Failed to get agent ${agentName}:`, error);
      return null;
    }
  });

  // Create a new agent
  router.handle<
    { source: 'project' | 'user'; agentName: string; content: string; projectPath?: string },
    { success: boolean; error?: string }
  >('createAgent', async ({ source, agentName, content, projectPath }) => {
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

      await ensureAgentsDirectory(agentsDir);
      const filePath = path.join(agentsDir, `${agentName}.md`);

      // Check if file already exists
      try {
        await fs.access(filePath);
        return { success: false, error: 'Agent already exists' };
      } catch {
        // File doesn't exist, proceed with creation
      }

      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      console.error(`[AgentHandlers] Failed to create agent ${agentName}:`, error);
      return { success: false, error: String(error) };
    }
  });

  // Update an existing agent
  router.handle<
    { source: 'project' | 'user'; agentName: string; content: string; projectPath?: string },
    { success: boolean; error?: string }
  >('updateAgent', async ({ source, agentName, content, projectPath }) => {
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
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      console.error(`[AgentHandlers] Failed to update agent ${agentName}:`, error);
      return { success: false, error: String(error) };
    }
  });

  // Delete an agent
  router.handle<
    { source: 'project' | 'user'; agentName: string; projectPath?: string },
    { success: boolean; error?: string }
  >('deleteAgent', async ({ source, agentName, projectPath }) => {
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
      await fs.unlink(filePath);
      return { success: true };
    } catch (error) {
      console.error(`[AgentHandlers] Failed to delete agent ${agentName}:`, error);
      return { success: false, error: String(error) };
    }
  });
}
