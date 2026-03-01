import { z } from 'zod';
import { MCP_CONFIG_TARGETS } from '../types/maintenance-adapter-sdk';
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
