type SessionEventRecord = Record<string, unknown>;

const PATH_CANDIDATE_KEYS = [
  'cwd',
  'projectPath',
  'project_path',
  'projectRoot',
  'project_root',
] as const;
const NESTED_RECORD_KEYS = ['metadata', 'session', 'context', 'message'] as const;
const FILE_URI_PREFIX = 'file://';

function isRecord(value: unknown): value is SessionEventRecord {
  return typeof value === 'object' && value !== null;
}

function normalizePathCandidate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith(FILE_URI_PREFIX)) {
    return trimmed;
  }

  const withoutPrefix = trimmed.slice(FILE_URI_PREFIX.length).trim();
  return withoutPrefix || null;
}

/**
 * Extract project path candidate from a raw session event/metadata record.
 */
export function extractSessionPathFromEvent(event: unknown): string | null {
  if (!isRecord(event)) {
    return null;
  }

  const queue: SessionEventRecord[] = [event];
  const seen = new Set<SessionEventRecord>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) {
      continue;
    }
    seen.add(current);

    for (const key of PATH_CANDIDATE_KEYS) {
      const candidate = normalizePathCandidate(current[key]);
      if (candidate) {
        return candidate;
      }
    }

    for (const nestedKey of NESTED_RECORD_KEYS) {
      const nestedValue = current[nestedKey];
      if (isRecord(nestedValue)) {
        queue.push(nestedValue);
      }
    }
  }

  return null;
}

export interface SessionPathResolutionInput {
  explicitPath?: string | null;
  inferredPath?: string | null;
  safeDefaultPath?: string | null;
}

/**
 * Normalize path with priority: explicit > inferred > safe default.
 */
export function resolveSessionPath(input: SessionPathResolutionInput): string | null {
  return (
    normalizePathCandidate(input.explicitPath) ??
    normalizePathCandidate(input.inferredPath) ??
    normalizePathCandidate(input.safeDefaultPath)
  );
}

/**
 * Legacy fallback that infers project path from Claude dash-formatted dir names.
 * Example: -Users-jun-project -> /Users/jun/project
 */
export function inferProjectPathFromDashDirName(projectDirName: string): string | null {
  if (!projectDirName.startsWith('-')) {
    return null;
  }

  const trimmed = projectDirName.slice(1).trim();
  if (!trimmed) {
    return null;
  }

  return `/${trimmed.replace(/-/g, '/')}`;
}
