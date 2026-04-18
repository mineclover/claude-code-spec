/**
 * Tests for src/ipc/handlers/mcpHandlers.ts
 *
 * Covers:
 *   - Pure sanitize functions (__internal) with no I/O
 *   - Handler-level CRUD behaviors using a FakeRouter that captures
 *     (action, handler) pairs and a tmp home directory to isolate
 *     filesystem writes.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type {
  McpPolicyFile,
  McpPreset,
  McpPresetsFile,
  McpRegistryEntry,
  McpRegistryFile,
  ResolvedRegistry,
} from '../../types/mcp-policy';
import type { IPCRouter } from '../IPCRouter';
import { __internal, registerMcpHandlers } from './mcpHandlers';

const { sanitizeRegistryEntry, sanitizePolicy, sanitizePreset, sanitizePresets } = __internal;

/**
 * Minimal IPCRouter stand-in. Captures every (action, handler) registration
 * and lets tests invoke handlers directly without touching Electron's
 * ipcMain. The shape of `handle` mirrors IPCRouter enough for registration
 * to succeed; the chained `this` return keeps the fluent API happy.
 */
class FakeRouter {
  handlers = new Map<string, (...args: unknown[]) => unknown>();

  handle(action: string, handler: (...args: unknown[]) => unknown): this {
    this.handlers.set(action, handler);
    return this;
  }

  invoke<T = unknown>(action: string, ...args: unknown[]): Promise<T> {
    const h = this.handlers.get(action);
    if (!h) throw new Error(`No handler for ${action}`);
    // First arg is the IPC event mock; handlers ignore it.
    return Promise.resolve(h({}, ...args) as T);
  }
}

function asRouter(fake: FakeRouter): IPCRouter {
  // The concrete IPCRouter has more methods, but registerMcpHandlers only
  // calls .handle() — the cast is safe for the purposes of this test.
  return fake as unknown as IPCRouter;
}

// -----------------------------------------------------------------------
// Pure sanitize functions
// -----------------------------------------------------------------------

describe('sanitizeRegistryEntry', () => {
  it('rejects non-object inputs', () => {
    expect(sanitizeRegistryEntry(null, 'user')).toBeNull();
    expect(sanitizeRegistryEntry(undefined, 'user')).toBeNull();
    expect(sanitizeRegistryEntry('string', 'user')).toBeNull();
    expect(sanitizeRegistryEntry(42, 'user')).toBeNull();
  });

  it('rejects missing or empty id', () => {
    expect(sanitizeRegistryEntry({ command: 'x' }, 'user')).toBeNull();
    expect(sanitizeRegistryEntry({ id: '', command: 'x' }, 'user')).toBeNull();
    expect(sanitizeRegistryEntry({ id: 123, command: 'x' }, 'user')).toBeNull();
  });

  it('rejects missing or empty command', () => {
    expect(sanitizeRegistryEntry({ id: 'serena' }, 'user')).toBeNull();
    expect(sanitizeRegistryEntry({ id: 'serena', command: '' }, 'user')).toBeNull();
    expect(sanitizeRegistryEntry({ id: 'serena', command: 42 }, 'user')).toBeNull();
  });

  it.each(['stdio', 'http', 'sse'] as const)('accepts type=%s', (type) => {
    const e = sanitizeRegistryEntry({ id: 'x', command: 'c', type }, 'user');
    expect(e?.type).toBe(type);
  });

  it('drops invalid type values (no coercion, leaves type undefined)', () => {
    const e = sanitizeRegistryEntry({ id: 'x', command: 'c', type: 'grpc' }, 'user');
    expect(e?.type).toBeUndefined();
  });

  it('coerces args to string[], filtering non-strings', () => {
    const e = sanitizeRegistryEntry(
      { id: 'x', command: 'c', args: ['--flag', 42, null, 'ok', { nested: true }] },
      'user',
    );
    expect(e?.args).toEqual(['--flag', 'ok']);
  });

  it('returns [] for args when not an array', () => {
    const e = sanitizeRegistryEntry({ id: 'x', command: 'c', args: 'not-array' }, 'user');
    expect(e?.args).toEqual([]);
  });

  it('coerces env to Record<string,string>, filtering non-string values', () => {
    const e = sanitizeRegistryEntry(
      { id: 'x', command: 'c', env: { A: 'a', B: 42, C: null, D: 'd' } },
      'user',
    );
    expect(e?.env).toEqual({ A: 'a', D: 'd' });
  });

  it('leaves env undefined when absent or not an object', () => {
    expect(sanitizeRegistryEntry({ id: 'x', command: 'c' }, 'user')?.env).toBeUndefined();
    expect(
      sanitizeRegistryEntry({ id: 'x', command: 'c', env: 'bad' }, 'user')?.env,
    ).toBeUndefined();
  });

  it('preserves scope from the second argument, overriding any input scope', () => {
    const e = sanitizeRegistryEntry(
      { id: 'x', command: 'c', scope: 'user' },
      'project',
    );
    expect(e?.scope).toBe('project');

    const e2 = sanitizeRegistryEntry({ id: 'x', command: 'c', scope: 'project' }, 'user');
    expect(e2?.scope).toBe('user');
  });

  it('passes through optional string fields', () => {
    const e = sanitizeRegistryEntry(
      {
        id: 'x',
        command: 'c',
        name: 'X Server',
        category: 'analysis',
        description: 'desc',
      },
      'user',
    );
    expect(e).toMatchObject({
      id: 'x',
      name: 'X Server',
      category: 'analysis',
      description: 'desc',
    });
  });

  it('drops non-string optional fields', () => {
    const e = sanitizeRegistryEntry(
      { id: 'x', command: 'c', name: 42, category: {}, description: [] },
      'user',
    );
    expect(e?.name).toBeUndefined();
    expect(e?.category).toBeUndefined();
    expect(e?.description).toBeUndefined();
  });
});

