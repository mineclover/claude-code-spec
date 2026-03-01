export const SKILL_VERSION_HINT_FALLBACK = 'unknown';

interface SkillVersionResolverLockEntry {
  source?: string;
  skillFolderHash?: string;
}

export interface SkillVersionResolverInput {
  frontmatter: Record<string, unknown>;
  metadata: Record<string, unknown>;
  lock?: SkillVersionResolverLockEntry;
}

export interface ResolvedSkillVersionInfo {
  versionHint: string;
  source: string | null;
}

const SOURCE_VERSION_KEYS = ['version', 'ver', 'ref', 'tag'] as const;
const SEMVER_PATTERN = /\bv?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\b/;

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function extractVersionFromSource(source: string): string | null {
  const normalized = source.trim();
  if (!normalized) {
    return null;
  }

  const directSemver = normalized.match(SEMVER_PATTERN)?.[0];
  if (directSemver) {
    return directSemver;
  }

  const hashRef = normalized.match(/#([^#/?\s]+)$/)?.[1] ?? null;
  if (hashRef) {
    return hashRef;
  }

  const atRef = normalized.match(/@([^@/#?\s]+)$/)?.[1] ?? null;
  if (atRef) {
    return atRef;
  }

  try {
    const url = new URL(normalized);
    for (const key of SOURCE_VERSION_KEYS) {
      const value = readString(url.searchParams.get(key));
      if (value) {
        return value;
      }
    }
  } catch {}

  return null;
}

function resolveSourceForDisplay(input: SkillVersionResolverInput): string | null {
  const { frontmatter, metadata, lock } = input;
  return (
    readString(lock?.source) ??
    readString(frontmatter.source) ??
    readString(metadata.source) ??
    null
  );
}

function resolveSourceCandidates(input: SkillVersionResolverInput): string[] {
  const { frontmatter, metadata, lock } = input;
  const candidates = [
    readString(frontmatter.source),
    readString(metadata.source),
    readString(lock?.source),
  ].filter((item): item is string => Boolean(item));
  return Array.from(new Set(candidates));
}

function resolveVersionHintCandidate(
  input: SkillVersionResolverInput,
  sourceCandidates: readonly string[],
): string | null {
  const { frontmatter, metadata, lock } = input;
  const fromSource = sourceCandidates
    .map((candidate) => extractVersionFromSource(candidate))
    .find((value): value is string => Boolean(value));
  return (
    readString(frontmatter.version) ??
    readString(metadata.version) ??
    readString(lock?.skillFolderHash) ??
    fromSource ??
    null
  );
}

export function formatSkillVersionHint(versionHint: string | null | undefined): string {
  return readString(versionHint) ?? SKILL_VERSION_HINT_FALLBACK;
}

export function resolveSkillVersionInfo(
  input: SkillVersionResolverInput,
): ResolvedSkillVersionInfo {
  const source = resolveSourceForDisplay(input);
  const sourceCandidates = resolveSourceCandidates(input);
  const resolved =
    resolveVersionHintCandidate(input, sourceCandidates) ??
    // Progressive normalization: frontmatter > metadata > lockfile > source > safe fallback
    SKILL_VERSION_HINT_FALLBACK;

  return {
    versionHint: resolved,
    source,
  };
}
