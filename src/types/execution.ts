/**
 * Execution types for multi-CLI execution tracking
 */

import type { McpExecutionOverride, ResolvedMcpConfig } from './mcp-policy';
import type { CacheMetrics, FingerprintPair } from './prefix-fingerprint';
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
  /** Running cumulative token / cost metrics, updated per event. */
  metrics?: CacheMetrics;
  /** Prefix fingerprint pair; static is set at start, observed once system/init arrives. */
  fingerprint?: FingerprintPair;
  /** CLI-reported session id (from system/init). Used to pair sidecar metadata. */
  cliSessionId?: string;
  /** Resolved MCP config used for this run, if the resolver pipeline was invoked. */
  mcpResolved?: ResolvedMcpConfig;
}

export interface ExecutionRequest {
  toolId: string;
  projectPath: string;
  query: string;
  options: Record<string, unknown>;
  /**
   * When provided, the service resolves MCP using the project registry +
   * policy and this override, materializes a temp config file, and overrides
   * options.mcpConfig with the generated path. The resolved config is also
   * stamped on the ExecutionInfo and (later) on the sidecar SessionMeta.
   */
  mcpOverride?: McpExecutionOverride;
}

export interface ExecutionResult {
  sessionId: string;
  status: 'completed' | 'failed';
  duration_ms?: number;
  total_cost_usd?: number;
  error?: string;
}