describe('sanitizePolicy', () => {
  it('returns all empty arrays for missing input', () => {
    expect(sanitizePolicy(undefined)).toEqual<McpPolicyFile>({
      schemaVersion: 1,
      defaultEnabled: [],
      allowed: [],
      forbidden: [],
    });
    expect(sanitizePolicy(null)).toEqual<McpPolicyFile>({
      schemaVersion: 1,
      defaultEnabled: [],
      allowed: [],
      forbidden: [],
    });
  });

  it('replaces non-array lists with []', () => {
    const p = sanitizePolicy({ defaultEnabled: 'nope', allowed: 42, forbidden: null });
    expect(p.defaultEnabled).toEqual([]);
    expect(p.allowed).toEqual([]);
    expect(p.forbidden).toEqual([]);
  });

  it('keeps only string items from each list', () => {
    const p = sanitizePolicy({
      defaultEnabled: ['a', 1, 'b', null],
      allowed: ['x', {}, 'y'],
      forbidden: [true, 'z'],
    });
    expect(p.defaultEnabled).toEqual(['a', 'b']);
    expect(p.allowed).toEqual(['x', 'y']);
    expect(p.forbidden).toEqual(['z']);
  });

  it('always sets schemaVersion to 1', () => {
    const p = sanitizePolicy({ schemaVersion: 99 } as unknown as McpPolicyFile);
    expect(p.schemaVersion).toBe(1);
  });
});

