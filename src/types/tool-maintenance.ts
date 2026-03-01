/**
 * Tool maintenance and skill inventory types
 */

export interface CommandSpec {
  command: string;
  args: string[];
}

export interface ManagedCliTool {
  id: string;
  name: string;
  description: string;
  versionCommand: CommandSpec;
  updateCommand: CommandSpec;
  docsUrl?: string;
}

export type CliVersionStatus = 'ok' | 'missing' | 'error';

export interface CliToolVersionInfo {
  toolId: string;
  status: CliVersionStatus;
  version: string | null;
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
