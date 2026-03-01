import type { Diagnostic } from '@codemirror/lint';
import { useMemo } from 'react';
import { createJsonAstPathLocator } from '../lib/jsonAstPathLocator';
import { createEmptyMaintenanceRegistry } from '../lib/maintenanceRegistryMigration';
import {
  type MaintenanceRegistryDocumentValidationResult,
  validateMaintenanceRegistryPayload,
} from '../lib/maintenanceRegistryValidation';

export interface JsonDraftResult {
  value?: unknown;
  error?: string;
}

export interface MaintenanceRegistryDraftStatus {
  valid: boolean;
  serviceCount: number;
  errors: string[];
}

export interface MaintenanceRegistryDraft {
  parsed: JsonDraftResult;
  validation: MaintenanceRegistryDocumentValidationResult | null;
  status: MaintenanceRegistryDraftStatus;
  diagnostics: readonly Diagnostic[];
}

export function parseJsonDraft(raw: string): JsonDraftResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: createEmptyMaintenanceRegistry() };
  }

  try {
    return { value: JSON.parse(trimmed) as unknown };
  } catch (error) {
    return {
      error: `JSON parse error: ${error instanceof Error ? error.message : 'Unknown parse error'}`,
    };
  }
}

function inferServiceCount(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { services?: unknown }).services)
  ) {
    return (value as { services: unknown[] }).services.length;
  }
  return 0;
}

export function buildMaintenanceRegistryDraft(raw: string): MaintenanceRegistryDraft {
  const parsed = parseJsonDraft(raw);
  if (parsed.error) {
    return {
      parsed,
      validation: null,
      status: {
        valid: false,
        serviceCount: 0,
        errors: [parsed.error],
      },
      // JSON parse diagnostics are handled by jsonParseLinter in JsonCodeEditor.
      diagnostics: [],
    };
  }

  const validation = validateMaintenanceRegistryPayload(parsed.value);
  if (validation.valid) {
    return {
      parsed,
      validation,
      status: {
        valid: true,
        serviceCount: validation.value?.services.length ?? 0,
        errors: [],
      },
      diagnostics: [],
    };
  }

  const locator = createJsonAstPathLocator(raw);
  const diagnostics: Diagnostic[] = validation.issues.map((issue) => {
    const range = locator.findRange(issue.path);
    return {
      from: range.from,
      to: range.to,
      severity: 'error',
      source: 'registry-schema',
      message: issue.formatted,
    };
  });

  return {
    parsed,
    validation,
    status: {
      valid: false,
      serviceCount: inferServiceCount(parsed.value),
      errors: validation.errors,
    },
    diagnostics,
  };
}

export function useMaintenanceRegistryDraft(raw: string): MaintenanceRegistryDraft {
  return useMemo(() => buildMaintenanceRegistryDraft(raw), [raw]);
}
