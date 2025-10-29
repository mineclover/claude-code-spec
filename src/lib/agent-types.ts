/**
 * Agent-related type definitions
 *
 * Supports LangGraph-style agent pattern where tasks are routed to
 * specialized agents with specific tools, permissions, and instructions.
 */

// ============================================================================
// Agent Definition (from workflow/agents/*.md files)
// ============================================================================

export interface AgentPermissions {
  allowList: string[];
  denyList: string[];
}

export interface AgentDefinition {
  name: string;
  description: string;
  allowedTools: string[];
  permissions: AgentPermissions;
  instructions: string; // Markdown content (body)
  filePath: string; // Source file path
  scope: 'project' | 'global'; // Where the agent is defined
  outputStyle?: string; // Output style for consistent formatting (default, explanatory, learning, or custom)
}

// ============================================================================
// Agent Context (runtime state)
// ============================================================================

export type AgentStatus = 'idle' | 'busy';

export interface AgentContext {
  // Identity
  name: string;
  description: string;

  // Capabilities
  allowedTools: string[];
  permissions: AgentPermissions;
  instructions: string;
  outputStyle?: string; // Output style for consistent formatting

  // Scope
  scope: 'project' | 'global';

  // Runtime state
  status: AgentStatus;
  currentTaskId?: string;
  currentSessionId?: string;

  // History
  completedTasks: string[];
  lastActiveTime: number;
  createdAt: number;
}

// ============================================================================
// Agent Statistics
// ============================================================================

export interface AgentStats {
  name: string;
  status: AgentStatus;
  totalCompleted: number;
  currentTask?: string;
  currentSession?: string;
  lastActiveTime: number;
  uptime: number; // milliseconds since creation
}

export interface AgentPoolStats {
  totalAgents: number;
  idleAgents: number;
  busyAgents: number;
  agentsByName: Map<string, AgentStats>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create AgentContext from AgentDefinition
 */
export function createAgentContext(definition: AgentDefinition): AgentContext {
  return {
    name: definition.name,
    description: definition.description,
    allowedTools: definition.allowedTools,
    permissions: definition.permissions,
    instructions: definition.instructions,
    outputStyle: definition.outputStyle,
    scope: definition.scope,
    status: 'idle',
    completedTasks: [],
    lastActiveTime: Date.now(),
    createdAt: Date.now(),
  };
}

/**
 * Check if agent has permission for a specific action
 */
export function hasPermission(agent: AgentContext, action: string): boolean {
  const { allowList, denyList } = agent.permissions;

  // Check deny list first
  for (const pattern of denyList) {
    if (matchesPattern(action, pattern)) {
      return false;
    }
  }

  // Check allow list
  for (const pattern of allowList) {
    if (matchesPattern(action, pattern)) {
      return true;
    }
  }

  // Default: deny
  return false;
}

/**
 * Simple glob-style pattern matching
 */
function matchesPattern(action: string, pattern: string): boolean {
  // Convert glob pattern to regex
  // "read:**" -> "^read:.*$"
  // "write:.env" -> "^write:\\.env$"
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(action);
}

/**
 * Get agent statistics
 */
export function getAgentStats(agent: AgentContext): AgentStats {
  return {
    name: agent.name,
    status: agent.status,
    totalCompleted: agent.completedTasks.length,
    currentTask: agent.currentTaskId,
    currentSession: agent.currentSessionId,
    lastActiveTime: agent.lastActiveTime,
    uptime: Date.now() - agent.createdAt,
  };
}
