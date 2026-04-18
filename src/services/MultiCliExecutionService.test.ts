import { EventEmitter } from 'node:events';
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
import type { McpPolicyFile, McpRegistryFile } from '../types/mcp-policy';
import type { SessionMeta } from '../types/prefix-fingerprint';
import type { SystemInitEvent } from '../types/stream-events';

/**
 * Integration test for the mcpOverride path through MultiCliExecutionService.
 *
 * We avoid spawning a real subprocess by mocking `../lib/cliRunner` with a
 * hand-rolled fake that emulates the shape `spawnStreaming` returns (see
 * `execa`'s ResultPromise): a thenable carrying `.stdout`, `.stderr`, `.pid`,
 * and `.kill()`. Tests drive the fake directly - emit stdout chunks to feed
 * the parser, and resolve the underlying promise to trigger completion.
 *
 * `SessionMetaStore.write` is also mocked so we can inspect the sidecar
 * payload without touching the real `~/.claude/projects` tree.
 *
 * The resolver pipeline (`McpResolverService`) runs for real against fixture
 * registry/policy files so we exercise the full code path from override ->
 * resolve -> materialize -> options.mcpConfig -> stamped mcpResolved.
 */

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mce-'));
const projectDir = path.join(tmpRoot, 'proj');

// ---------------------------------------------------------------------------
// Mock wiring
// ---------------------------------------------------------------------------

interface FakeSubprocessShape {
  pid: number;
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
  then: (
    onFulfilled: (value: { exitCode: number | null }) => unknown,
    onRejected?: (reason: Error) => unknown,
  ) => Promise<unknown>;
  /** Test-only helpers. */
  __resolveExit: (exitCode: number | null) => void;
  __rejectExit: (error: Error) => void;
}

function createFakeSubprocess(pid = 12345): FakeSubprocessShape {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  let resolveFn: (value: { exitCode: number | null }) => void = () => {};
  let rejectFn: (reason: Error) => void = () => {};
  const exitPromise = new Promise<{ exitCode: number | null }>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });
  return {
    pid,
    stdout,
    stderr,
    kill: vi.fn(),
    then: (onFulfilled, onRejected) => exitPromise.then(onFulfilled, onRejected),
    __resolveExit: (exitCode) => resolveFn({ exitCode }),
    __rejectExit: (error) => rejectFn(error),
  };
}

const { spawnCalls, spawnStreamingMock, nextSubprocess } = vi.hoisted(() => {
  const calls: Array<{ command: string; args: readonly string[]; options: unknown }> = [];
  const nextSub: { value: FakeSubprocessShape | null } = { value: null };
  const mockFn = (command: string, args: readonly string[], options: unknown) => {
    calls.push({ command, args, options });
    if (!nextSub.value) {
      throw new Error('Test bug: no fake subprocess queued');
    }
    const sub = nextSub.value;
    nextSub.value = null;
    return sub as unknown;
  };
  return { spawnCalls: calls, spawnStreamingMock: mockFn, nextSubprocess: nextSub };
});

vi.mock('../lib/cliRunner', () => ({
  spawnStreaming: spawnStreamingMock,
}));

const { sessionMetaStoreWriteMock, sessionMetaStoreWriteCalls } = vi.hoisted(() => {
  const writeCalls: Array<{ projectPath: string; cliSessionId: string; meta: SessionMeta }> = [];
  const writeMock = (params: { projectPath: string; cliSessionId: string; meta: SessionMeta }) => {
    writeCalls.push(params);
    return `/fake/sidecar/${params.cliSessionId}.meta.json`;
  };
  return { sessionMetaStoreWriteMock: writeMock, sessionMetaStoreWriteCalls: writeCalls };
});

