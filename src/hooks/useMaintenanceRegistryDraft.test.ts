import { describe, expect, it } from 'vitest';
import { buildMaintenanceRegistryDraft } from './useMaintenanceRegistryDraft';

describe('buildMaintenanceRegistryDraft', () => {
  it('returns valid status for empty registry draft', () => {
    const draft = buildMaintenanceRegistryDraft('');
    expect(draft.status.valid).toBe(true);
    expect(draft.status.serviceCount).toBe(0);
    expect(draft.status.errors).toEqual([]);
    expect(draft.diagnostics).toEqual([]);
    expect(draft.validation?.value?.schemaVersion).toBe(2);
  });

  it('returns parse error status for invalid JSON', () => {
    const draft = buildMaintenanceRegistryDraft('{');
    expect(draft.status.valid).toBe(false);
    expect(draft.status.serviceCount).toBe(0);
    expect(draft.status.errors[0]).toMatch(/JSON parse error/i);
    expect(draft.validation).toBeNull();
    expect(draft.diagnostics).toEqual([]);
  });

  it('returns schema diagnostics when payload violates registry schema', () => {
    const draft = buildMaintenanceRegistryDraft('{"schemaVersion":2,"services":[{"id":"broken"}]}');
    expect(draft.status.valid).toBe(false);
    expect(draft.status.serviceCount).toBe(1);
    expect(draft.status.errors.some((error) => error.includes('tools'))).toBe(true);
    expect(draft.diagnostics.length).toBeGreaterThan(0);
  });

  it('migrates legacy array draft to latest versioned document', () => {
    const draft = buildMaintenanceRegistryDraft(
      '[{"id":"acme","tools":[{"id":"acme","name":"Acme","versionCommand":{"command":"acme"},"updateCommand":{"command":"acme","args":["update"]}}]}]',
    );

    expect(draft.status.valid).toBe(true);
    expect(draft.validation?.migrated).toBe(true);
    expect(draft.validation?.value?.schemaVersion).toBe(2);
    expect(draft.validation?.value?.services).toHaveLength(1);
  });
});
