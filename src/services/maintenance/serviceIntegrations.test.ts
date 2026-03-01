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

  it('declares built-in capability matrix examples', () => {
    const adapters = createDefaultMaintenanceAdapters();
    const matrix = new Map(adapters.map((adapter) => [adapter.id, adapter.capability]));

    expect(matrix.get('claude')?.execution.enabled).toBe(true);
    expect(matrix.get('codex')?.mcp.enabled).toBe(true);
    expect(matrix.get('gemini')?.skills.enabled).toBe(true);
    expect(matrix.get('ralph')?.execution.enabled).toBe(true);
    expect(matrix.get('moai')?.maintenance.enabled).toBe(true);
  });
});
