import {
  MAINTENANCE_REGISTRY_SCHEMA_VERSION,
  type MaintenanceRegistryDocument,
  type MaintenanceRegistryService,
} from '../types/maintenance-registry';
import { createEmptyMaintenanceRegistry } from './maintenanceRegistryMigration';
import type { MaintenanceRegistryValidationIssue } from './maintenanceRegistryValidation';
import { isPlainObject } from './typeGuards';

interface ResolveMaintenanceRegistryFormDocumentOptions {
  explicitValue?: MaintenanceRegistryDocument;
  inferredValue?: unknown;
  fallbackValue?: MaintenanceRegistryDocument;
}

export interface MaintenanceRegistryServiceFormErrors {
  root: string[];
  fields: Record<string, string[]>;
}

export interface MaintenanceRegistryFormErrors {
  global: string[];
  services: Record<number, MaintenanceRegistryServiceFormErrors>;
}

function coerceServiceCandidate(value: unknown): MaintenanceRegistryService {
  if (isPlainObject(value)) {
    return value as unknown as MaintenanceRegistryService;
  }
  return {} as MaintenanceRegistryService;
}

function inferServices(value: unknown): MaintenanceRegistryService[] | null {
  if (Array.isArray(value)) {
    return value.map((item) => coerceServiceCandidate(item));
  }

  if (!isPlainObject(value) || !Array.isArray(value.services)) {
    return null;
  }

  return value.services.map((item) => coerceServiceCandidate(item));
}

function inferMaintenanceRegistryFormDocument(value: unknown): MaintenanceRegistryDocument | null {
  const services = inferServices(value);
  if (!services) {
    return null;
  }

  return {
    schemaVersion: MAINTENANCE_REGISTRY_SCHEMA_VERSION,
    services,
  };
}

function formatFormFieldPath(path: Array<string | number>): string {
  let output = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      output += `[${segment}]`;
      continue;
    }
    output += output ? `.${segment}` : segment;
  }
  return output || 'root';
}

function pushUnique(target: string[], message: string): void {
  if (!target.includes(message)) {
    target.push(message);
  }
}

function getOrCreateServiceErrors(
  state: MaintenanceRegistryFormErrors,
  index: number,
): MaintenanceRegistryServiceFormErrors {
  if (!state.services[index]) {
    state.services[index] = {
      root: [],
      fields: {},
    };
  }
  return state.services[index];
}

export function resolveMaintenanceRegistryFormDocument({
  explicitValue,
  inferredValue,
  fallbackValue,
}: ResolveMaintenanceRegistryFormDocumentOptions): MaintenanceRegistryDocument {
  if (explicitValue) {
    return explicitValue;
  }

  const inferredDocument = inferMaintenanceRegistryFormDocument(inferredValue);
  if (inferredDocument) {
    return inferredDocument;
  }

  return fallbackValue ?? createEmptyMaintenanceRegistry();
}

export function resolveMaintenanceRegistryFormErrors(
  issues: MaintenanceRegistryValidationIssue[],
): MaintenanceRegistryFormErrors {
  const state: MaintenanceRegistryFormErrors = {
    global: [],
    services: {},
  };

  for (const issue of issues) {
    if (issue.path[0] !== 'services' || typeof issue.path[1] !== 'number') {
      pushUnique(state.global, issue.formatted);
      continue;
    }

    const serviceIndex = issue.path[1];
    const serviceErrors = getOrCreateServiceErrors(state, serviceIndex);
    const servicePath = issue.path.slice(2);
    if (servicePath.length === 0) {
      pushUnique(serviceErrors.root, issue.message);
      continue;
    }

    const fieldPath = formatFormFieldPath(servicePath);
    if (!serviceErrors.fields[fieldPath]) {
      serviceErrors.fields[fieldPath] = [];
    }
    pushUnique(serviceErrors.fields[fieldPath], issue.message);
  }

  return state;
}
