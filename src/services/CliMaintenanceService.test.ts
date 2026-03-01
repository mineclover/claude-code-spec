import { describe, expect, it, vi } from 'vitest';
import type { CapabilityMatrix } from '../types/capability-matrix';
import type { InstalledSkillInfo, SkillProvider } from '../types/tool-maintenance';
import { CliMaintenanceService } from './CliMaintenanceService';
import type {
  MaintenanceServiceAdapter,
  SkillStoreAdapter,
  ToolAdapter,
} from './maintenance/serviceIntegrations';

function createCapability(flags: {
  maintenance?: boolean;
  execution?: boolean;
  skills?: boolean;
  mcp?: boolean;
}): CapabilityMatrix {
  return {
    maintenance: { enabled: flags.maintenance ?? false },
    execution: { enabled: flags.execution ?? false },
    skills: { enabled: flags.skills ?? false },
    mcp: { enabled: flags.mcp ?? false },
  };
}

function createTool(id: string): ToolAdapter {
  return {
    id,
    name: id,
    description: `${id} CLI`,
    versionCommand: { command: id, args: ['--version'] },
    updateCommand: { command: 'npm', args: ['install', '-g', `${id}@latest`] },
  };
}

function createSkillStore(provider: SkillProvider): SkillStoreAdapter {
  return {
    provider,
    installRoot: `/tmp/${provider}/skills`,
    disabledRoot: `/tmp/${provider}/skills-disabled`,
  };
}

function createAdapter({
  id,
  capability,
  tools,
  skillStore,
}: {
  id: string;
  capability: CapabilityMatrix;
  tools?: ToolAdapter[];
  skillStore?: SkillStoreAdapter;
}): MaintenanceServiceAdapter {
  return {
    id,
    displayName: id,
    capability,
    getManagedTools: tools ? () => tools : undefined,
    getSkillStore: skillStore ? () => skillStore : undefined,
  };
}

function createInstalledSkill({
  id,
  provider,
  active = true,
  name = id,
}: {
  id: string;
  provider: SkillProvider;
  active?: boolean;
  name?: string;
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

describe('CliMaintenanceService', () => {
  it('checks versions from managed tools without regression', async () => {
    const tool = createTool('codex');
    const service = new CliMaintenanceService(() => [
      createAdapter({
        id: 'codex',
        capability: createCapability({ maintenance: true }),
        tools: [tool],
      }),
    ]);

    const executeCommand = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: 'codex 1.2.3',
      stderr: '',
    });
    (service as unknown as { executeCommand: typeof executeCommand }).executeCommand =
      executeCommand;

    const result = await service.checkToolVersions(['codex']);

    expect(executeCommand).toHaveBeenCalledWith(tool.versionCommand);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      toolId: 'codex',
      status: 'ok',
      version: '1.2.3',
      command: ['codex', '--version'],
    });
    expect(result[0]?.checkedAt).toEqual(expect.any(Number));
  });

  it('runs tool updates without regression', async () => {
    const tool = createTool('ralph-tui');
    const service = new CliMaintenanceService(() => [
      createAdapter({
        id: 'ralph',
        capability: createCapability({ maintenance: true }),
        tools: [tool],
      }),
    ]);

    const executeCommand = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: 'updated',
      stderr: '',
    });
    (service as unknown as { executeCommand: typeof executeCommand }).executeCommand =
      executeCommand;

    const result = await service.runToolUpdate('ralph-tui');

    expect(executeCommand).toHaveBeenCalledWith(tool.updateCommand);
    expect(result).toMatchObject({
      toolId: 'ralph-tui',
      success: true,
      command: ['npm', 'install', '-g', 'ralph-tui@latest'],
      exitCode: 0,
      stdout: 'updated',
      stderr: '',
    });
    expect(result.startedAt).toBeLessThanOrEqual(result.completedAt);
  });

  it('lists installed skills with provider/id dedupe and stable sorting', async () => {
    const service = new CliMaintenanceService(() => [
      createAdapter({
        id: 'claude',
        capability: createCapability({ skills: true }),
        skillStore: createSkillStore('claude'),
      }),
      createAdapter({
        id: 'codex',
        capability: createCapability({ skills: true }),
        skillStore: createSkillStore('codex'),
      }),
    ]);

    const readSkillLockMap = vi.fn().mockResolvedValue({});
    const scanSkillSet = vi
      .fn()
      .mockResolvedValueOnce([
        createInstalledSkill({ id: 'alpha', provider: 'claude', active: true }),
        createInstalledSkill({ id: 'alpha', provider: 'claude', active: false }),
        createInstalledSkill({ id: 'beta', provider: 'claude', active: true }),
      ])
      .mockResolvedValueOnce([createInstalledSkill({ id: 'alpha', provider: 'codex' })]);

    (service as unknown as { readSkillLockMap: typeof readSkillLockMap }).readSkillLockMap =
      readSkillLockMap;
    (service as unknown as { scanSkillSet: typeof scanSkillSet }).scanSkillSet = scanSkillSet;

    const result = await service.getInstalledSkills();

    expect(readSkillLockMap).toHaveBeenCalledTimes(1);
    expect(scanSkillSet).toHaveBeenCalledTimes(2);
    expect(result.map((item) => `${item.provider}:${item.id}`)).toEqual([
      'claude:alpha',
      'claude:beta',
      'codex:alpha',
    ]);
    expect(result.find((item) => item.provider === 'claude' && item.id === 'alpha')?.active).toBe(
      true,
    );
  });
});
