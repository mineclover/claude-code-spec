import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { main, parseArgs } from './index';

/**
 * Smoke-tests for the Node CLI surface.
 *
 * We drive the CLI programmatically via `main(argv)` instead of spawning a
 * child process — that way the tests also verify the CLI does not
 * transitively import Electron (if it did, Vitest would blow up at module
 * evaluation, well before any argv handling).
 */

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-'));
const claudeDir = path.join(tmpRoot, 'claude');
const sessionId = 'cli-test-session-0001';
const sessionFile = path.join(claudeDir, `${sessionId}.jsonl`);

// Hermetic fixture for MCP commands: a project dir with a registry file and
// a policy file, plus an isolated $HOME whose .claude/ is empty so the
// resolver doesn't pick up the developer's real user-scope registry.
const mcpProject = path.join(tmpRoot, 'mcp-project');
const mcpHome = path.join(tmpRoot, 'mcp-home');

beforeAll(() => {
  fs.mkdirSync(claudeDir, { recursive: true });
  const lines = [
    JSON.stringify({
      type: 'user',
      message: { role: 'user', content: 'hi' },
      cwd: '/tmp/proj',
    }),
    JSON.stringify({
      type: 'attachment',
      attachment: { type: 'deferred_tools_delta', addedNames: ['Read', 'Edit'] },
      cwd: '/tmp/proj',
    }),
    JSON.stringify({
      type: 'assistant',
      message: {
        id: 'm1',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-6',
        content: [{ type: 'text', text: 'hello' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          cache_read_input_tokens: 400,
          output_tokens: 20,
          service_tier: 'standard',
        },
      },
      cwd: '/tmp/proj',
    }),
  ];
  fs.writeFileSync(sessionFile, `${lines.join('\n')}\n`);

  // MCP fixture: project .claude/ with a 2-entry registry and a 1-baseline policy.
  const mcpProjectClaude = path.join(mcpProject, '.claude');
  fs.mkdirSync(mcpProjectClaude, { recursive: true });
  fs.writeFileSync(
    path.join(mcpProjectClaude, 'mcp-registry.json'),
    JSON.stringify({
      schemaVersion: 1,
      entries: [
        {
          id: 'serena',
          name: 'Serena',
          command: 'node',
          args: ['serena.js'],
          category: 'analysis',
          scope: 'project',
        },
        {
          id: 'context7',
          name: 'Context7',
          command: 'node',
          args: ['context7.js'],
          category: 'development',
          scope: 'project',
        },
      ],
    }),
  );
  fs.writeFileSync(
    path.join(mcpProjectClaude, 'mcp-policy.json'),
    JSON.stringify({
      schemaVersion: 1,
      defaultEnabled: ['serena'],
      allowed: [],
      forbidden: [],
    }),
  );

  // Empty home so user-scope registry doesn't leak into the test.
  fs.mkdirSync(path.join(mcpHome, '.claude'), { recursive: true });
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function captureStdout(fn: () => number): { exitCode: number; out: string; err: string } {
  const outChunks: string[] = [];
  const errChunks: string[] = [];
  const outSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      outChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    });
  const errSpy = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      errChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    });
  try {
    const exitCode = fn();
    return { exitCode, out: outChunks.join(''), err: errChunks.join('') };
  } finally {
    outSpy.mockRestore();
    errSpy.mockRestore();
  }
}

describe('CLI', () => {
  it('parseArgs handles flags, positionals, and bare booleans', () => {
    const parsed = parseArgs(['analyze', '--claude-dir', '/x', '--json', 'extra']);
    expect(parsed.command).toBe('analyze');
    expect(parsed.flags['claude-dir']).toBe('/x');
    expect(parsed.flags.json).toBe(true);
    expect(parsed.positional).toEqual(['extra']);
  });

  it('help prints usage and exits 0', () => {
    const { exitCode, out } = captureStdout(() => main(['help']));
    expect(exitCode).toBe(0);
    expect(out).toMatch(/Usage:/);
    expect(out).toMatch(/analyze/);
  });

  it('unknown command exits 2 and prints help', () => {
    const { exitCode, err, out } = captureStdout(() => main(['wat']));
    expect(exitCode).toBe(2);
    expect(err).toMatch(/Unknown command/);
    expect(out).toMatch(/Usage:/);
  });

  it('session --file produces derived meta', () => {
    const { exitCode, out } = captureStdout(() => main(['session', '--file', sessionFile]));
    expect(exitCode).toBe(0);
    expect(out).toContain(sessionId);
    expect(out).toContain('sonnet-4-6');
    expect(out).toContain('Read');
    expect(out).toContain('Edit');
  });

  it('analyze --claude-dir scans jsonl files and reports one group', () => {
    const { exitCode, out } = captureStdout(() =>
      main(['analyze', '--claude-dir', claudeDir]),
    );
    expect(exitCode).toBe(0);
    expect(out).toMatch(/Sessions: 1 · Groups: 1/);
    expect(out).toContain('derived');
  });

  it('groups --json emits a JSON array', () => {
    const { exitCode, out } = captureStdout(() =>
      main(['groups', '--claude-dir', claudeDir, '--json']),
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(out);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].count).toBe(1);
    expect(parsed[0].model).toBe('claude-sonnet-4-6');
  });

  it('mcp-resolve without --project exits 2', () => {
    const { exitCode, err } = captureStdout(() => main(['mcp-resolve']));
    expect(exitCode).toBe(2);
    expect(err).toMatch(/--project/);
  });

  it('mcp-resolve reports the baseline server as enabled', () => {
    const { exitCode, out } = captureStdout(() =>
      main(['mcp-resolve', '--project', mcpProject, '--home', mcpHome]),
    );
    expect(exitCode).toBe(0);
    expect(out).toContain('Enabled (1): [serena]');
    expect(out).toContain('Baseline (1): [serena]');
    expect(out).toContain('Added by override: []');
    expect(out).toContain('Removed by override: []');
    // 64-hex hash line.
    expect(out).toMatch(/Hash: [0-9a-f]{64}/);
  });

  it('mcp-resolve --add promotes a non-baseline id into "Added by override"', () => {
    const { exitCode, out } = captureStdout(() =>
      main([
        'mcp-resolve',
        '--project',
        mcpProject,
        '--home',
        mcpHome,
        '--add',
        'context7',
      ]),
    );
    expect(exitCode).toBe(0);
    expect(out).toContain('Added by override: [context7]');
    // Both should be enabled, sorted alphabetically.
    expect(out).toContain('Enabled (2): [context7, serena]');
  });

  it('mcp-resolve --json emits ResolvedMcpConfig shape', () => {
    const { exitCode, out } = captureStdout(() =>
      main(['mcp-resolve', '--project', mcpProject, '--home', mcpHome, '--json']),
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed).toHaveProperty('enabledServerIds');
    expect(parsed).toHaveProperty('hash');
    expect(parsed).toHaveProperty('baselineServerIds');
    expect(parsed.enabledServerIds).toEqual(['serena']);
    expect(typeof parsed.hash).toBe('string');
    expect(parsed.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('mcp-registry --json emits a ResolvedRegistry with entries', () => {
    const { exitCode, out } = captureStdout(() =>
      main(['mcp-registry', '--project', mcpProject, '--home', mcpHome, '--json']),
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed).toHaveProperty('entries');
    expect(Array.isArray(parsed.entries)).toBe(true);
    expect(parsed.entries.length).toBe(2);
    const ids = parsed.entries.map((e: { id: string }) => e.id).sort();
    expect(ids).toEqual(['context7', 'serena']);
  });
});
