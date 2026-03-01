import { describe, expect, it, vi } from 'vitest';
import {
  createEmptyMaintenanceRegistry,
  migrateMaintenanceRegistryToLatest,
  runMaintenanceRegistryMigrationTransaction,
} from './maintenanceRegistryMigration';

describe('migrateMaintenanceRegistryToLatest', () => {
  it('migrates legacy array root to latest versioned registry document', () => {
    const legacyPayload = [
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
      },
    ];

    const result = migrateMaintenanceRegistryToLatest(legacyPayload);

    expect(result.valid).toBe(true);
    expect(result.migrated).toBe(true);
    expect(result.value?.schemaVersion).toBe(2);
    expect(result.value?.services).toHaveLength(1);
  });

  it('returns safe default document for empty input', () => {
    const result = migrateMaintenanceRegistryToLatest(undefined);

    expect(result.valid).toBe(true);
    expect(result.migrated).toBe(false);
    expect(result.value).toEqual(createEmptyMaintenanceRegistry());
  });
});

describe('runMaintenanceRegistryMigrationTransaction', () => {
  it('rolls back when apply phase throws', () => {
    const rollback = vi.fn();

    const result = runMaintenanceRegistryMigrationTransaction({
      input: [],
      apply: () => {
        throw new Error('persist failed');
      },
      rollback,
    });

    expect(result.ok).toBe(false);
    expect(result.rolledBack).toBe(true);
    expect(result.error).toContain('persist failed');
    expect(rollback).toHaveBeenCalledTimes(1);
  });

  it('returns error without rollback when migration itself fails', () => {
    const rollback = vi.fn();

    const result = runMaintenanceRegistryMigrationTransaction({
      input: { schemaVersion: 999, services: [] },
      apply: () => {
        throw new Error('should not run');
      },
      rollback,
    });

    expect(result.ok).toBe(false);
    expect(result.rolledBack).toBe(false);
    expect(result.error).toContain('Unsupported registry schemaVersion');
    expect(rollback).not.toHaveBeenCalled();
  });
});
