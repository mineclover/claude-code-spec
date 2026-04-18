import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SessionMeta } from '../types/prefix-fingerprint';

/**
 * SessionMetaStore depends on getClaudeProjectDir(), which resolves through a
 * directory cache keyed on the user's real ~/.claude/projects. For a unit
 * test we intercept that resolver so the sidecar lands in a temp directory.
 */

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sms-'));
const fakeProjectDir = path.join(tmpRoot, 'proj-dash-dir');

// vi.mock is hoisted above all imports; the factory can reference module-scope
// constants via vi.hoisted so the mock survives hoisting.
const { mockedProjectDir } = vi.hoisted(() => ({ mockedProjectDir: { value: '' } }));
mockedProjectDir.value = fakeProjectDir;

vi.mock('./claudeSessions', () => ({
  getClaudeProjectDir: () => mockedProjectDir.value,
}));

import { sessionMetaStore } from './SessionMetaStore';

const sampleMeta = (): SessionMeta => ({
  schemaVersion: 1,
  sessionId: 'cli-session-abc',
  toolId: 'claude',
  projectPath: '/tmp/proj',
  fingerprint: {
    static: {
      kind: 'static',
      total: 'deadbeef'.repeat(8),
      components: {
        claudeMd: 'a', imports: '', skills: '', agents: '', mcpResolved: '', systemPromptVersion: 'v',
      },
      sources: { claudeMdPath: null, importPaths: [], skillIds: [], agentIds: [], mcpConfigPath: null },
      computedAt: 1,
    },
  },
  metrics: {
    inputTokens: 10, outputTokens: 5,
    cacheReadInputTokens: 90, cacheCreationInputTokens: 0,
    ephemeral5mTokens: 0, ephemeral1hTokens: 0,
    cacheHitRatio: 0.9, costUsd: 0.01,
  },
  writtenAt: 2,
});

beforeAll(() => {
  fs.mkdirSync(fakeProjectDir, { recursive: true });
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('SessionMetaStore', () => {
  it('round-trips write then read for a single session', () => {
    const meta = sampleMeta();
    const written = sessionMetaStore.write({
      projectPath: '/tmp/proj',
      cliSessionId: meta.sessionId,
      meta,
    });
    expect(written).not.toBeNull();
    const read = sessionMetaStore.read('/tmp/proj', meta.sessionId);
    expect(read).not.toBeNull();
    expect(read?.sessionId).toBe(meta.sessionId);
    expect(read?.metrics.cacheHitRatio).toBeCloseTo(0.9, 3);
    expect(read?.fingerprint.static.total).toBe(meta.fingerprint.static.total);
  });

  it('returns null for a missing sidecar', () => {
    expect(sessionMetaStore.read('/tmp/proj', 'does-not-exist')).toBeNull();
  });

  it('readAllInProjectDir returns every parseable sidecar keyed by id', () => {
    const m1 = sampleMeta();
    const m2 = { ...sampleMeta(), sessionId: 'cli-session-xyz' };
    sessionMetaStore.write({ projectPath: '/tmp/proj', cliSessionId: m1.sessionId, meta: m1 });
    sessionMetaStore.write({ projectPath: '/tmp/proj', cliSessionId: m2.sessionId, meta: m2 });
    const all = sessionMetaStore.readAllInProjectDir(fakeProjectDir);
    expect(all.get(m1.sessionId)?.sessionId).toBe(m1.sessionId);
    expect(all.get(m2.sessionId)?.sessionId).toBe(m2.sessionId);
  });
});
