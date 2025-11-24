/**
 * Report Types for Central Management System
 */

export type ReportType = 'assignment' | 'progress' | 'completion' | 'periodic';

export interface BaseReport {
  id: string; // UUID
  type: ReportType;
  projectPath: string;
  timestamp: string; // ISO 8601
  reportedBy: string; // Agent name or 'system'
}

export interface AssignmentReport extends BaseReport {
  type: 'assignment';
  taskId: string;
  agentName: string;
  estimatedDuration?: number; // Minutes
}

export interface ProgressReport extends BaseReport {
  type: 'progress';
  taskId: string;
  agentName: string;
  progress: {
    percent: number; // 0-100
    confidence: number; // 0-100
    method: 'criteria' | 'duration' | 'changes' | 'estimated';
  };
  matchedCriteria?: string[];
  sessionId?: string;
}

export interface CompletionReport extends BaseReport {
  type: 'completion';
  taskId: string;
  agentName: string;
  success: boolean;
  duration: number; // Minutes
  matchedCriteria: string[];
  sessionId: string;
  reviewNotes?: string;
}

export interface PeriodicReport extends BaseReport {
  type: 'periodic';
  projectStats: {
    totalTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    completedTasks: number;
    cancelledTasks: number;
    executableTasks: number;
  };
  agentStats: {
    totalAgents: number;
    idleAgents: number;
    busyAgents: number;
  };
  recentActivity: {
    taskId: string;
    status: string;
    timestamp: string;
  }[];
}

export type Report = AssignmentReport | ProgressReport | CompletionReport | PeriodicReport;

export interface ProjectRegistration {
  projectPath: string; // Absolute path
  name: string; // Project name
  registeredAt: string; // ISO 8601 timestamp
  lastSeen: string; // ISO 8601 timestamp
  healthStatus: 'healthy' | 'warning' | 'error' | 'unknown';

  // Statistics
  stats: {
    totalTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    completedTasks: number;
    cancelledTasks: number;
    totalAgents: number;
    activeAgents: number;
  };
}

export interface ExecutionRecord {
  executionId: string; // UUID
  projectPath: string;
  agentName: string;
  taskId?: string;
  sessionId: string;
  pid: number;
  status: 'running' | 'completed' | 'failed' | 'zombie';
  startedAt: string; // ISO 8601
  lastHeartbeat: string; // ISO 8601
  completedAt?: string; // ISO 8601
  exitCode?: number;
  error?: string;
}

export interface ReportFilter {
  projectPath?: string;
  type?: ReportType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface SystemMetrics {
  timeRange: TimeRange;
  projects: {
    total: number;
    healthy: number;
    warnings: number;
    errors: number;
  };
  tasks: {
    total: number;
    completed: number;
    failed: number;
    avgCompletionTime: number; // Minutes
  };
  executions: {
    total: number;
    successful: number;
    failed: number;
    zombies: number;
  };
}

// LangGraph Workflow Execution Record
export interface WorkflowExecution {
  workflowId: string; // Unique workflow ID
  projectPath: string;
  status: 'running' | 'completed' | 'failed' | 'partial';
  startedAt: string; // ISO 8601
  completedAt?: string; // ISO 8601
  duration?: number; // Milliseconds

  // Task execution summary
  tasks: {
    total: number;
    completed: number;
    failed: number;
    taskIds: string[];
  };

  // Metrics
  metrics: {
    totalTokens: {
      input: number;
      output: number;
      cacheRead: number;
    };
    totalCost: number; // USD
    avgTaskDuration: number; // Milliseconds
  };

  // State snapshot
  finalState?: {
    completedTasks: string[];
    failedTasks: string[];
    logs: string[];
  };

  // Error info
  error?: string;
}
