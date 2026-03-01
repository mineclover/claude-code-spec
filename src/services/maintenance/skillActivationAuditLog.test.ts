import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FileSkillActivationAuditStore,
  resolveSkillActivationAuditEventLimit,
} from './skillActivationAuditLog';

describe('skillActivationAuditLog', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    tempRoots.length = 0;
  });

  it('stores and returns events in reverse chronological order', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-activation-log-'));
    tempRoots.push(tempRoot);
    const logPath = path.join(tempRoot, 'skill-activation-events.json');
    const store = new FileSkillActivationAuditStore(logPath);

    await store.append({
      provider: 'codex',
      skillId: 'alpha',
      before: { active: false, path: '/tmp/skills-disabled/alpha' },
      after: { active: true, path: '/tmp/skills/alpha' },
      timestamp: 100,
    });
    await store.append({
      provider: 'codex',
      skillId: 'beta',
      before: { active: true, path: '/tmp/skills/beta' },
      after: { active: false, path: '/tmp/skills-disabled/beta' },
      timestamp: 200,
    });

    const events = await store.listRecent(10);
    expect(events.map((event) => event.skillId)).toEqual(['beta', 'alpha']);
  });

  it('normalizes explicit limit with safe fallback bounds', () => {
    expect(resolveSkillActivationAuditEventLimit(0)).toBe(20);
    expect(resolveSkillActivationAuditEventLimit(999)).toBe(200);
    expect(resolveSkillActivationAuditEventLimit(5)).toBe(5);
  });
});
