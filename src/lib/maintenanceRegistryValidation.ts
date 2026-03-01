import { z } from 'zod';
import { MCP_CONFIG_TARGETS } from '../types/maintenance-adapter-sdk';
import {
  MAINTENANCE_REGISTRY_SCHEMA_VERSION,
  type MaintenanceRegistryDocument,
  type MaintenanceRegistryService,
} from '../types/maintenance-registry';
import { migrateMaintenanceRegistryToLatest } from './maintenanceRegistryMigration';

const nonEmptyString = z.string().trim().min(1, 'Must be a non-empty string');

const commandSchema = z.object({
  command: nonEmptyString,
  args: z.array(nonEmptyString).optional(),
});

const toolSchema = z.object({
  id: nonEmptyString,
  name: nonEmptyString,
  description: z.string().optional(),
  versionCommand: commandSchema,
  updateCommand: commandSchema,
  docsUrl: z.string().url('Must be a valid URL').optional(),
});

const skillStoreSchema = z.object({
  provider: nonEmptyString.optional(),
  installRoot: nonEmptyString,
  disabledRoot: nonEmptyString.optional(),
  scanStrategy: nonEmptyString.optional(),
  reference: nonEmptyString.optional(),
});

const executionSchema = z
  .object({
    toolId: nonEmptyString.optional(),
    defaultOptions: z.record(z.unknown()).optional(),
  })
  .strict();

const mcpSchema = z
  .object({
    defaultTargets: z.array(z.enum(MCP_CONFIG_TARGETS)).min(1).optional(),
    strictByDefault: z.boolean().optional(),
  })
  .strict();

const capabilityAreaSchema = z
  .object({
    enabled: z.boolean().optional(),
  })
  .strict();

const capabilitySchema = z
  .object({
    maintenance: capabilityAreaSchema.optional(),
    execution: capabilityAreaSchema.optional(),
    skills: capabilityAreaSchema.optional(),
    mcp: capabilityAreaSchema.optional(),
  })
  .strict();

const serviceSchema = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString.optional(),
    enabled: z.boolean().optional(),
    capability: capabilitySchema.optional(),
    tools: z.array(toolSchema).optional(),
    skillStore: skillStoreSchema.optional(),
    execution: executionSchema.optional(),
    mcp: mcpSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const hasTools = Array.isArray(value.tools) && value.tools.length > 0;
    const hasSkillStore = Boolean(value.skillStore);
    const hasExecution = Boolean(value.execution);
    const hasMcp = Boolean(value.mcp);
    if (!hasTools && !hasSkillStore && !hasExecution && !hasMcp) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one of `tools`, `skillStore`, `execution`, or `mcp` is required',
      });
    }
  });

const maintenanceServicesSchema = z.array(serviceSchema);
const maintenanceRegistrySchema = z
  .object({
    schemaVersion: z.literal(MAINTENANCE_REGISTRY_SCHEMA_VERSION),
    services: maintenanceServicesSchema,
  })
  .strict();

type PathSegment = string | number;

function formatIssuePath(path: PathSegment[]): string {
  if (path.length === 0) return 'root';
  let output = 'root';
  for (const segment of path) {
    if (typeof segment === 'number') {
      output += `[${segment}]`;
      continue;
    }
    output += `.${segment}`;
  }
  return output;
}

function toValidationIssues(
  issues: Array<{ path: PathSegment[]; message: string }>,
): MaintenanceRegistryValidationIssue[] {
  return issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
    formatted: `${formatIssuePath(issue.path)}: ${issue.message}`,
  }));
}

export interface MaintenanceRegistryValidationResult<TValue = MaintenanceRegistryService[]> {
  valid: boolean;
  value?: TValue;
  issues: MaintenanceRegistryValidationIssue[];
  errors: string[];
}

export interface MaintenanceRegistryValidationIssue {
  path: PathSegment[];
  message: string;
  formatted: string;
}

export interface MaintenanceRegistryDocumentValidationResult
  extends MaintenanceRegistryValidationResult<MaintenanceRegistryDocument> {
  migrated: boolean;
  fromVersion?: number;
}

export function validateMaintenanceServicesPayload(
  input: unknown,
): MaintenanceRegistryValidationResult<MaintenanceRegistryService[]> {
  const parsed = maintenanceServicesSchema.safeParse(input);
  if (parsed.success) {
    return {
      valid: true,
      value: parsed.data as MaintenanceRegistryService[],
      issues: [],
      errors: [],
    };
  }

  const issues = toValidationIssues(parsed.error.issues);

  return {
    valid: false,
    issues,
    errors: issues.map((issue) => issue.formatted),
  };
}

export function validateMaintenanceRegistryPayload(
  input: unknown,
): MaintenanceRegistryDocumentValidationResult {
  const migration = migrateMaintenanceRegistryToLatest(input);
  if (!migration.valid || !migration.value) {
    const issues = toValidationIssues(migration.issues);
    return {
      valid: false,
      issues,
      errors: issues.map((issue) => issue.formatted),
      migrated: migration.migrated,
      fromVersion: migration.fromVersion,
    };
  }

  const parsed = maintenanceRegistrySchema.safeParse(migration.value);
  if (parsed.success) {
    return {
      valid: true,
      value: parsed.data as MaintenanceRegistryDocument,
      issues: [],
      errors: [],
      migrated: migration.migrated,
      fromVersion: migration.fromVersion,
    };
  }

  const issues = toValidationIssues(parsed.error.issues);
  return {
    valid: false,
    issues,
    errors: issues.map((issue) => issue.formatted),
    migrated: migration.migrated,
    fromVersion: migration.fromVersion,
  };
}
