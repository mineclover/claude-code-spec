import type { Diagnostic } from '@codemirror/lint';
import { useMemo } from 'react';
import { createJsonAstPathLocator } from '../lib/jsonAstPathLocator';
import {
  type MaintenanceRegistryValidationResult,
  validateMaintenanceServicesPayload,
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
  validation: MaintenanceRegistryValidationResult | null;
  status: MaintenanceRegistryDraftStatus;
  diagnostics: readonly Diagnostic[];
}

export function parseJsonDraft(raw: string): JsonDraftResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: [] };
  }

  try {
    return { value: JSON.parse(trimmed) as unknown };
  } catch (error) {
    return {
      error: `JSON parse error: ${error instanceof Error ? error.message : 'Unknown parse error'}`,
    };
  }
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

  const validation = validateMaintenanceServicesPayload(parsed.value);
  if (validation.valid) {
    return {
      parsed,
      validation,
      status: {
        valid: true,
        serviceCount: validation.value?.length ?? 0,
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
      serviceCount: Array.isArray(parsed.value) ? parsed.value.length : 0,
      errors: validation.errors,
    },
    diagnostics,
  };
}

export function useMaintenanceRegistryDraft(raw: string): MaintenanceRegistryDraft {
  return useMemo(() => buildMaintenanceRegistryDraft(raw), [raw]);
}
