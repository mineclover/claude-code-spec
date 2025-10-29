/**
 * AgentLoader - Loads agent definitions from workflow/agents/*.md files
 *
 * Supports YAML frontmatter + Markdown format:
 * ---
 * name: agent-name
 * description: Agent description
 * outputStyle: default | explanatory | learning | custom-style-name
 * allowedTools: [...]
 * permissions:
 *   allowList: [...]
 *   denyList: [...]
 * ---
 * # Agent Instructions
 * ...
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { AgentDefinition } from '../lib/agent-types';
import { appLogger } from '../main/app-context';

export class AgentLoader {
  /**
   * Load all agents from a project's workflow/agents directory
   */
  async loadProjectAgents(projectPath: string): Promise<AgentDefinition[]> {
    const agentsDir = path.join(projectPath, 'workflow', 'agents');

    try {
      if (!fs.existsSync(agentsDir)) {
        appLogger.debug('No agents directory found', {
          module: 'AgentLoader',
          projectPath,
          agentsDir,
        });
        return [];
      }

      const files = fs.readdirSync(agentsDir);
      const mdFiles = files.filter((file) => file.endsWith('.md'));

      const agents: AgentDefinition[] = [];

      for (const file of mdFiles) {
        try {
          const filePath = path.join(agentsDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const agent = this.parseAgentFile(content, file, 'project');
          agents.push(agent);

          appLogger.debug('Loaded agent', {
            module: 'AgentLoader',
            agentName: agent.name,
            scope: 'project',
          });
        } catch (error) {
          appLogger.error('Failed to load agent file', error instanceof Error ? error : undefined, {
            module: 'AgentLoader',
            file,
          });
        }
      }

      appLogger.info('Loaded project agents', {
        module: 'AgentLoader',
        projectPath,
        count: agents.length,
      });

      return agents;
    } catch (error) {
      appLogger.error('Failed to load project agents', error instanceof Error ? error : undefined, {
        module: 'AgentLoader',
        projectPath,
      });
      return [];
    }
  }

  /**
   * Load global agents from ~/.claude/agents
   */
  async loadGlobalAgents(): Promise<AgentDefinition[]> {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      appLogger.warn('Cannot determine home directory', {
        module: 'AgentLoader',
      });
      return [];
    }

    const agentsDir = path.join(homeDir, '.claude', 'agents');

    try {
      if (!fs.existsSync(agentsDir)) {
        appLogger.debug('No global agents directory found', {
          module: 'AgentLoader',
          agentsDir,
        });
        return [];
      }

      const files = fs.readdirSync(agentsDir);
      const mdFiles = files.filter((file) => file.endsWith('.md'));

      const agents: AgentDefinition[] = [];

      for (const file of mdFiles) {
        try {
          const filePath = path.join(agentsDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const agent = this.parseAgentFile(content, file, 'global');
          agents.push(agent);

          appLogger.debug('Loaded global agent', {
            module: 'AgentLoader',
            agentName: agent.name,
            scope: 'global',
          });
        } catch (error) {
          appLogger.error('Failed to load global agent file', error instanceof Error ? error : undefined, {
            module: 'AgentLoader',
            file,
          });
        }
      }

      appLogger.info('Loaded global agents', {
        module: 'AgentLoader',
        count: agents.length,
      });

      return agents;
    } catch (error) {
      appLogger.error('Failed to load global agents', error instanceof Error ? error : undefined, {
        module: 'AgentLoader',
      });
      return [];
    }
  }

  /**
   * Parse agent file (YAML frontmatter + Markdown)
   */
  private parseAgentFile(
    content: string,
    filename: string,
    scope: 'project' | 'global',
  ): AgentDefinition {
    const parsed = matter(content);
    const data = parsed.data;

    // Validate required fields
    if (!data.name) {
      throw new Error(`Agent file ${filename} missing required field: name`);
    }

    if (!data.description) {
      throw new Error(`Agent file ${filename} missing required field: description`);
    }

    return {
      name: data.name,
      description: data.description,
      allowedTools: data.allowedTools || [],
      permissions: {
        allowList: data.permissions?.allowList || [],
        denyList: data.permissions?.denyList || [],
      },
      instructions: parsed.content.trim(),
      outputStyle: data.outputStyle, // Optional: default, explanatory, learning, or custom
      filePath: filename,
      scope,
    };
  }

  /**
   * Load all agents (global + project)
   */
  async loadAllAgents(projectPath: string): Promise<AgentDefinition[]> {
    const [globalAgents, projectAgents] = await Promise.all([
      this.loadGlobalAgents(),
      this.loadProjectAgents(projectPath),
    ]);

    // Project agents override global agents with same name
    const agentMap = new Map<string, AgentDefinition>();

    for (const agent of globalAgents) {
      agentMap.set(agent.name, agent);
    }

    for (const agent of projectAgents) {
      agentMap.set(agent.name, agent);
    }

    const allAgents = Array.from(agentMap.values());

    appLogger.info('Loaded all agents', {
      module: 'AgentLoader',
      totalAgents: allAgents.length,
      globalAgents: globalAgents.length,
      projectAgents: projectAgents.length,
    });

    return allAgents;
  }
}
