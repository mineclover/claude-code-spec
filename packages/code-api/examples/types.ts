/**
 * Common types for structured queries
 */

// ============================================================================
// Structured JSON Output Types
// ============================================================================

/**
 * Review result (matches structured-json output-style)
 */
export interface ReviewResult {
  review: number;
  name: string;
  tags: string[];
}

/**
 * Multiple review results
 */
export type ReviewResults = ReviewResult[];

/**
 * Agent statistics result
 */
export interface AgentStatsResult {
  agentName: string;
  status: 'idle' | 'busy';
  tasksCompleted: number;
  currentTask?: string;
  uptime: number;
  performance: {
    avgDuration: number;
    avgCost: number;
  };
}

/**
 * Code analysis result
 */
export interface CodeAnalysisResult {
  file: string;
  complexity: number;
  maintainability: number;
  issues: Array<{
    severity: 'low' | 'medium' | 'high';
    message: string;
    line?: number;
  }>;
  suggestions: string[];
}

/**
 * Task execution plan
 */
export interface TaskExecutionPlan {
  taskId: string;
  steps: Array<{
    order: number;
    description: string;
    estimated_duration: string;
    dependencies: string[];
  }>;
  total_estimated_duration: string;
  risks: string[];
}

// ============================================================================
// Type Guards
// ============================================================================

export function isReviewResult(data: unknown): data is ReviewResult {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.review === 'number' &&
    typeof obj.name === 'string' &&
    Array.isArray(obj.tags) &&
    obj.tags.every((t) => typeof t === 'string')
  );
}

export function isReviewResults(data: unknown): data is ReviewResults {
  return Array.isArray(data) && data.every(isReviewResult);
}

export function isAgentStatsResult(data: unknown): data is AgentStatsResult {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.agentName === 'string' &&
    (obj.status === 'idle' || obj.status === 'busy') &&
    typeof obj.tasksCompleted === 'number' &&
    typeof obj.uptime === 'number' &&
    typeof obj.performance === 'object'
  );
}

export function isCodeAnalysisResult(data: unknown): data is CodeAnalysisResult {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.file === 'string' &&
    typeof obj.complexity === 'number' &&
    typeof obj.maintainability === 'number' &&
    Array.isArray(obj.issues) &&
    Array.isArray(obj.suggestions)
  );
}

export function isTaskExecutionPlan(data: unknown): data is TaskExecutionPlan {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.taskId === 'string' &&
    Array.isArray(obj.steps) &&
    typeof obj.total_estimated_duration === 'string' &&
    Array.isArray(obj.risks)
  );
}
