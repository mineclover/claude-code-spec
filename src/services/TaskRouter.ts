/**
 * TaskRouter - Routes tasks to appropriate agents
 *
 * Integrates with:
 * - AgentPoolManager: Gets agent instances
 * - ProcessManager: Executes with agent context
 * - Task API: Loads task definitions
 */

import type { AgentContext } from '../lib/agent-types';
import { appLogger } from '../main/app-context';
import type { AgentPoolManager } from './AgentPoolManager';
import type { ProcessManager, StartExecutionParams } from '@context-action/code-api';

// Task interface (matches workflow/tasks/*.md structure)
export interface Task {
  id: string;
  title: string;
  description: string;
  area: string;
  assigned_agent: string;
  reviewer?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  references?: string;
  successCriteria?: string;
  projectPath: string; // Added for routing
}

export interface TaskExecutionOptions {
  model?: 'sonnet' | 'opus' | 'heroku';
  mcpConfig?: string;
}

export class TaskRouter {
  constructor(
    private agentPool: AgentPoolManager,
    private processManager: ProcessManager,
  ) {
    appLogger.info('TaskRouter initialized', {
      module: 'TaskRouter',
    });
  }

  /**
   * Route task to agent and execute
   * Returns sessionId of the execution
   */
  async routeTask(task: Task, options?: TaskExecutionOptions): Promise<string> {
    appLogger.info('Routing task', {
      module: 'TaskRouter',
      taskId: task.id,
      assignedAgent: task.assigned_agent,
    });

    // 1. Get agent instance
    const agent = await this.agentPool.getAgent(task.assigned_agent);

    if (agent.status === 'busy') {
      appLogger.warn('Agent is busy, will wait or use another instance', {
        module: 'TaskRouter',
        agentName: agent.name,
        currentTask: agent.currentTaskId,
      });
      // TODO: Implement queueing or wait logic
    }

    // 2. Mark agent as busy (temporarily, until we get sessionId)
    this.agentPool.markAgentBusy(agent.name, task.id, '');

    try {
      // 3. Build query with agent context
      const query = this.buildQueryWithAgentContext(agent, task);

      // 4. Execute with ProcessManager
      const params: StartExecutionParams = {
        projectPath: task.projectPath,
        query,
        model: options?.model,
        mcpConfig: options?.mcpConfig,
        agentName: agent.name, // Agent Pool integration
        taskId: task.id, // Task integration
        onComplete: (sessionId: string, code: number) => {
          // Mark agent as idle after completion
          this.agentPool.markAgentIdle(agent.name, task.id);

          appLogger.info('Task execution completed', {
            module: 'TaskRouter',
            taskId: task.id,
            sessionId,
            code,
          });
        },
      };

      const sessionId = await this.processManager.startExecution(params);

      // Update agent with sessionId
      this.agentPool.markAgentBusy(agent.name, task.id, sessionId);

      appLogger.info('Task routed successfully', {
        module: 'TaskRouter',
        taskId: task.id,
        agentName: agent.name,
        sessionId,
      });

      return sessionId;
    } catch (error) {
      // Mark agent as idle on error
      this.agentPool.markAgentIdle(agent.name);

      appLogger.error('Failed to route task', error instanceof Error ? error : undefined, {
        module: 'TaskRouter',
        taskId: task.id,
        agentName: agent.name,
      });

      throw error;
    }
  }

  /**
   * Build enhanced query with agent context
   */
  private buildQueryWithAgentContext(agent: AgentContext, task: Task): string {
    const sections: string[] = [];

    // Output style command (if specified)
    if (agent.outputStyle) {
      sections.push(`/output-style ${agent.outputStyle}`);
      sections.push('');
    }

    // Agent identity
    sections.push(`You are **${agent.name}**: ${agent.description}`);
    sections.push('');

    // Agent instructions
    if (agent.instructions) {
      sections.push('## Your Role and Instructions');
      sections.push(agent.instructions);
      sections.push('');
    }

    // Agent capabilities
    if (agent.allowedTools.length > 0) {
      sections.push('## Your Available Tools');
      sections.push(agent.allowedTools.map((tool) => `- ${tool}`).join('\n'));
      sections.push('');
    }

    // Permissions
    if (agent.permissions.allowList.length > 0 || agent.permissions.denyList.length > 0) {
      sections.push('## Your Permissions');

      if (agent.permissions.allowList.length > 0) {
        sections.push('**Allowed:**');
        sections.push(agent.permissions.allowList.map((p) => `- ${p}`).join('\n'));
      }

      if (agent.permissions.denyList.length > 0) {
        sections.push('**Denied:**');
        sections.push(agent.permissions.denyList.map((p) => `- ${p}`).join('\n'));
      }

      sections.push('');
    }

    // Task divider
    sections.push('---');
    sections.push('');

    // Task information
    sections.push(`# Task: ${task.title}`);
    sections.push('');

    if (task.area) {
      sections.push(`**Area:** ${task.area}`);
      sections.push('');
    }

    sections.push('## Description');
    sections.push(task.description);
    sections.push('');

    if (task.references) {
      sections.push('## References');
      sections.push(task.references);
      sections.push('');
    }

    if (task.successCriteria) {
      sections.push('## Success Criteria');
      sections.push(task.successCriteria);
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Execute task with direct query (for UI usage)
   */
  async executeWithAgent(
    agentName: string,
    query: string,
    projectPath: string,
    options?: TaskExecutionOptions,
  ): Promise<string> {
    appLogger.info('Executing with agent', {
      module: 'TaskRouter',
      agentName,
      projectPath,
    });

    // 1. Get agent instance
    const agent = await this.agentPool.getAgent(agentName);

    // 2. Mark agent as busy
    const tempTaskId = `direct-${Date.now()}`;
    this.agentPool.markAgentBusy(agent.name, tempTaskId, '');

    try {
      // 3. Build enhanced query
      const enhancedQuery = this.buildDirectQueryWithAgent(agent, query);

      // 4. Execute
      const params: StartExecutionParams = {
        projectPath,
        query: enhancedQuery,
        model: options?.model,
        mcpConfig: options?.mcpConfig,
        onComplete: (sessionId: string, code: number) => {
          this.agentPool.markAgentIdle(agent.name, tempTaskId);

          appLogger.info('Direct execution completed', {
            module: 'TaskRouter',
            agentName,
            sessionId,
            code,
          });
        },
      };

      const sessionId = await this.processManager.startExecution(params);

      // Update with sessionId
      this.agentPool.markAgentBusy(agent.name, tempTaskId, sessionId);

      return sessionId;
    } catch (error) {
      this.agentPool.markAgentIdle(agent.name);
      throw error;
    }
  }

  /**
   * Build query for direct execution (simpler format)
   */
  private buildDirectQueryWithAgent(agent: AgentContext, query: string): string {
    const sections: string[] = [];

    sections.push(`You are **${agent.name}**: ${agent.description}`);
    sections.push('');

    if (agent.instructions) {
      sections.push('## Your Instructions');
      sections.push(agent.instructions);
      sections.push('');
    }

    sections.push('---');
    sections.push('');
    sections.push(query);

    return sections.join('\n');
  }
}
