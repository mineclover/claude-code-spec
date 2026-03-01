import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileToolUpdateAuditStore, resolveToolUpdateLogLimit } from './toolUpdateAuditLog';

describe('toolUpdateAuditLog', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    tempRoots.length = 0;
  });

  it('stores update logs and supports tool filter', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-update-log-'));
    tempRoots.push(tempRoot);
    const logPath = path.join(tempRoot, 'tool-update-events.json');
    const store = new FileToolUpdateAuditStore(logPath);

    await store.append({
      logId: 'log-1',
      batchId: 'batch-1',
      toolId: 'codex',
      success: true,
      command: ['npm', 'install', '-g', '@openai/codex@latest'],
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
      startedAt: 100,
      completedAt: 110,
    });
    await store.append({
      logId: 'log-2',
      batchId: 'batch-1',
      toolId: 'moai',
      success: false,
      command: ['moai', 'update'],
      exitCode: 1,
      stdout: '',
      stderr: 'failed',
      startedAt: 200,
      completedAt: 220,
    });

    const all = await store.listRecent({ limit: 10 });
    expect(all.map((entry) => entry.toolId)).toEqual(['moai', 'codex']);

    const codexOnly = await store.listRecent({ limit: 10, toolId: 'codex' });
    expect(codexOnly).toHaveLength(1);
    expect(codexOnly[0]?.toolId).toBe('codex');
    expect(codexOnly[0]?.batchId).toBe('batch-1');
  });

  it('normalizes explicit limit with safe fallback bounds', () => {
    expect(resolveToolUpdateLogLimit(0)).toBe(20);
    expect(resolveToolUpdateLogLimit(999)).toBe(200);
    expect(resolveToolUpdateLogLimit(5)).toBe(5);
  });
});
