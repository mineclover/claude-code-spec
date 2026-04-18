/**
 * McpResolverService — resolves the final set of MCP servers for an execution
 * by layering:
 *
 *   1. Registry (user + project) — universe of servers the app knows about
 *   2. Project Policy           — defaultEnabled / allowed / forbidden
 *   3. Execution Override       — per-run { add, remove }
 *
 * Output is a {@link ResolvedMcpConfig} with:
 *   - enabledServerIds (sorted) — drives the CLI --mcp-config file
 *   - canonicalJson + hash      — feeds the prefix fingerprint
 *   - audit trail               — baseline, addedByOverride, removedByOverride,
 *                                 disallowed (with reason)
 *
 * The service is pure w.r.t. computation; file I/O is limited to reading JSON
 * config files from the provided paths and (optionally) materializing the
 * resolved CLI config to a temp file. No Electron, no settings — safe to use
 * from the Node CLI.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeTextAtomicSync } from '../lib/fileIo';
import { parseRegistryFileContent } from '../lib/mcp/entry';
import { MCP_POLICY_FILE, MCP_REGISTRY_FILE } from '../lib/mcp/paths';
import { canonicalJson, sha256Hex } from '../lib/prefixHashing';
import {
  DEFAULT_MCP_POLICY,
  type CliMcpConfigFile,
  type McpExecutionOverride,
  type McpPolicyFile,
  type McpRegistryEntry,
  type McpRegistryFile,
  type ResolvedMcpConfig,
  type ResolvedRegistry,
} from '../types/mcp-policy';

export interface LoadRegistryInput {
  /** Project root. When omitted, only user scope is loaded. */
  projectPath?: string;
  /** Home directory override (tests). */
  homeDir?: string;
}

export interface ResolveInput {
  registry: ResolvedRegistry;
  policy: McpPolicyFile;
  override?: McpExecutionOverride;
}

export class McpResolverService {
  /**
   * Read user + project registry files and merge into a single entry list.
   * Project entries override user entries with the same id (and force
   * scope='project' on the result).
   */
  loadRegistry(input: LoadRegistryInput = {}): ResolvedRegistry {
    const home = input.homeDir ?? os.homedir();
    const userPath = path.join(home, MCP_REGISTRY_FILE);
    const projectPath = input.projectPath
      ? path.join(input.projectPath, MCP_REGISTRY_FILE)
      : null;

    const user = this.readRegistryFile(userPath);
    const project = projectPath ? this.readRegistryFile(projectPath) : null;

    const byId = new Map<string, McpRegistryEntry>();
    if (user) {
      for (const entry of user.entries) {
        byId.set(entry.id, { ...entry, scope: 'user' });
      }
    }
    if (project) {
      for (const entry of project.entries) {
        byId.set(entry.id, { ...entry, scope: 'project' });
      }
    }

    const entries = Array.from(byId.values()).sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );

    return {
      entries,
      sources: {
        userPath: user ? userPath : null,
        projectPath: project ? projectPath : null,
      },
    };
  }

  /**
   * Read the project policy file. Returns DEFAULT_MCP_POLICY when the file
   * doesn't exist or fails to parse — the absence of policy means "no
   * opinion", not "forbid everything".
   */
  loadPolicy(projectPath: string): McpPolicyFile {
    const full = path.join(projectPath, MCP_POLICY_FILE);
    try {
      const raw = fs.readFileSync(full, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<McpPolicyFile>;
      return {
        schemaVersion: 1,
        defaultEnabled: Array.isArray(parsed.defaultEnabled) ? [...parsed.defaultEnabled] : [],
        allowed: Array.isArray(parsed.allowed) ? [...parsed.allowed] : [],
        forbidden: Array.isArray(parsed.forbidden) ? [...parsed.forbidden] : [],
      };
    } catch {
      return { ...DEFAULT_MCP_POLICY };
    }
  }

  /**
   * Compute the resolved CLI config given a registry, a policy, and an
   * optional execution override. The output is stable: given identical
   * inputs, it produces identical `enabledServerIds`, `canonicalJson`, and
   * `hash`.
   */
  resolve(input: ResolveInput): ResolvedMcpConfig {
    const { registry, policy } = input;
    const override: McpExecutionOverride = input.override ?? { add: [], remove: [] };

    const registryIds = new Set(registry.entries.map((e) => e.id));
    const forbidden = new Set(policy.forbidden);
    const allowed = new Set(policy.allowed);
    const allowlistActive = allowed.size > 0;

    const baseline = dedupeAndSort(policy.defaultEnabled);
    const addSet = new Set(override.add);
    const removeSet = new Set(override.remove);

    const disallowed: ResolvedMcpConfig['disallowed'] = [];
    const enabled: string[] = [];
    const addedByOverride: string[] = [];

    const candidateIds = new Set<string>([...baseline, ...override.add]);
    for (const id of candidateIds) {
      if (removeSet.has(id)) {
        // Explicit remove wins; do not include. Audit trail below captures this.
        continue;
      }
      if (!registryIds.has(id)) {
        disallowed.push({ id, reason: 'not-registered' });
        continue;
      }
      if (forbidden.has(id)) {
        disallowed.push({ id, reason: 'forbidden' });
        continue;
      }
      if (allowlistActive && !allowed.has(id)) {
        disallowed.push({ id, reason: 'not-allowed' });
        continue;
      }
      enabled.push(id);
      if (addSet.has(id) && !baseline.includes(id)) {
        addedByOverride.push(id);
      }
    }

    enabled.sort();
    addedByOverride.sort();
    disallowed.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    // removedByOverride: anything the caller asked to remove that *would*
    // have been in the candidate set without the override. This captures the
    // "ralph" case (disabling a default-enabled server) as well as "you asked
    // to remove something you also asked to add" no-ops.
    const removedByOverride = override.remove
      .filter((id) => baseline.includes(id) || addSet.has(id))
      .slice()
      .sort();

    const entryById = new Map(registry.entries.map((e) => [e.id, e] as const));
    const mcpServers: CliMcpConfigFile['mcpServers'] = {};
    for (const id of enabled) {
      const entry = entryById.get(id);
      if (!entry) continue; // Shouldn't happen — registryIds gate above.
      const server: CliMcpConfigFile['mcpServers'][string] = {
        command: entry.command,
        args: [...entry.args],
      };
      if (entry.type) server.type = entry.type;
      if (entry.env && Object.keys(entry.env).length > 0) {
        server.env = { ...entry.env };
      }
      mcpServers[id] = server;
    }

    const cliConfig: CliMcpConfigFile = { mcpServers };
    const canonical = canonicalJson(cliConfig);
    const hash = sha256Hex(canonical);

    return {
      enabledServerIds: enabled,
      hash,
      canonicalJson: canonical,
      cliConfig,
      baselineServerIds: baseline,
      addedByOverride,
      removedByOverride,
      disallowed,
    };
  }

  /**
   * Write the resolved CLI config to a file under `<projectRoot>/.claude/`.
   * Returns the written path. File name embeds the short hash so identical
   * resolutions reuse the same file — useful for cache reasoning.
   */
  materialize(
    resolved: ResolvedMcpConfig,
    projectPath: string,
  ): { path: string; bytes: number } {
    const short = resolved.hash.slice(0, 12);
    const target = path.join(projectPath, '.claude', `.mcp-generated-${short}.json`);
    const payload = `${resolved.canonicalJson}\n`;
    writeTextAtomicSync(target, payload);
    return { path: target, bytes: Buffer.byteLength(payload, 'utf-8') };
  }

  private readRegistryFile(filePath: string): McpRegistryFile | null {
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
    return parseRegistryFileContent(raw);
  }
}

function dedupeAndSort(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}

export const mcpResolverService = new McpResolverService();