describe('sanitizePreset', () => {
  it('rejects non-object inputs', () => {
    expect(sanitizePreset(null)).toBeNull();
    expect(sanitizePreset('foo')).toBeNull();
    expect(sanitizePreset(42)).toBeNull();
  });

  it('rejects missing or empty id/name', () => {
    expect(sanitizePreset({ name: 'n' })).toBeNull();
    expect(sanitizePreset({ id: '', name: 'n' })).toBeNull();
    expect(sanitizePreset({ id: 'i' })).toBeNull();
    expect(sanitizePreset({ id: 'i', name: '' })).toBeNull();
  });

  it('coerces override.add/remove to string[]', () => {
    const p = sanitizePreset({
      id: 'i',
      name: 'n',
      override: { add: ['a', 1, null, 'b'], remove: ['x', {}, 'y'] },
    });
    expect(p?.override.add).toEqual(['a', 'b']);
    expect(p?.override.remove).toEqual(['x', 'y']);
  });

  it('defaults override to empty lists when missing or invalid', () => {
    const p = sanitizePreset({ id: 'i', name: 'n' });
    expect(p?.override).toEqual({ add: [], remove: [] });

    const p2 = sanitizePreset({ id: 'i', name: 'n', override: 'bad' });
    expect(p2?.override).toEqual({ add: [], remove: [] });
  });

  it('defaults createdAt to Date.now() when missing, uses provided number otherwise', () => {
    const now = 1_700_000_000_000;
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      const p = sanitizePreset({ id: 'i', name: 'n' });
      expect(p?.createdAt).toBe(now);

      const p2 = sanitizePreset({ id: 'i', name: 'n', createdAt: 42 });
      expect(p2?.createdAt).toBe(42);

      const p3 = sanitizePreset({ id: 'i', name: 'n', createdAt: 'bad' });
      expect(p3?.createdAt).toBe(now);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('sanitizePresets', () => {
  it('filters invalid entries out of an array', () => {
    const input: unknown[] = [
      { id: 'a', name: 'A' },
      null,
      { id: '', name: 'empty' },
      { id: 'b', name: 'B' },
      'not-an-object',
      { id: 'c' }, // missing name
    ];
    const out = sanitizePresets(input);
    expect(out.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('returns [] for an empty array', () => {
    expect(sanitizePresets([])).toEqual([]);
  });
});

// -----------------------------------------------------------------------
// Handler CRUD (with tmp home directory)
// -----------------------------------------------------------------------

describe('registerMcpHandlers — registry CRUD', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-handlers-'));
  const fakeHome = path.join(tmpRoot, 'home');
  const projectDir = path.join(tmpRoot, 'proj');

  // The handler and the resolver both call os.homedir() at request time; they
  // do not accept a homeDir parameter. The most reliable way to redirect
  // that lookup from a test is to override the HOME (and USERPROFILE on
  // Windows) env vars that Node's os.homedir() consults.
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;

  beforeAll(() => {
    fs.mkdirSync(fakeHome, { recursive: true });
    fs.mkdirSync(projectDir, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Fresh state each test — wipe user & project .claude dirs.
    fs.rmSync(path.join(fakeHome, '.claude'), { recursive: true, force: true });
    fs.rmSync(path.join(projectDir, '.claude'), { recursive: true, force: true });
    process.env.HOME = fakeHome;
    process.env.USERPROFILE = fakeHome;
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalUserProfile;
  });

  it('save-registry-entry then get-registry returns the entry (user scope)', async () => {
    const router = new FakeRouter();
    registerMcpHandlers(asRouter(router));

    const entry: McpRegistryEntry = {
      id: 'serena',
      command: 'serena',
      args: ['--foo'],
      scope: 'user',
    };
    const saveResult = await router.invoke<{ success: boolean; error?: string }>(
      'save-registry-entry',
      'user',
      entry,
      null,
    );
    expect(saveResult).toEqual({ success: true });

    // The file should exist where we expect.
    const userFile = path.join(fakeHome, '.claude', 'mcp-registry.json');
    expect(fs.existsSync(userFile)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(userFile, 'utf-8')) as McpRegistryFile;
    expect(raw.schemaVersion).toBe(1);
    expect(raw.entries.map((e) => e.id)).toEqual(['serena']);

    const resolved = await router.invoke<ResolvedRegistry>('get-registry', null);
    expect(resolved.entries.map((e) => e.id)).toEqual(['serena']);
    const serena = resolved.entries.find((e) => e.id === 'serena');
    expect(serena?.command).toBe('serena');
    expect(serena?.scope).toBe('user');
  });

  it('save-registry-entry (project scope) writes to <project>/.claude and merges into get-registry', async () => {
    const router = new FakeRouter();
    registerMcpHandlers(asRouter(router));

    // Seed a user-scope entry first.
    await router.invoke('save-registry-entry', 'user', {
      id: 'context7',
      command: 'npx',
      args: ['-y', '@context7/mcp'],
      scope: 'user',
    }, null);

    // Then a project-scope entry.
    await router.invoke(
      'save-registry-entry',
      'project',
      { id: 'serena', command: '/custom/serena', args: [], scope: 'project' },
      projectDir,
    );

    const projectFile = path.join(projectDir, '.claude', 'mcp-registry.json');
    expect(fs.existsSync(projectFile)).toBe(true);

    const resolved = await router.invoke<ResolvedRegistry>('get-registry', projectDir);
    const ids = resolved.entries.map((e) => e.id).sort();
    expect(ids).toEqual(['context7', 'serena']);
    const serena = resolved.entries.find((e) => e.id === 'serena');
    expect(serena?.scope).toBe('project');
    expect(serena?.command).toBe('/custom/serena');
  });

  it('save-registry-entry returns error for invalid entry', async () => {
    const router = new FakeRouter();
    registerMcpHandlers(asRouter(router));

    const result = await router.invoke<{ success: boolean; error?: string }>(
      'save-registry-entry',
      'user',
      { id: '', command: '' } as unknown as McpRegistryEntry,
      null,
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/id and command are required/);
  });

  it('save-registry-entry for project scope without projectPath returns error', async () => {
    const router = new FakeRouter();
    registerMcpHandlers(asRouter(router));

    const result = await router.invoke<{ success: boolean; error?: string }>(
      'save-registry-entry',
      'project',
      { id: 'a', command: 'c', args: [], scope: 'project' } as McpRegistryEntry,
      null,
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/project registry requires a projectPath/);
  });

  it('save-registry-entry replaces an entry with the same id', async () => {
    const router = new FakeRouter();
    registerMcpHandlers(asRouter(router));

    await router.invoke('save-registry-entry', 'user', {
      id: 'serena',
      command: 'old',
      args: [],
      scope: 'user',
    }, null);

    await router.invoke('save-registry-entry', 'user', {
      id: 'serena',
      command: 'new',
      args: ['--v2'],
      scope: 'user',
    }, null);

    const resolved = await router.invoke<ResolvedRegistry>('get-registry', null);
    const serena = resolved.entries.find((e) => e.id === 'serena');
    expect(serena?.command).toBe('new');
    expect(serena?.args).toEqual(['--v2']);
    // Exactly one entry — no dupes.
    expect(resolved.entries.filter((e) => e.id === 'serena')).toHaveLength(1);
  });

  it('delete-registry-entry of an unknown id returns success (no-op)', async () => {
    const router = new FakeRouter();
    registerMcpHandlers(asRouter(router));

    const result = await router.invoke<{ success: boolean; error?: string }>(
      'delete-registry-entry',
      'user',
      'nonexistent',
      null,
    );
    expect(result).toEqual({ success: true });
  });

  it('delete-registry-entry removes an existing entry', async () => {
    const router = new FakeRouter();
    registerMcpHandlers(asRouter(router));

    await router.invoke('save-registry-entry', 'user', {
      id: 'serena',
      command: 'serena',
      args: [],
      scope: 'user',
    }, null);
    await router.invoke('save-registry-entry', 'user', {
      id: 'context7',
      command: 'c7',
      args: [],
      scope: 'user',
    }, null);

    const del = await router.invoke<{ success: boolean }>(
      'delete-registry-entry',
      'user',
      'serena',
      null,
    );
    expect(del.success).toBe(true);

    const resolved = await router.invoke<ResolvedRegistry>('get-registry', null);
    expect(resolved.entries.map((e) => e.id)).toEqual(['context7']);
  });

  it('delete-registry-entry with empty id returns error', async () => {
    const router = new FakeRouter();
    registerMcpHandlers(asRouter(router));

    const result = await router.invoke<{ success: boolean; error?: string }>(
      'delete-registry-entry',
      'user',
      '',
      null,
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/id required/);
  });
});

describe('registerMcpHandlers — policy CRUD', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-policy-'));
  const projectDir = path.join(tmpRoot, 'proj');

  beforeAll(() => {
    fs.mkdirSync(projectDir, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  beforeEach(() => {
    fs.rmSync(path.join(projectDir, '.claude'), { recursive: true, force: true });
  });

  it('save-policy then get-policy round-trips', async () => {
    const router = new FakeRouter();
    registerMcpHandlers(asRouter(router));

    const policy: McpPolicyFile = {
      schemaVersion: 1,
      defaultEnabled: ['serena', 'sequential-thinking'],
      allowed: ['serena', 'context7', 'sequential-thinking'],
      forbidden: ['evil'],
    };

    const saveResult = await router.invoke<{ success: boolean; error?: string }>(
      'save-policy',
      projectDir,
      policy,
    );
    expect(saveResult).toEqual({ success: true });

    const readBack = await router.invoke<McpPolicyFile>('get-policy', projectDir);
    expect(readBack).toEqual(policy);
  });

  it('save-policy sanitizes malformed input before writing', async () => {
    const router = new FakeRouter();
    registerMcpHandlers(asRouter(router));

    // Cast through unknown because we're intentionally feeding malformed data.
    const malformed = {
      schemaVersion: 99,
      defaultEnabled: ['a', 1, null, 'b'],
      allowed: 'not-array',
      forbidden: [true, 'ok'],
    } as unknown as McpPolicyFile;

    await router.invoke('save-policy', projectDir, malformed);
    const readBack = await router.invoke<McpPolicyFile>('get-policy', projectDir);
    expect(readBack.schemaVersion).toBe(1);
    expect(readBack.defaultEnabled).toEqual(['a', 'b']);
    expect(readBack.allowed).toEqual([]);
    expect(readBack.forbidden).toEqual(['ok']);
  });

  it('get-policy returns empty defaults when no policy file exists', async () => {
    const router = new FakeRouter();
    registerMcpHandlers(asRouter(router));

    const policy = await router.invoke<McpPolicyFile>('get-policy', projectDir);
    expect(policy.defaultEnabled).toEqual([]);
    expect(policy.allowed).toEqual([]);
    expect(policy.forbidden).toEqual([]);
  });
});

describe('registerMcpHandlers — presets CRUD', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-presets-'));
  const projectDir = path.join(tmpRoot, 'proj');

  beforeAll(() => {
    fs.mkdirSync(projectDir, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  beforeEach(() => {
    fs.rmSync(path.join(projectDir, '.claude'), { recursive: true, force: true });
  });

  it('list-presets returns empty file when absent', async () => {
    const router = new FakeRouter();
    registerMcpHandlers(asRouter(router));

    const result = await router.invoke<McpPresetsFile>('list-presets', projectDir);
    expect(result).toEqual({ schemaVersion: 1, presets: [] });
  });

  it('save-preset then list-presets returns the preset (sorted by name)', async () => {
    const router = new FakeRouter();
    registerMcpHandlers(asRouter(router));

    const presetB: McpPreset = {
      id: 'b',
      name: 'Bravo',
      override: { add: ['context7'], remove: [] },
      createdAt: 1,
    };
    const presetA: McpPreset = {
      id: 'a',
      name: 'Alpha',
      override: { add: [], remove: ['sequential-thinking'] },
      createdAt: 2,
    };

    expect(await router.invoke('save-preset', projectDir, presetB)).toEqual({ success: true });
    expect(await router.invoke('save-preset', projectDir, presetA)).toEqual({ success: true });

    const result = await router.invoke<McpPresetsFile>('list-presets', projectDir);
    expect(result.presets.map((p) => p.name)).toEqual(['Alpha', 'Bravo']);
  });

  it('save-preset rejects invalid preset', async () => {
    const router = new FakeRouter();
    registerMcpHandlers(asRouter(router));

    const result = await router.invoke<{ success: boolean; error?: string }>(
      'save-preset',
      projectDir,
      { id: '', name: '' } as unknown as McpPreset,
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/id and name are required/);
  });

  it('delete-preset removes an existing preset; deleting unknown id is a no-op success', async () => {
    const router = new FakeRouter();
    registerMcpHandlers(asRouter(router));

    await router.invoke('save-preset', projectDir, {
      id: 'a',
      name: 'Alpha',
      override: { add: [], remove: [] },
      createdAt: 1,
    });

    const del = await router.invoke<{ success: boolean }>('delete-preset', projectDir, 'a');
    expect(del.success).toBe(true);

    const list = await router.invoke<McpPresetsFile>('list-presets', projectDir);
    expect(list.presets).toEqual([]);

    const delUnknown = await router.invoke<{ success: boolean }>(
      'delete-preset',
      projectDir,
      'nope',
    );
    expect(delUnknown.success).toBe(true);
  });

  it('delete-preset with empty id returns error', async () => {
    const router = new FakeRouter();
    registerMcpHandlers(asRouter(router));

    const result = await router.invoke<{ success: boolean; error?: string }>(
      'delete-preset',
      projectDir,
      '',
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/id required/);
  });
});
