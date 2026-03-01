import { describe, expect, it } from 'vitest';
import {
  validateMaintenanceRegistryPayload,
  validateMaintenanceServicesPayload,
} from './maintenanceRegistryValidation';

describe('validateMaintenanceServicesPayload', () => {
  it('accepts valid maintenance registry payload', () => {
    const payload = [
      {
        id: 'moai',
        name: 'MoAI-ADK',
        enabled: true,
        tools: [
          {
            id: 'moai',
            name: 'MoAI-ADK',
            versionCommand: { command: 'moai', args: ['version'] },
            updateCommand: { command: 'moai', args: ['update', '--binary', '--yes'] },
            docsUrl: 'https://github.com/modu-ai/moai-adk',
          },
        ],
      },
    ];

    const result = validateMaintenanceServicesPayload(payload);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.value).toHaveLength(1);
  });

  it('rejects service without any adapter contracts', () => {
    const payload = [{ id: 'empty-service' }];
    const result = validateMaintenanceServicesPayload(payload);

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((line) =>
        line.includes('At least one of `tools`, `skillStore`, `execution`, or `mcp`'),
      ),
    ).toBe(true);
  });

  it('rejects non-array root payload', () => {
    const result = validateMaintenanceServicesPayload({ id: 'invalid-root' });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('returns nested path for invalid tool docsUrl', () => {
    const payload = [
      {
        id: 'bad-docs',
        tools: [
          {
            id: 'bad-docs',
            name: 'Bad Docs',
            versionCommand: { command: 'bad-docs', args: ['--version'] },
            updateCommand: { command: 'npm', args: ['install', '-g', 'bad-docs@latest'] },
            docsUrl: 'not-a-valid-url',
          },
        ],
      },
    ];

    const result = validateMaintenanceServicesPayload(payload);

    expect(result.valid).toBe(false);
    const docsIssue = result.issues.find((issue) => issue.path.join('.') === '0.tools.0.docsUrl');
    expect(docsIssue).toBeDefined();
    expect(docsIssue?.formatted).toContain('docsUrl');
  });

  it('accepts capability matrix declaration', () => {
    const payload = [
      {
        id: 'claude',
        capability: {
          maintenance: { enabled: true },
          execution: { enabled: true },
          skills: { enabled: true },
          mcp: { enabled: true },
        },
        tools: [
          {
            id: 'claude',
            name: 'Claude Code',
            versionCommand: { command: 'claude', args: ['--version'] },
            updateCommand: {
              command: 'npm',
              args: ['install', '-g', '@anthropic-ai/claude-code@latest'],
            },
          },
        ],
      },
    ];

    const result = validateMaintenanceServicesPayload(payload);

    expect(result.valid).toBe(true);
    expect(result.value?.[0]?.capability?.execution?.enabled).toBe(true);
  });

  it('rejects invalid capability enabled type', () => {
    const payload = [
      {
        id: 'broken-capability',
        capability: {
          maintenance: { enabled: 'yes' },
        },
        tools: [
          {
            id: 'broken-capability',
            name: 'Broken Capability',
            versionCommand: { command: 'broken-capability', args: ['--version'] },
            updateCommand: { command: 'npm', args: ['install', '-g', 'broken-capability@latest'] },
          },
        ],
      },
    ];

    const result = validateMaintenanceServicesPayload(payload);

    expect(result.valid).toBe(false);
    expect(
      result.issues.some((issue) => issue.path.join('.') === '0.capability.maintenance.enabled'),
    ).toBe(true);
  });
});

describe('validateMaintenanceRegistryPayload', () => {
  it('accepts latest versioned registry payload', () => {
    const payload = {
      schemaVersion: 2,
      services: [
        {
          id: 'moai',
          tools: [
            {
              id: 'moai',
              name: 'MoAI-ADK',
              versionCommand: { command: 'moai', args: ['version'] },
              updateCommand: { command: 'moai', args: ['update', '--binary', '--yes'] },
            },
          ],
        },
      ],
    };

    const result = validateMaintenanceRegistryPayload(payload);

    expect(result.valid).toBe(true);
    expect(result.migrated).toBe(false);
    expect(result.value?.schemaVersion).toBe(2);
    expect(result.value?.services).toHaveLength(1);
  });

  it('migrates legacy array root payload to latest versioned document', () => {
    const payload = [
      {
        id: 'legacy',
        tools: [
          {
            id: 'legacy',
            name: 'Legacy CLI',
            versionCommand: { command: 'legacy', args: ['--version'] },
            updateCommand: { command: 'npm', args: ['install', '-g', 'legacy@latest'] },
          },
        ],
      },
    ];

    const result = validateMaintenanceRegistryPayload(payload);

    expect(result.valid).toBe(true);
    expect(result.migrated).toBe(true);
    expect(result.value?.schemaVersion).toBe(2);
    expect(result.value?.services[0]?.id).toBe('legacy');
  });

  it('rejects unsupported future schema version', () => {
    const payload = {
      schemaVersion: 999,
      services: [],
    };

    const result = validateMaintenanceRegistryPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.errors.some((line) => line.includes('Unsupported registry schemaVersion'))).toBe(
      true,
    );
  });
});
