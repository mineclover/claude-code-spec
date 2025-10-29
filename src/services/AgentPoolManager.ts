/**
 * AgentPoolManager - Manages agent instances and their lifecycle
 *
 * Features:
 * - Agent instance creation and caching
 * - State tracking (idle/busy)
 * - Agent allocation and deallocation
 * - Statistics and monitoring
 */

import type {
  AgentContext,
  AgentDefinition,
  AgentPoolStats,
  AgentStats,
} from '../lib/agent-types';
import { createAgentContext, getAgentStats } from '../lib/agent-types';
import { appLogger } from '../main/app-context';
import { AgentLoader } from './AgentLoader';

export class AgentPoolManager {
  private agents: Map<string, AgentContext> = new Map();
  private agentDefinitions: Map<string, AgentDefinition> = new Map();
  private loader: AgentLoader;
  private projectPath?: string;

  constructor() {
    this.loader = new AgentLoader();

    appLogger.info('AgentPoolManager initialized', {
      module: 'AgentPoolManager',
    });
  }

  /**
   * Load agent definitions from project and global directories
   */
  async loadAgentDefinitions(projectPath: string): Promise<void> {
    this.projectPath = projectPath;

    try {
      const definitions = await this.loader.loadAllAgents(projectPath);

      this.agentDefinitions.clear();

      for (const definition of definitions) {
        this.agentDefinitions.set(definition.name, definition);
      }

      appLogger.info('Agent definitions loaded', {
        module: 'AgentPoolManager',
        count: definitions.length,
        projectPath,
      });
    } catch (error) {
      appLogger.error('Failed to load agent definitions', error instanceof Error ? error : undefined, {
        module: 'AgentPoolManager',
        projectPath,
      });
    }
  }

  /**
   * Get or create agent instance
   */
  async getAgent(agentName: string): Promise<AgentContext> {
    // Check if agent instance already exists
    const existing = this.agents.get(agentName);
    if (existing) {
      appLogger.debug('Returning existing agent', {
        module: 'AgentPoolManager',
        agentName,
        status: existing.status,
      });
      return existing;
    }

    // Get agent definition
    const definition = this.agentDefinitions.get(agentName);
    if (!definition) {
      throw new Error(`Agent definition not found: ${agentName}`);
    }

    // Create new agent instance
    const agent = createAgentContext(definition);
    this.agents.set(agentName, agent);

    appLogger.info('Created agent instance', {
      module: 'AgentPoolManager',
      agentName,
      scope: agent.scope,
    });

    return agent;
  }

  /**
   * Find idle agent by name (returns null if busy)
   */
  findIdleAgent(agentName: string): AgentContext | null {
    const agent = this.agents.get(agentName);

    if (!agent) {
      return null;
    }

    return agent.status === 'idle' ? agent : null;
  }

  /**
   * Mark agent as busy
   */
  markAgentBusy(agentName: string, taskId: string, sessionId: string): void {
    const agent = this.agents.get(agentName);

    if (!agent) {
      appLogger.warn('Cannot mark non-existent agent as busy', {
        module: 'AgentPoolManager',
        agentName,
      });
      return;
    }

    agent.status = 'busy';
    agent.currentTaskId = taskId;
    agent.currentSessionId = sessionId;
    agent.lastActiveTime = Date.now();

    appLogger.info('Agent marked as busy', {
      module: 'AgentPoolManager',
      agentName,
      taskId,
      sessionId,
    });
  }

  /**
   * Mark agent as idle
   */
  markAgentIdle(agentName: string, completedTaskId?: string): void {
    const agent = this.agents.get(agentName);

    if (!agent) {
      appLogger.warn('Cannot mark non-existent agent as idle', {
        module: 'AgentPoolManager',
        agentName,
      });
      return;
    }

    agent.status = 'idle';

    if (completedTaskId) {
      agent.completedTasks.push(completedTaskId);
    }

    agent.currentTaskId = undefined;
    agent.currentSessionId = undefined;
    agent.lastActiveTime = Date.now();

    appLogger.info('Agent marked as idle', {
      module: 'AgentPoolManager',
      agentName,
      completedTaskId,
      totalCompleted: agent.completedTasks.length,
    });
  }

  /**
   * Get agent by name (without creating)
   */
  getAgentByName(agentName: string): AgentContext | undefined {
    return this.agents.get(agentName);
  }

  /**
   * Get agent definition by name
   */
  getAgentDefinition(agentName: string): AgentDefinition | undefined {
    return this.agentDefinitions.get(agentName);
  }

  /**
   * Get all agent names
   */
  getAgentNames(): string[] {
    return Array.from(this.agentDefinitions.keys());
  }

  /**
   * Get statistics for a specific agent
   */
  getAgentStats(agentName: string): AgentStats | null {
    const agent = this.agents.get(agentName);

    if (!agent) {
      return null;
    }

    return getAgentStats(agent);
  }

  /**
   * Get statistics for all agents
   */
  getPoolStats(): AgentPoolStats {
    const agentStats = new Map<string, AgentStats>();
    let idleCount = 0;
    let busyCount = 0;

    for (const [name, agent] of this.agents) {
      agentStats.set(name, getAgentStats(agent));

      if (agent.status === 'idle') {
        idleCount++;
      } else {
        busyCount++;
      }
    }

    return {
      totalAgents: this.agents.size,
      idleAgents: idleCount,
      busyAgents: busyCount,
      agentsByName: agentStats,
    };
  }

  /**
   * Check if agent definition exists
   */
  hasAgentDefinition(agentName: string): boolean {
    return this.agentDefinitions.has(agentName);
  }

  /**
   * Clear all agent instances (keep definitions)
   */
  clearInstances(): void {
    const count = this.agents.size;
    this.agents.clear();

    appLogger.info('Cleared agent instances', {
      module: 'AgentPoolManager',
      count,
    });
  }

  /**
   * Reload agent definitions
   */
  async reloadDefinitions(): Promise<void> {
    if (!this.projectPath) {
      throw new Error('Project path not set');
    }

    await this.loadAgentDefinitions(this.projectPath);

    appLogger.info('Agent definitions reloaded', {
      module: 'AgentPoolManager',
      count: this.agentDefinitions.size,
    });
  }
}
