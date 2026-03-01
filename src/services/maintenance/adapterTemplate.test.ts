import { describe, expect, it } from 'vitest';
import { validateMaintenanceRegistryPayload } from '../../lib/maintenanceRegistryValidation';
import { createNpmMaintenanceAdapterTemplate } from './adapterTemplate';

describe('maintenance adapter onboarding kit examples', () => {
  it('returns npm template with required adapter contracts', () => {
    const adapter = createNpmMaintenanceAdapterTemplate('acme');

    expect(adapter.id).toBe('acme');
    expect(adapter.displayName).toBe('New CLI');
    expect(adapter.capability?.maintenance?.enabled).toBe(true);
    expect(adapter.capability?.execution?.enabled).toBe(true);
    expect(adapter.capability?.mcp?.enabled).toBe(true);
    expect(adapter.tools).toHaveLength(1);
    expect(adapter.tools?.[0]?.versionCommand.command).toBe('acme');
    expect(adapter.execution?.toolId).toBe('acme');
    expect(adapter.mcp?.defaultTargets).toEqual(['project']);
  });

  it('accepts onboarding registry payload built from adapter template', () => {
    const adapter = createNpmMaintenanceAdapterTemplate('acme');
    const result = validateMaintenanceRegistryPayload({
      schemaVersion: 2,
      services: [
        {
          id: adapter.id,
          name: adapter.displayName,
          capability: adapter.capability,
          tools: adapter.tools,
          execution: adapter.execution,
          mcp: adapter.mcp,
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.value?.services[0]?.id).toBe('acme');
  });

  it('rejects onboarding registry payload when all contracts are missing', () => {
    const result = validateMaintenanceRegistryPayload({
      schemaVersion: 2,
      services: [{ id: 'acme' }],
    });

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((line) =>
        line.includes('At least one of `tools`, `skillStore`, `execution`, or `mcp`'),
      ),
    ).toBe(true);
  });
});
