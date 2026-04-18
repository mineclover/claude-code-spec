/**
 * MCP path constants — single source of truth for on-disk file locations.
 *
 * These relative paths are resolved against either the user's home directory
 * (`~/.claude/...`) or a specific project root (`<project>/.claude/...`).
 * Resolver, handlers, and CLI all consume the same constants to prevent
 * subtle divergence (e.g., one module writing to `.claude/mcp-registry.json`
 * while another reads `.claude/registry.json`).
 */

import os from 'node:os';
import path from 'node:path';
import type { McpEntryScope } from '../../types/api/mcp';

export const MCP_REGISTRY_FILE = path.join('.claude', 'mcp-registry.json');
export const MCP_POLICY_FILE = path.join('.claude', 'mcp-policy.json');
export const MCP_PRESETS_FILE = path.join('.claude', 'mcp-presets.json');

/**
 * Resolve the registry file path for a given scope.
 *
 * - `user` scope: `<homeDir>/.claude/mcp-registry.json`
 * - `project` scope: `<projectPath>/.claude/mcp-registry.json` (projectPath required)
 */
export function registryPathFor(
  scope: McpEntryScope,
  projectPath: string | null,
  homeDir?: string,
): string {
  if (scope === 'project') {
    if (!projectPath) throw new Error('project registry requires a projectPath');
    return path.join(projectPath, MCP_REGISTRY_FILE);
  }
  return path.join(homeDir ?? os.homedir(), MCP_REGISTRY_FILE);
}

export function policyPathFor(projectPath: string): string {
  return path.join(projectPath, MCP_POLICY_FILE);
}

export function presetsPathFor(projectPath: string): string {
  return path.join(projectPath, MCP_PRESETS_FILE);
}
