import { describe, expect, it } from 'vitest';
import type { MaintenanceRegistryDocument } from '../types/maintenance-registry';
import {
  resolveMaintenanceRegistryFormDocument,
  resolveMaintenanceRegistryFormErrors,
} from './maintenanceRegistryForm';

const EXPLICIT_DOCUMENT: MaintenanceRegistryDocument = {
  schemaVersion: 2,
  services: [
    {
      id: 'explicit-service',
      tools: [
        {
          id: 'explicit-tool',
          name: 'Explicit Tool',
          versionCommand: { command: 'explicit', args: ['--version'] },
          updateCommand: { command: 'npm', args: ['install', '-g', 'explicit@latest'] },
        },
      ],
    },
  ],
};

describe('resolveMaintenanceRegistryFormDocument', () => {
  it('prefers explicit value over inferred value', () => {
    const inferredValue = {
      schemaVersion: 2,
      services: [{ id: 'inferred-service' }],
    };

    const resolved = resolveMaintenanceRegistryFormDocument({
      explicitValue: EXPLICIT_DOCUMENT,
      inferredValue,
    });

    expect(resolved).toBe(EXPLICIT_DOCUMENT);
    expect(resolved.services[0]?.id).toBe('explicit-service');
  });

  it('infers document from object root when explicit value is not available', () => {
    const resolved = resolveMaintenanceRegistryFormDocument({
      inferredValue: {
        schemaVersion: 2,
        services: [{ id: 'object-root' }],
      },
    });

    expect(resolved.schemaVersion).toBe(2);
    expect(resolved.services).toHaveLength(1);
    expect(resolved.services[0]?.id).toBe('object-root');
  });

  it('infers document from legacy array root', () => {
    const resolved = resolveMaintenanceRegistryFormDocument({
      inferredValue: [{ id: 'legacy-array' }],
    });

    expect(resolved.schemaVersion).toBe(2);
    expect(resolved.services).toHaveLength(1);
    expect(resolved.services[0]?.id).toBe('legacy-array');
  });

  it('falls back to empty document when inference fails', () => {
    const resolved = resolveMaintenanceRegistryFormDocument({
      inferredValue: { schemaVersion: 2, services: 'invalid' },
    });

    expect(resolved.schemaVersion).toBe(2);
    expect(resolved.services).toEqual([]);
  });
});

describe('resolveMaintenanceRegistryFormErrors', () => {
  it('maps schema issues to global/service/field buckets', () => {
    const mapped = resolveMaintenanceRegistryFormErrors([
      {
        path: ['schemaVersion'],
        message: 'Invalid schema version',
        formatted: 'root.schemaVersion: Invalid schema version',
      },
      {
        path: ['services', 0],
        message: 'At least one adapter contract is required',
        formatted: 'root.services[0]: At least one adapter contract is required',
      },
      {
        path: ['services', 0, 'id'],
        message: 'Must be a non-empty string',
        formatted: 'root.services[0].id: Must be a non-empty string',
      },
      {
        path: ['services', 0, 'tools', 0, 'versionCommand', 'command'],
        message: 'Must be a non-empty string',
        formatted: 'root.services[0].tools[0].versionCommand.command: Must be a non-empty string',
      },
    ]);

    expect(mapped.global).toEqual(['root.schemaVersion: Invalid schema version']);
    expect(mapped.services[0]?.root).toEqual(['At least one adapter contract is required']);
    expect(mapped.services[0]?.fields.id).toEqual(['Must be a non-empty string']);
    expect(mapped.services[0]?.fields['tools[0].versionCommand.command']).toEqual([
      'Must be a non-empty string',
    ]);
  });
});
