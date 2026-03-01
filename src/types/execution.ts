/**
 * Execution types for multi-CLI execution tracking
 */

import type { StreamEvent } from './stream-events';

export interface ExecutionInfo {
  sessionId: string;
  pid: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  toolId: string; // which CLI tool
  projectPath: string;
  query: string;
  options: Record<string, unknown>; // tool-specific options
  events: StreamEvent[];
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface ExecutionRequest {
  toolId: string;
  projectPath: string;
  query: string;
  options: Record<string, unknown>;
}

export interface ExecutionResult {
  sessionId: string;
  status: 'completed' | 'failed';
  duration_ms?: number;
  total_cost_usd?: number;
  error?: string;
}
