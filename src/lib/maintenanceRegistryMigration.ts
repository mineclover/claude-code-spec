import {
  MAINTENANCE_REGISTRY_SCHEMA_VERSION,
  type MaintenanceRegistryDocument,
} from '../types/maintenance-registry';
import { isRecord } from './typeGuards';

const LEGACY_REGISTRY_SCHEMA_VERSION = 1;

type PathSegment = string | number;

interface VersionedRegistryLike {
  schemaVersion?: unknown;
  services?: unknown;
}

interface ResolvedRegistryRoot {
  schemaVersion: number;
  services: unknown;
}

interface VersionedRegistryDocument {
  schemaVersion: number;
  services: unknown;
}

type RegistryMigrationStep = (input: VersionedRegistryDocument) => VersionedRegistryDocument;

const REGISTRY_MIGRATION_PIPELINE: Record<number, RegistryMigrationStep> = {
  [LEGACY_REGISTRY_SCHEMA_VERSION]: (input) => ({
    schemaVersion: MAINTENANCE_REGISTRY_SCHEMA_VERSION,
    services: input.services,
  }),
};

export interface MaintenanceRegistryMigrationIssue {
  path: PathSegment[];
  message: string;
}

export interface MaintenanceRegistryMigrationResult {
  valid: boolean;
  value?: MaintenanceRegistryDocument;
  issues: MaintenanceRegistryMigrationIssue[];
  errors: string[];
  migrated: boolean;
  fromVersion?: number;
}

export interface MaintenanceRegistryMigrationTransactionResult {
  ok: boolean;
  value?: MaintenanceRegistryDocument;
  migrated: boolean;
  rolledBack: boolean;
  error?: string;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createDefaultRegistryDocument(): MaintenanceRegistryDocument {
  return {
    schemaVersion: MAINTENANCE_REGISTRY_SCHEMA_VERSION,
    services: [],
  };
}

function resolveRegistryRoot(input: unknown): ResolvedRegistryRoot | null {
  if (isRecord(input)) {
    const source = input as VersionedRegistryLike;
    if (typeof source.schemaVersion === 'number' && Number.isInteger(source.schemaVersion)) {
      return {
        schemaVersion: source.schemaVersion,
        services: source.services,
      };
    }

    if (source.schemaVersion === undefined && Array.isArray(source.services)) {
      return {
        schemaVersion: LEGACY_REGISTRY_SCHEMA_VERSION,
        services: source.services,
      };
    }
  }

  if (Array.isArray(input)) {
    return {
      schemaVersion: LEGACY_REGISTRY_SCHEMA_VERSION,
      services: input,
    };
  }

  if (input === undefined || input === null) {
    return {
      schemaVersion: MAINTENANCE_REGISTRY_SCHEMA_VERSION,
      services: [],
    };
  }

  return null;
}

function invalidMigrationResult(
  path: PathSegment[],
  message: string,
  fromVersion?: number,
): MaintenanceRegistryMigrationResult {
  const issue: MaintenanceRegistryMigrationIssue = { path, message };
  return {
    valid: false,
    issues: [issue],
    errors: [message],
    migrated: false,
    fromVersion,
  };
}

export function createEmptyMaintenanceRegistry(): MaintenanceRegistryDocument {
  return createDefaultRegistryDocument();
}

export function migrateMaintenanceRegistryToLatest(
  input: unknown,
): MaintenanceRegistryMigrationResult {
  const resolved = resolveRegistryRoot(input);
  if (!resolved) {
    return invalidMigrationResult([], 'Registry root must be a versioned object or a legacy array');
  }

  const fromVersion = resolved.schemaVersion;
  if (fromVersion > MAINTENANCE_REGISTRY_SCHEMA_VERSION) {
    return invalidMigrationResult(
      ['schemaVersion'],
      `Unsupported registry schemaVersion: ${fromVersion}. Latest supported version is ${MAINTENANCE_REGISTRY_SCHEMA_VERSION}.`,
      fromVersion,
    );
  }

  if (fromVersion <= 0) {
    return invalidMigrationResult(
      ['schemaVersion'],
      `Invalid registry schemaVersion: ${fromVersion}`,
      fromVersion,
    );
  }

  let migrated = false;
  let cursor: VersionedRegistryDocument = {
    schemaVersion: fromVersion,
    services: resolved.services,
  };

  while (cursor.schemaVersion < MAINTENANCE_REGISTRY_SCHEMA_VERSION) {
    const migrationStep = REGISTRY_MIGRATION_PIPELINE[cursor.schemaVersion];
    if (!migrationStep) {
      return invalidMigrationResult(
        ['schemaVersion'],
        `Missing migration step for registry schemaVersion ${cursor.schemaVersion}`,
        fromVersion,
      );
    }

    try {
      cursor = migrationStep(cursor);
      migrated = true;
    } catch (error) {
      return invalidMigrationResult(
        ['schemaVersion'],
        `Registry migration failed at version ${cursor.schemaVersion}: ${toErrorMessage(error)}`,
        fromVersion,
      );
    }
  }

  if (!Array.isArray(cursor.services)) {
    return invalidMigrationResult(
      ['services'],
      'Registry services must be an array after migration',
      fromVersion,
    );
  }

  const nextDocument: MaintenanceRegistryDocument = {
    schemaVersion: MAINTENANCE_REGISTRY_SCHEMA_VERSION,
    services: [...cursor.services],
  };

  return {
    valid: true,
    value: nextDocument,
    issues: [],
    errors: [],
    migrated,
    fromVersion,
  };
}

export function runMaintenanceRegistryMigrationTransaction({
  input,
  apply,
  rollback,
}: {
  input: unknown;
  apply: (registry: MaintenanceRegistryDocument) => void;
  rollback: () => void;
}): MaintenanceRegistryMigrationTransactionResult {
  const migration = migrateMaintenanceRegistryToLatest(input);
  if (!migration.valid || !migration.value) {
    return {
      ok: false,
      migrated: migration.migrated,
      rolledBack: false,
      error: migration.errors.join('\n'),
    };
  }

  try {
    apply(migration.value);
    return {
      ok: true,
      value: migration.value,
      migrated: migration.migrated,
      rolledBack: false,
    };
  } catch (error) {
    rollback();
    return {
      ok: false,
      migrated: migration.migrated,
      rolledBack: true,
      error: toErrorMessage(error),
    };
  }
}
