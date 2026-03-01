import { describe, expect, it } from 'vitest';
import {
  createCustomMaintenanceAdapters,
  createDefaultMaintenanceAdapters,
} from './serviceIntegrations';

describe('serviceIntegrations capability matrix', () => {
  it('applies safe defaults when capability is omitted', () => {
    const adapters = createCustomMaintenanceAdapters([
      {
        id: 'acme',
        tools: [
          {
            id: 'acme',
            name: 'Acme CLI',
            versionCommand: { command: 'acme', args: ['--version'] },
            updateCommand: { command: 'npm', args: ['install', '-g', 'acme@latest'] },
          },
        ],
        skillStore: {
          provider: 'acme',
          installRoot: '~/.acme/skills',
        },
      },
    ]);

    expect(adapters).toHaveLength(1);
    const [adapter] = adapters;
    expect(adapter.capability.maintenance.enabled).toBe(true);
    expect(adapter.capability.skills.enabled).toBe(true);
    expect(adapter.capability.execution.enabled).toBe(false);
    expect(adapter.capability.mcp.enabled).toBe(false);
    expect(adapter.getManagedTools?.()).toHaveLength(1);
    expect(adapter.getSkillStore?.()).toBeTruthy();
    expect(adapter.getExecution).toBeUndefined();
    expect(adapter.getMcp).toBeUndefined();
  });

  it('respects explicit capability toggles', () => {
    const adapters = createCustomMaintenanceAdapters([
      {
        id: 'skills-only',
        capability: {
          maintenance: { enabled: false },
          skills: { enabled: true },
        },
        tools: [
          {
            id: 'skills-only',
            name: 'Skills Only',
            versionCommand: { command: 'skills-only', args: ['--version'] },
            updateCommand: { command: 'npm', args: ['install', '-g', 'skills-only@latest'] },
          },
        ],
        skillStore: {
          provider: 'skills-only',
          installRoot: '~/.skills-only/skills',
        },
      },
    ]);

    expect(adapters).toHaveLength(1);
    const [adapter] = adapters;
    expect(adapter.capability.maintenance.enabled).toBe(false);
    expect(adapter.capability.skills.enabled).toBe(true);
    expect(adapter.getManagedTools).toBeUndefined();
    expect(adapter.getSkillStore?.()).toBeTruthy();
  });

  it('normalizes execution/mcp contracts using explicit > inferred > safe defaults', () => {
    const adapters = createCustomMaintenanceAdapters([
      {
        id: 'acme',
        capability: {
          maintenance: { enabled: true },
          execution: { enabled: true },
          mcp: { enabled: true },
        },
        tools: [
          {
            id: 'acme-cli',
            name: 'Acme CLI',
            versionCommand: { command: 'acme', args: ['--version'] },
            updateCommand: { command: 'npm', args: ['install', '-g', 'acme@latest'] },
          },
        ],
        mcp: {
          strictByDefault: true,
        },
      },
    ]);

    expect(adapters).toHaveLength(1);
    const [adapter] = adapters;
    expect(adapter.capability.execution.enabled).toBe(true);
    expect(adapter.capability.mcp.enabled).toBe(true);
    expect(adapter.getExecution?.()?.toolId).toBe('acme-cli');
    expect(adapter.getMcp?.()?.defaultTargets).toEqual(['project']);
    expect(adapter.getMcp?.()?.strictByDefault).toBe(true);
  });

  it('declares built-in capability matrix examples', () => {
    const adapters = createDefaultMaintenanceAdapters();
    const matrix = new Map(adapters.map((adapter) => [adapter.id, adapter.capability]));

    expect(matrix.get('claude')?.execution.enabled).toBe(true);
    expect(matrix.get('codex')?.mcp.enabled).toBe(true);
    expect(matrix.get('gemini')?.skills.enabled).toBe(true);
    expect(matrix.get('ralph')?.execution.enabled).toBe(true);
    expect(matrix.get('moai')?.maintenance.enabled).toBe(true);

    const claude = adapters.find((adapter) => adapter.id === 'claude');
    expect(claude?.getExecution?.()?.toolId).toBe('claude');
    expect(claude?.getMcp?.()?.defaultTargets).toEqual(['claude', 'project']);
  });
});
