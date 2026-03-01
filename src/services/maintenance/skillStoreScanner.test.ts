import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SkillStoreAdapter } from '../../types/maintenance-adapter-sdk';
import type { InstalledSkillInfo, SkillProvider } from '../../types/tool-maintenance';
import {
  dedupeAndSortInstalledSkills,
  movePathWithExdevFallback,
  resolveSkillStoreScanRoots,
  runSkillStoreMoveTransaction,
  scanSkillEntriesFromRoots,
} from './skillStoreScanner';

function createInstalledSkill({
  id,
  provider,
  name = id,
  active = true,
}: {
  id: string;
  provider: SkillProvider;
  name?: string;
  active?: boolean;
}): InstalledSkillInfo {
  const installRoot = `/tmp/${provider}/skills`;
  const disabledRoot = `/tmp/${provider}/skills-disabled`;
  const activePath = `${installRoot}/${id}`;
  const disabledPath = `${disabledRoot}/${id}`;

  return {
    id,
    name,
    description: `${name} skill`,
    path: active ? activePath : disabledPath,
    provider,
    active,
    installRoot,
    disabledRoot,
    activePath,
    disabledPath,
    versionHint: null,
    source: null,
    updatedAt: null,
  };
}

describe('skillStoreScanner', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    tempRoots.length = 0;
    vi.restoreAllMocks();
  });

  it('resolves scan roots with explicit > inferred > safe defaults', () => {
    const inferredStore: SkillStoreAdapter = {
      provider: 'agents',
      installRoot: '/tmp/agents/skills',
      disabledRoot: '/tmp/agents/skills-disabled',
    };

    const inferred = resolveSkillStoreScanRoots(inferredStore);
    expect(inferred.strategyId).toBe('agents-flat');
    expect(inferred.installRoots).toEqual([path.resolve('/tmp/agents/skills')]);
    expect(inferred.disabledRoots).toEqual([path.resolve('/tmp/agents/skills-disabled')]);

    const explicit = resolveSkillStoreScanRoots({
      ...inferredStore,
      scanStrategy: 'flat',
    });
    expect(explicit.strategyId).toBe('flat');

    const fallback = resolveSkillStoreScanRoots({
      provider: 'custom-provider',
      installRoot: '/tmp/custom/skills',
      disabledRoot: '/tmp/custom/skills-disabled',
      scanStrategy: 'unknown-strategy',
    });
    expect(fallback.strategyId).toBe('flat');
  });

  it('scans skill entries with shared symlink and hidden directory rules', async () => {
    const scanRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-store-scan-'));
    const linkedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-store-linked-'));
    tempRoots.push(scanRoot, linkedRoot);

    fs.mkdirSync(path.join(scanRoot, 'alpha'), { recursive: true });
    fs.writeFileSync(path.join(scanRoot, 'alpha', 'SKILL.md'), '# Alpha');

    fs.mkdirSync(path.join(scanRoot, '.hidden'), { recursive: true });
    fs.writeFileSync(path.join(scanRoot, '.hidden', 'SKILL.md'), '# Hidden');
    fs.writeFileSync(path.join(scanRoot, 'README.md'), '# not a skill');

    const linkedSkillPath = path.join(linkedRoot, 'beta-source');
    fs.mkdirSync(linkedSkillPath, { recursive: true });
    fs.writeFileSync(path.join(linkedSkillPath, 'SKILL.md'), '# Beta');
    fs.symlinkSync(linkedSkillPath, path.join(scanRoot, 'beta'));

    const entries = await scanSkillEntriesFromRoots([scanRoot]);

    expect(Array.from(entries.keys()).sort()).toEqual(['alpha', 'beta']);
    expect(entries.get('beta')).toBe(path.join(scanRoot, 'beta'));
    expect(entries.has('.hidden')).toBe(false);
  });

  it('falls back to copy+remove when move hits EXDEV', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-store-move-'));
    tempRoots.push(root);

    const fromPath = path.join(root, 'from-skill');
    const toPath = path.join(root, 'to-skill');
    fs.mkdirSync(fromPath, { recursive: true });
    fs.writeFileSync(path.join(fromPath, 'SKILL.md'), '# move');

    const exdevError = Object.assign(new Error('cross-device link not permitted'), {
      code: 'EXDEV',
    });
    const rename = vi.fn().mockRejectedValueOnce(exdevError);

    await movePathWithExdevFallback(fromPath, toPath, {
      ...fsPromises,
      rename,
    });

    expect(rename).toHaveBeenCalledWith(fromPath, toPath);
    expect(fs.existsSync(fromPath)).toBe(false);
    expect(fs.existsSync(path.join(toPath, 'SKILL.md'))).toBe(true);
  });

  it('runs move transactions with rollback on apply failure', async () => {
    const rollback = vi.fn().mockResolvedValue(undefined);

    const transaction = await runSkillStoreMoveTransaction({
      apply: async () => {
        throw new Error('apply failed');
      },
      rollback,
    });

    expect(rollback).toHaveBeenCalledTimes(1);
    expect(transaction).toMatchObject({
      ok: false,
      rolledBack: true,
      error: 'apply failed',
    });
  });

  it('keeps skill list dedupe and sorting stable for provider extensions', () => {
    const normalized = dedupeAndSortInstalledSkills([
      createInstalledSkill({ provider: 'codex', id: 'zeta', name: 'Zeta' }),
      createInstalledSkill({ provider: 'claude', id: 'alpha', name: 'Alpha', active: true }),
      createInstalledSkill({ provider: 'claude', id: 'beta', name: 'Beta' }),
      createInstalledSkill({ provider: 'claude', id: 'alpha', name: 'Alpha', active: false }),
    ]);

    expect(normalized.map((item) => `${item.provider}:${item.id}`)).toEqual([
      'claude:alpha',
      'claude:beta',
      'codex:zeta',
    ]);
    expect(normalized[0]?.active).toBe(true);
  });
});