vi.mock('./SessionMetaStore', () => ({
  sessionMetaStore: {
    write: sessionMetaStoreWriteMock,
    read: vi.fn(() => null),
    readFromPath: vi.fn(() => null),
    readAllInProjectDir: vi.fn(() => new Map()),
    resolveSidecarPath: vi.fn(
      (projectPath: string, cliSessionId: string) =>
        `/fake/sidecar/${cliSessionId}.meta.json`,
    ),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { claudeToolDefinition } from '../data/cli-tools/claude';
import { MultiCliExecutionService } from './MultiCliExecutionService';
import { toolRegistry } from './ToolRegistry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flush pending microtasks so the service's .then() handlers run. */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function makeSystemInitLine(sessionId: string): string {
  const event: SystemInitEvent = {
    type: 'system',
    subtype: 'init',
    cwd: projectDir,
    session_id: sessionId,
    tools: ['Read', 'Write'],
    mcp_servers: [{ name: 'serena', status: 'connected' }],
    model: 'claude-sonnet-4-6',
    permissionMode: 'default',
    slash_commands: [],
    apiKeySource: 'env',
    output_style: 'default',
    agents: [],
    uuid: '00000000-0000-0000-0000-000000000000',
  };
  return `${JSON.stringify(event)}\n`;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(() => {
  fs.mkdirSync(path.join(projectDir, '.claude'), { recursive: true });

  // Project-scope registry holds every id the test refers to. Project entries
  // take precedence over user entries in the resolver, so this defends the
  // test against whatever ~/.claude/mcp-registry.json exists on the dev
  // machine: our ids still resolve to the commands declared here.
  const projectRegistry: McpRegistryFile = {
    schemaVersion: 1,
    entries: [
      { id: 'serena', command: 'serena', args: [], scope: 'project' },
      { id: 'context7', command: 'npx', args: ['-y', '@context7/mcp'], scope: 'project' },
    ],
  };
  fs.writeFileSync(
    path.join(projectDir, '.claude', 'mcp-registry.json'),
    JSON.stringify(projectRegistry, null, 2),
  );

  // Project policy enables serena by default; context7 is addable via
  // override. An empty `allowed` array means "no whitelist"; anything in the
  // project registry is permitted unless forbidden. Forbidden is also empty
  // to keep the test independent of user-scope policy.
  const policy: McpPolicyFile = {
    schemaVersion: 1,
    defaultEnabled: ['serena'],
    allowed: [],
    forbidden: [],
  };
  fs.writeFileSync(
    path.join(projectDir, '.claude', 'mcp-policy.json'),
    JSON.stringify(policy, null, 2),
  );

  // Register the claude tool once so SessionInterpreterService can build
  // commands. The registry is process-global; catch duplicate-register errors
  // from parallel tests.
  if (!toolRegistry.has('claude')) {
    toolRegistry.register(claudeToolDefinition);
  }
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

beforeEach(() => {
  spawnCalls.length = 0;
  sessionMetaStoreWriteCalls.length = 0;
  nextSubprocess.value = null;
});

afterEach(() => {
  nextSubprocess.value = null;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MultiCliExecutionService mcpOverride path', () => {
  it('resolves override, materializes config, and stamps mcpResolved', async () => {
    const service = new MultiCliExecutionService();
    const sub = createFakeSubprocess();
    nextSubprocess.value = sub;

    const sessionId = service.execute({
      toolId: 'claude',
      projectPath: projectDir,
      query: '/context',
      options: {},
      mcpOverride: { add: ['context7'], remove: [] },
    });

    expect(spawnCalls).toHaveLength(1);
    const firstCall = spawnCalls[0];
    expect(firstCall.command).toBe('claude');
    // The generated --mcp-config path must appear in the spawned argv, since
    // options.mcpConfig drives the `mcpLaunch` segment.
    const mcpConfigIdx = firstCall.args.indexOf('--mcp-config');
    expect(mcpConfigIdx).toBeGreaterThanOrEqual(0);
    const passedConfigPath = firstCall.args[mcpConfigIdx + 1];
    expect(passedConfigPath).toContain('.mcp-generated-');
    expect(passedConfigPath.startsWith(path.join(projectDir, '.claude'))).toBe(true);

    const execution = service.getExecution(sessionId);
    expect(execution).toBeDefined();
    expect(execution?.mcpResolved).toBeDefined();
    expect(execution?.mcpResolved?.enabledServerIds).toEqual(['context7', 'serena']);
    expect(execution?.mcpResolved?.addedByOverride).toEqual(['context7']);
    expect(execution?.mcpResolved?.baselineServerIds).toEqual(['serena']);
    expect(execution?.mcpResolved?.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(execution?.mcpResolved?.configPath).toBe(passedConfigPath);
    expect(execution?.options.mcpConfig).toBe(passedConfigPath);

    // The generated file must exist on disk with the canonical JSON the
    // resolver produced.
    expect(fs.existsSync(passedConfigPath)).toBe(true);
    const onDisk = JSON.parse(fs.readFileSync(passedConfigPath, 'utf-8'));
    expect(onDisk).toEqual({
      mcpServers: {
        context7: { command: 'npx', args: ['-y', '@context7/mcp'] },
        serena: { command: 'serena', args: [] },
      },
    });

    // Clean up the running process reference.
    sub.__resolveExit(0);
    await flushMicrotasks();
  });

  it('persists sidecar with mcpResolved summary on completion', async () => {
    const service = new MultiCliExecutionService();
    const sub = createFakeSubprocess();
    nextSubprocess.value = sub;

    const sessionId = service.execute({
      toolId: 'claude',
      projectPath: projectDir,
      query: '/context',
      options: {},
      mcpOverride: { add: ['context7'], remove: [] },
    });

    const cliSessionId = '11111111-2222-3333-4444-555555555555';
    // Let the service wire up stdout/stderr listeners before we emit.
    await flushMicrotasks();
    sub.stdout.emit('data', Buffer.from(makeSystemInitLine(cliSessionId)));

    // Sanity: parser consumed the init event and captured cliSessionId.
    const execution = service.getExecution(sessionId);
    expect(execution?.cliSessionId).toBe(cliSessionId);
    expect(execution?.fingerprint?.observed).toBeDefined();

    // Trigger completion.
    sub.__resolveExit(0);
    await flushMicrotasks();

    expect(execution?.status).toBe('completed');
    expect(sessionMetaStoreWriteCalls).toHaveLength(1);
    const writeCall = sessionMetaStoreWriteCalls[0];
    expect(writeCall.cliSessionId).toBe(cliSessionId);
    expect(writeCall.projectPath).toBe(projectDir);
    expect(writeCall.meta.schemaVersion).toBe(1);
    expect(writeCall.meta.sessionId).toBe(cliSessionId);
    expect(writeCall.meta.toolId).toBe('claude');
    expect(writeCall.meta.mcpResolved).toBeDefined();
    expect(writeCall.meta.mcpResolved?.enabledServerIds).toEqual(['context7', 'serena']);
    expect(writeCall.meta.mcpResolved?.baselineServerIds).toEqual(['serena']);
    expect(writeCall.meta.mcpResolved?.overrideAdd).toEqual(['context7']);
    expect(writeCall.meta.mcpResolved?.overrideRemove).toEqual([]);
    expect(writeCall.meta.mcpResolved?.hash).toBe(execution?.mcpResolved?.hash);
    // canonicalJson is the deterministic serialization of the cliConfig; its
    // content must match what the resolver stamped on the execution.
    expect(writeCall.meta.mcpResolved?.canonicalJson).toBe(execution?.mcpResolved?.canonicalJson);
    expect(typeof writeCall.meta.mcpResolved?.canonicalJson).toBe('string');
    expect(JSON.parse(writeCall.meta.mcpResolved!.canonicalJson)).toEqual({
      mcpServers: {
        context7: { command: 'npx', args: ['-y', '@context7/mcp'] },
        serena: { command: 'serena', args: [] },
      },
    });
  });

  it('omits mcpResolved when no override is supplied', async () => {
    const service = new MultiCliExecutionService();
    const sub = createFakeSubprocess();
    nextSubprocess.value = sub;

    const sessionId = service.execute({
      toolId: 'claude',
      projectPath: projectDir,
      query: '/context',
      options: {},
    });

    const execution = service.getExecution(sessionId);
    expect(execution?.mcpResolved).toBeUndefined();

    const cliSessionId = '99999999-0000-0000-0000-000000000000';
    await flushMicrotasks();
    sub.stdout.emit('data', Buffer.from(makeSystemInitLine(cliSessionId)));
    sub.__resolveExit(0);
    await flushMicrotasks();

    expect(sessionMetaStoreWriteCalls).toHaveLength(1);
    expect(sessionMetaStoreWriteCalls[0].meta.mcpResolved).toBeUndefined();
  });
});
