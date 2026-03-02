/**
 * Tool maintenance and skill inventory types
 */

export interface CommandSpec {
  command: string;
  args: string[];
}

export type OsPlatform = 'darwin' | 'win32' | 'linux';

/** CommandSpec with optional per-OS overrides. Falls back to the base spec when no override matches. */
export type PlatformCommandSpec = CommandSpec & {
  platforms?: Partial<Record<OsPlatform, CommandSpec>>;
};

export function resolveCommandForPlatform(
  spec: PlatformCommandSpec,
  platform: string,
): CommandSpec {
  const override = spec.platforms?.[platform as OsPlatform];
  if (override) return override;
  const { platforms: _platforms, ...base } = spec;
  return base;
}

export interface CliToolStatus {
  lastKnownVersion?: string;
  lastCheckedAt?: number;
  customCommands?: {
    versionCommand?: CommandSpec;
    updateCommand?: PlatformCommandSpec;
  };
}

export interface CliStatusDocument {
  schemaVersion: number;
  tools: Record<string, CliToolStatus>;
}

export interface CliToolUpdatePolicy {
  explicitUpdateRequired?: boolean;
}

export interface ManagedCliTool {
  id: string;
  name: string;
  description: string;
  versionCommand: CommandSpec;
  latestVersionCommand?: CommandSpec;
  updateCommand: PlatformCommandSpec;
  updatePolicy?: CliToolUpdatePolicy;
  docsUrl?: string;
}

export type CliVersionStatus = 'ok' | 'missing' | 'error';
export type CliToolUpdateReason =
  | 'explicit-required'
  | 'explicit-not-required'
  | 'missing'
  | 'outdated'
  | 'up-to-date'
  | 'version-check-error'
  | 'invalid-version'
  | 'latest-version-unavailable'
  | 'fallback-required';

export interface CliToolVersionInfo {
  toolId: string;
  status: CliVersionStatus;
  version: string | null;
  latestVersion: string | null;
  updateRequired: boolean;
  updateReason: CliToolUpdateReason;
  command: string[];
  rawOutput: string;
  checkedAt: number;
  error?: string;
}

export interface CliToolUpdateResult {
  toolId: string;
  success: boolean;
  command: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  startedAt: number;
  completedAt: number;
  error?: string;
}

export interface CliToolBatchUpdateSummary {
  batchId: string;
  requestedToolIds: string[];
  startedAt: number;
  completedAt: number;
  total: number;
  succeeded: number;
  failed: number;
  results: CliToolUpdateResult[];
}

export interface CliToolUpdateLogEntry extends CliToolUpdateResult {
  logId: string;
  batchId: string | null;
}

export const KNOWN_SKILL_PROVIDERS = ['claude', 'codex', 'gemini', 'agents'] as const;
export type KnownSkillProvider = (typeof KNOWN_SKILL_PROVIDERS)[number];
export type SkillProvider = KnownSkillProvider | (string & {});

export interface SkillInstallPathInfo {
  provider: SkillProvider;
  installRoot: string;
  disabledRoot: string;
  reference: string;
}

export interface InstalledSkillInfo {
  id: string;
  name: string;
  description: string;
  path: string;
  provider: SkillProvider;
  active: boolean;
  installRoot: string;
  disabledRoot: string;
  activePath: string;
  disabledPath: string;
  versionHint: string | null;
  source: string | null;
  updatedAt: number | null;
}

export interface SkillActivationStateSnapshot {
  active: boolean;
  path: string | null;
}

export interface SkillActivationAuditEvent {
  provider: SkillProvider;
  skillId: string;
  before: SkillActivationStateSnapshot;
  after: SkillActivationStateSnapshot;
  timestamp: number;
}
