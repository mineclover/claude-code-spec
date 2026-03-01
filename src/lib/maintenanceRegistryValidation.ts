import { z } from 'zod';
import type { MaintenanceRegistryService } from '../types/maintenance-registry';

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
  reference: nonEmptyString.optional(),
});

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
  })
  .superRefine((value, ctx) => {
    const hasTools = Array.isArray(value.tools) && value.tools.length > 0;
    const hasSkillStore = Boolean(value.skillStore);
    if (!hasTools && !hasSkillStore) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one of `tools` or `skillStore` is required',
      });
    }
  });

const maintenanceServicesSchema = z.array(serviceSchema);

function formatIssuePath(path: (string | number)[]): string {
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

export interface MaintenanceRegistryValidationResult {
  valid: boolean;
  value?: MaintenanceRegistryService[];
  issues: MaintenanceRegistryValidationIssue[];
  errors: string[];
}

export interface MaintenanceRegistryValidationIssue {
  path: (string | number)[];
  message: string;
  formatted: string;
}

export function validateMaintenanceServicesPayload(
  input: unknown,
): MaintenanceRegistryValidationResult {
  const parsed = maintenanceServicesSchema.safeParse(input);
  if (parsed.success) {
    return {
      valid: true,
      value: parsed.data as MaintenanceRegistryService[],
      issues: [],
      errors: [],
    };
  }

  const issues: MaintenanceRegistryValidationIssue[] = parsed.error.issues.map((issue) => {
    const formatted = `${formatIssuePath(issue.path)}: ${issue.message}`;
    return {
      path: issue.path,
      message: issue.message,
      formatted,
    };
  });

  return {
    valid: false,
    issues,
    errors: issues.map((issue) => issue.formatted),
  };
}
