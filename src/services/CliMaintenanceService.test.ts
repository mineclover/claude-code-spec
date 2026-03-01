import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CapabilityMatrix } from '../types/capability-matrix';
import type {
  CliToolUpdateLogEntry,
  InstalledSkillInfo,
  SkillActivationAuditEvent,
  SkillProvider,
} from '../types/tool-maintenance';
import { CliMaintenanceService } from './CliMaintenanceService';
import type {
  MaintenanceServiceAdapter,
  SkillStoreAdapter,
  ToolAdapter,
} from './maintenance/serviceIntegrations';
import { SKILL_FILE_NAME } from './maintenance/skillStoreScanner';

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

function createTool(
  id: string,
  options?: { latestVersionCommand?: ToolAdapter['latestVersionCommand'] },
): ToolAdapter {
  return {
    id,
    name: id,
    description: `${id} CLI`,
    versionCommand: { command: id, args: ['--version'] },
    latestVersionCommand: options?.latestVersionCommand,
    updateCommand: { command: 'npm', args: ['install', '-g', `${id}@latest`] },
  };
}

function createSkillStore(
  provider: SkillProvider,
  roots?: { installRoot: string; disabledRoot: string },
): SkillStoreAdapter {
  return {
    provider,
    installRoot: roots?.installRoot ?? `/tmp/${provider}/skills`,
    disabledRoot: roots?.disabledRoot ?? `/tmp/${provider}/skills-disabled`,
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
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    tempRoots.length = 0;
    vi.restoreAllMocks();
  });

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
      latestVersion: null,
      updateRequired: true,
      updateReason: 'latest-version-unavailable',
      command: ['codex', '--version'],
    });
    expect(result[0]?.checkedAt).toEqual(expect.any(Number));
  });

  it('marks tool as update-required when latest version is newer', async () => {
    const tool = createTool('codex', {
      latestVersionCommand: { command: 'npm', args: ['view', '@openai/codex', 'version'] },
    });
    const service = new CliMaintenanceService(() => [
      createAdapter({
        id: 'codex',
        capability: createCapability({ maintenance: true }),
        tools: [tool],
      }),
    ]);

    const executeCommand = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'codex 1.2.3',
        stderr: '',
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '1.3.0',
        stderr: '',
      });
    (service as unknown as { executeCommand: typeof executeCommand }).executeCommand =
      executeCommand;

    const result = await service.checkToolVersions(['codex']);

    expect(result[0]).toMatchObject({
      toolId: 'codex',
      version: '1.2.3',
      latestVersion: '1.3.0',
      updateRequired: true,
      updateReason: 'outdated',
    });
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

  it('runs selected tool batch updates and exposes update logs', async () => {
    const codexTool = createTool('codex');
    const moaiTool = createTool('moai');
    const storedLogs: CliToolUpdateLogEntry[] = [];
    const updateAuditStore = {
      append: vi.fn(async (entry: CliToolUpdateLogEntry) => {
        storedLogs.unshift(entry);
      }),
      listRecent: vi.fn(async (query?: { limit?: number; toolId?: string }) => {
        const limit = query?.limit ?? 20;
        const toolId = query?.toolId;
        const filtered = toolId
          ? storedLogs.filter((entry) => entry.toolId === toolId)
          : storedLogs;
        return filtered.slice(0, limit);
      }),
    };

    const service = new CliMaintenanceService(
      () => [
        createAdapter({
          id: 'codex',
          capability: createCapability({ maintenance: true }),
          tools: [codexTool],
        }),
        createAdapter({
          id: 'moai',
          capability: createCapability({ maintenance: true }),
          tools: [moaiTool],
        }),
      ],
      { updateAuditStore },
    );

    const executeCommand = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'codex updated',
        stderr: '',
      })
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'moai failed',
      });
    (service as unknown as { executeCommand: typeof executeCommand }).executeCommand =
      executeCommand;

    const summary = await service.runToolUpdates(['codex', 'moai']);

    expect(summary).toMatchObject({
      requestedToolIds: ['codex', 'moai'],
      total: 2,
      succeeded: 1,
      failed: 1,
    });
    expect(summary.batchId).toEqual(expect.any(String));

    const logs = await service.getToolUpdateLogs(10);
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      toolId: 'moai',
      success: false,
      exitCode: 1,
      stderr: 'moai failed',
      batchId: summary.batchId,
    });
    expect(logs[1]).toMatchObject({
      toolId: 'codex',
      success: true,
      exitCode: 0,
      stdout: 'codex updated',
      batchId: summary.batchId,
    });
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

  it('persists activation audit events with before/after state snapshots', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-activation-audit-'));
    tempRoots.push(tempRoot);

    const installRoot = path.join(tempRoot, 'skills');
    const disabledRoot = path.join(tempRoot, 'skills-disabled');
    const disabledSkillPath = path.join(disabledRoot, 'alpha');
    fs.mkdirSync(disabledSkillPath, { recursive: true });
    fs.writeFileSync(path.join(disabledSkillPath, SKILL_FILE_NAME), '# Alpha');

    const storedEvents: SkillActivationAuditEvent[] = [];
    const activationAuditStore = {
      append: vi.fn(async (event: SkillActivationAuditEvent) => {
        storedEvents.unshift(event);
      }),
      listRecent: vi.fn(async (limit = 20) => storedEvents.slice(0, limit)),
    };

    const service = new CliMaintenanceService(
      () => [
        createAdapter({
          id: 'codex',
          capability: createCapability({ skills: true }),
          skillStore: createSkillStore('codex', { installRoot, disabledRoot }),
        }),
      ],
      { activationAuditStore },
    );

    const updated = await service.setSkillActivation('codex', 'alpha', true);
    expect(updated.active).toBe(true);

    expect(activationAuditStore.append).toHaveBeenCalledTimes(1);
    const loggedEvent = storedEvents[0];
    expect(loggedEvent).toMatchObject({
      provider: 'codex',
      skillId: 'alpha',
      before: {
        active: false,
        path: path.join(disabledRoot, 'alpha'),
      },
      after: {
        active: true,
        path: path.join(installRoot, 'alpha'),
      },
    });
    expect(loggedEvent?.timestamp).toEqual(expect.any(Number));

    const recent = await service.getSkillActivationEvents(10);
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({
      provider: 'codex',
      skillId: 'alpha',
      before: { active: false },
      after: { active: true },
    });
  });

  it('rolls back moved skill directory when activation transaction fails', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-activation-rollback-'));
    tempRoots.push(tempRoot);

    const installRoot = path.join(tempRoot, 'skills');
    const disabledRoot = path.join(tempRoot, 'skills-disabled');
    const activeSkillPath = path.join(installRoot, 'alpha');
    const disabledSkillPath = path.join(disabledRoot, 'alpha');
    fs.mkdirSync(activeSkillPath, { recursive: true });
    fs.writeFileSync(path.join(activeSkillPath, SKILL_FILE_NAME), '# Alpha');

    const service = new CliMaintenanceService(() => [
      createAdapter({
        id: 'codex',
        capability: createCapability({ skills: true }),
        skillStore: createSkillStore('codex', { installRoot, disabledRoot }),
      }),
    ]);

    const findInstalledSkill = vi.fn().mockRejectedValue(new Error('refresh failed'));
    (
      service as unknown as {
        findInstalledSkill: typeof findInstalledSkill;
      }
    ).findInstalledSkill = findInstalledSkill;

    await expect(service.setSkillActivation('codex', 'alpha', false)).rejects.toThrow(
      /transaction failed/i,
    );
    expect(fs.existsSync(activeSkillPath)).toBe(true);
    expect(fs.existsSync(disabledSkillPath)).toBe(false);
  });
});
