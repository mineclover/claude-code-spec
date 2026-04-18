import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  McpPolicyFile,
  McpRegistryEntry,
  McpRegistryFile,
  ResolvedRegistry,
} from '../types/mcp-policy';
import { McpResolverService } from './McpResolverService';

/**
 * Fixtures: a fake home + project with both registries and a policy. We
 * sometimes construct ResolvedRegistry manually to isolate `resolve` from
 * file I/O.
 */

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-'));
const fakeHome = path.join(tmpRoot, 'home');
const projectDir = path.join(tmpRoot, 'proj');

beforeAll(() => {
  fs.mkdirSync(path.join(fakeHome, '.claude'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, '.claude'), { recursive: true });

  const userRegistry: McpRegistryFile = {
    schemaVersion: 1,
    entries: [
      {
        id: 'serena',
        command: 'serena',
        args: [],
        category: 'analysis',
        scope: 'user',
      },
      {
        id: 'context7',
        command: 'npx',
        args: ['-y', '@context7/mcp'],
        category: 'development',
        scope: 'user',
      },
      {
        id: 'sequential-thinking',
        command: 'sequential-thinking',
        args: [],
        category: 'analysis',
        scope: 'user',
      },
    ],
  };
  fs.writeFileSync(
    path.join(fakeHome, '.claude', 'mcp-registry.json'),
    JSON.stringify(userRegistry, null, 2),
  );

  // Project registry overrides serena with a project-specific command.
  const projectRegistry: McpRegistryFile = {
    schemaVersion: 1,
    entries: [
      {
        id: 'serena',
        command: '/custom/serena-bin',
        args: ['--project'],
        category: 'analysis',
        scope: 'project',
      },
    ],
  };
  fs.writeFileSync(
    path.join(projectDir, '.claude', 'mcp-registry.json'),
    JSON.stringify(projectRegistry, null, 2),
  );

  const policy: McpPolicyFile = {
    schemaVersion: 1,
    defaultEnabled: ['serena', 'sequential-thinking'],
    allowed: [],
    forbidden: [],
  };
  fs.writeFileSync(
    path.join(projectDir, '.claude', 'mcp-policy.json'),
    JSON.stringify(policy, null, 2),
  );
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function makeRegistry(entries: McpRegistryEntry[]): ResolvedRegistry {
  return {
    entries: entries
      .slice()
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    sources: { userPath: null, projectPath: null },
  };
}

const svc = new McpResolverService();

describe('McpResolverService.loadRegistry', () => {
  it('merges user + project with project precedence', () => {
    const registry = svc.loadRegistry({ projectPath: projectDir, homeDir: fakeHome });
    expect(registry.entries.map((e) => e.id)).toEqual([
      'context7',
      'sequential-thinking',
      'serena',
    ]);
    const serena = registry.entries.find((e) => e.id === 'serena');
    expect(serena?.command).toBe('/custom/serena-bin');
    expect(serena?.scope).toBe('project');
    expect(registry.sources.userPath).toContain('mcp-registry.json');
    expect(registry.sources.projectPath).toContain('mcp-registry.json');
  });

  it('returns empty registry when no files exist', () => {
    const empty = path.join(tmpRoot, 'empty-home');
    fs.mkdirSync(empty, { recursive: true });
    const registry = svc.loadRegistry({ homeDir: empty });
    expect(registry.entries).toEqual([]);
    expect(registry.sources.userPath).toBeNull();
  });
});

describe('McpResolverService.loadPolicy', () => {
  it('reads the project policy file', () => {
    const policy = svc.loadPolicy(projectDir);
    expect(policy.defaultEnabled).toEqual(['serena', 'sequential-thinking']);
  });

  it('falls back to empty defaults when absent', () => {
    const empty = path.join(tmpRoot, 'empty-proj');
    fs.mkdirSync(empty, { recursive: true });
    const policy = svc.loadPolicy(empty);
    expect(policy.defaultEnabled).toEqual([]);
    expect(policy.allowed).toEqual([]);
    expect(policy.forbidden).toEqual([]);
  });
});

describe('McpResolverService.resolve', () => {
  const registry = makeRegistry([
    { id: 'serena', command: 'serena', args: [], scope: 'user' },
    { id: 'context7', command: 'c7', args: [], scope: 'user' },
    { id: 'sequential-thinking', command: 'st', args: [], scope: 'user' },
  ]);

  it('honors defaultEnabled when no override provided', () => {
    const resolved = svc.resolve({
      registry,
      policy: {
        schemaVersion: 1,
        defaultEnabled: ['serena'],
        allowed: [],
        forbidden: [],
      },
    });
    expect(resolved.enabledServerIds).toEqual(['serena']);
    expect(resolved.addedByOverride).toEqual([]);
    expect(resolved.removedByOverride).toEqual([]);
    expect(resolved.disallowed).toEqual([]);
    expect(resolved.cliConfig.mcpServers.serena).toEqual({ command: 'serena', args: [] });
    expect(resolved.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('applies override.add and reports it in the audit trail', () => {
    const resolved = svc.resolve({
      registry,
      policy: {
        schemaVersion: 1,
        defaultEnabled: ['serena'],
        allowed: [],
        forbidden: [],
      },
      override: { add: ['context7'], remove: [] },
    });
    expect(resolved.enabledServerIds).toEqual(['context7', 'serena']);
    expect(resolved.addedByOverride).toEqual(['context7']);
  });

  it('applies override.remove (the ralph case)', () => {
    const resolved = svc.resolve({
      registry,
      policy: {
        schemaVersion: 1,
        defaultEnabled: ['serena', 'sequential-thinking'],
        allowed: [],
        forbidden: [],
      },
      override: { add: [], remove: ['sequential-thinking'] },
    });
    expect(resolved.enabledServerIds).toEqual(['serena']);
    expect(resolved.removedByOverride).toEqual(['sequential-thinking']);
  });

  it('rejects ids not in the registry', () => {
    const resolved = svc.resolve({
      registry,
      policy: {
        schemaVersion: 1,
        defaultEnabled: ['serena'],
        allowed: [],
        forbidden: [],
      },
      override: { add: ['ghost'], remove: [] },
    });
    expect(resolved.enabledServerIds).toEqual(['serena']);
    expect(resolved.disallowed).toEqual([{ id: 'ghost', reason: 'not-registered' }]);
  });

  it('rejects ids in forbidden even when requested', () => {
    const resolved = svc.resolve({
      registry,
      policy: {
        schemaVersion: 1,
        defaultEnabled: [],
        allowed: [],
        forbidden: ['context7'],
      },
      override: { add: ['context7'], remove: [] },
    });
    expect(resolved.enabledServerIds).toEqual([]);
    expect(resolved.disallowed).toEqual([{ id: 'context7', reason: 'forbidden' }]);
  });

  it('enforces the allowed whitelist when non-empty', () => {
    const resolved = svc.resolve({
      registry,
      policy: {
        schemaVersion: 1,
        defaultEnabled: ['serena', 'context7'],
        allowed: ['serena'],
        forbidden: [],
      },
    });
    expect(resolved.enabledServerIds).toEqual(['serena']);
    expect(resolved.disallowed).toEqual([{ id: 'context7', reason: 'not-allowed' }]);
  });

  it('produces stable canonicalJson and hash regardless of override order', () => {
    const a = svc.resolve({
      registry,
      policy: {
        schemaVersion: 1,
        defaultEnabled: ['serena'],
        allowed: [],
        forbidden: [],
      },
      override: { add: ['context7', 'sequential-thinking'], remove: [] },
    });
    const b = svc.resolve({
      registry,
      policy: {
        schemaVersion: 1,
        defaultEnabled: ['serena'],
        allowed: [],
        forbidden: [],
      },
      override: { add: ['sequential-thinking', 'context7'], remove: [] },
    });
    expect(a.hash).toBe(b.hash);
    expect(a.canonicalJson).toBe(b.canonicalJson);
    expect(a.enabledServerIds).toEqual(b.enabledServerIds);
  });

  it('override.remove trumps override.add for the same id', () => {
    const resolved = svc.resolve({
      registry,
      policy: {
        schemaVersion: 1,
        defaultEnabled: [],
        allowed: [],
        forbidden: [],
      },
      override: { add: ['serena'], remove: ['serena'] },
    });
    expect(resolved.enabledServerIds).toEqual([]);
    expect(resolved.removedByOverride).toEqual(['serena']);
  });
});

describe('McpResolverService.materialize', () => {
  it('writes resolved config to .claude/.mcp-generated-<hash>.json', () => {
    const outDir = path.join(tmpRoot, 'mat-proj');
    fs.mkdirSync(outDir, { recursive: true });
    const registry = makeRegistry([
      { id: 'serena', command: 'serena', args: [], scope: 'user' },
    ]);
    const resolved = svc.resolve({
      registry,
      policy: {
        schemaVersion: 1,
        defaultEnabled: ['serena'],
        allowed: [],
        forbidden: [],
      },
    });
    const { path: written, bytes } = svc.materialize(resolved, outDir);
    expect(written).toContain('.mcp-generated-');
    expect(bytes).toBeGreaterThan(0);
    const content = fs.readFileSync(written, 'utf-8');
    expect(JSON.parse(content)).toEqual({ mcpServers: { serena: { command: 'serena', args: [] } } });
  });
});
