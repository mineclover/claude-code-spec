/**
 * MCP IPC Handlers — Registry CRUD, Policy CRUD, and Resolver entrypoint.
 *
 * File shapes:
 *   ~/.claude/mcp-registry.json           — user-scope registry
 *   <project>/.claude/mcp-registry.json   — project-scope registry (overrides user)
 *   <project>/.claude/mcp-policy.json     — project policy
 *   <project>/.claude/.mcp-generated-*.json — materialized CLI configs
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  parseRegistryFileContent,
  sanitizeRegistryEntry,
} from '../../lib/mcp/entry';
import {
  policyPathFor,
  presetsPathFor,
  registryPathFor,
} from '../../lib/mcp/paths';
import { sanitizePolicy } from '../../lib/mcp/policy';
import { sanitizePreset, sanitizePresets } from '../../lib/mcp/preset';
import { writeJsonAtomic } from '../../lib/fileIo';
import { mcpResolverService } from '../../services/McpResolverService';
import type {
  McpEntryScope,
  McpResolveRequest,
  McpResolveResult,
} from '../../types/api/mcp';
import type {
  McpPolicyFile,
  McpPreset,
  McpPresetsFile,
  McpRegistryEntry,
  McpRegistryFile,
  ResolvedRegistry,
} from '../../types/mcp-policy';
import type { IPCRouter } from '../IPCRouter';

async function readRegistryFile(filePath: string): Promise<McpRegistryFile> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return parseRegistryFileContent(raw) ?? { schemaVersion: 1, entries: [] };
  } catch {
    return { schemaVersion: 1, entries: [] };
  }
}

export function registerMcpHandlers(router: IPCRouter): void {
  router.handle(
    'get-registry',
    async (_event, projectPath: string | null): Promise<ResolvedRegistry> => {
      return mcpResolverService.loadRegistry({ projectPath: projectPath ?? undefined });
    },
  );

  router.handle(
    'save-registry-entry',
    async (
      _event,
      scope: McpEntryScope,
      entry: McpRegistryEntry,
      projectPath: string | null,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const sanitized = sanitizeRegistryEntry(entry, scope);
        if (!sanitized) {
          return { success: false, error: 'Invalid entry: id and command are required' };
        }
        const filePath = registryPathFor(scope, projectPath);
        const file = await readRegistryFile(filePath);
        const others = file.entries.filter((e) => e.id !== sanitized.id);
        const next: McpRegistryFile = {
          schemaVersion: 1,
          entries: [...others, sanitized].sort((a, b) =>
            a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
          ),
        };
        await writeJsonAtomic(filePath, next);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Write failed',
        };
      }
    },
  );

  router.handle(
    'delete-registry-entry',
    async (
      _event,
      scope: McpEntryScope,
      id: string,
      projectPath: string | null,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (typeof id !== 'string' || !id) {
          return { success: false, error: 'id required' };
        }
        const filePath = registryPathFor(scope, projectPath);
        const file = await readRegistryFile(filePath);
        const next: McpRegistryFile = {
          schemaVersion: 1,
          entries: file.entries.filter((e) => e.id !== id),
        };
        await writeJsonAtomic(filePath, next);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Delete failed',
        };
      }
    },
  );

  router.handle(
    'get-policy',
    async (_event, projectPath: string): Promise<McpPolicyFile> => {
      return mcpResolverService.loadPolicy(projectPath);
    },
  );

  router.handle(
    'save-policy',
    async (
      _event,
      projectPath: string,
      policy: McpPolicyFile,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const sanitized = sanitizePolicy(policy);
        await writeJsonAtomic(policyPathFor(projectPath), sanitized);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Write failed',
        };
      }
    },
  );

  router.handle('resolve', async (_event, request: McpResolveRequest): Promise<McpResolveResult> => {
    const { projectPath, override, materialize } = request;
    const registry = mcpResolverService.loadRegistry({ projectPath });
    const policy = mcpResolverService.loadPolicy(projectPath);
    const resolved = mcpResolverService.resolve({ registry, policy, override });
    let writtenPath: string | undefined;
    if (materialize) {
      const written = mcpResolverService.materialize(resolved, projectPath);
      writtenPath = written.path;
    }
    return { resolved, registry, policy, writtenPath };
  });

  router.handle('list-presets', async (_event, projectPath: string): Promise<McpPresetsFile> => {
    const file = presetsPathFor(projectPath);
    try {
      const raw = await fs.readFile(file, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<McpPresetsFile>;
      const presets = Array.isArray(parsed.presets) ? parsed.presets : [];
      return { schemaVersion: 1, presets: sanitizePresets(presets) };
    } catch {
      return { schemaVersion: 1, presets: [] };
    }
  });

  router.handle(
    'save-preset',
    async (
      _event,
      projectPath: string,
      preset: McpPreset,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const sanitized = sanitizePreset(preset);
        if (!sanitized) {
          return { success: false, error: 'Invalid preset: id and name are required' };
        }
        const file = presetsPathFor(projectPath);
        const existing = await readPresets(file);
        const others = existing.presets.filter((p) => p.id !== sanitized.id);
        const next: McpPresetsFile = {
          schemaVersion: 1,
          presets: [...others, sanitized].sort((a, b) =>
            a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
          ),
        };
        await writeJsonAtomic(file, next);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Write failed',
        };
      }
    },
  );

  router.handle(
    'delete-preset',
    async (
      _event,
      projectPath: string,
      id: string,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (typeof id !== 'string' || !id) return { success: false, error: 'id required' };
        const file = presetsPathFor(projectPath);
        const existing = await readPresets(file);
        const next: McpPresetsFile = {
          schemaVersion: 1,
          presets: existing.presets.filter((p) => p.id !== id),
        };
        await writeJsonAtomic(file, next);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Delete failed',
        };
      }
    },
  );
}

async function readPresets(file: string): Promise<McpPresetsFile> {
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<McpPresetsFile>;
    const presets = Array.isArray(parsed.presets) ? parsed.presets : [];
    return { schemaVersion: 1, presets: sanitizePresets(presets) };
  } catch {
    return { schemaVersion: 1, presets: [] };
  }
}

// Exported for tests — no other callers should use these directly.
// Re-exports the pure entity-module sanitizers so the test surface stays stable.
export const __internal = {
  sanitizeRegistryEntry,
  sanitizePolicy,
  sanitizePreset,
  sanitizePresets,
};
