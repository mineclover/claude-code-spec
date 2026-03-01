/**
 * CLI maintenance service
 * - Version checks and updates for managed CLIs
 * - Local installed skill inventory with version hints
 */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import matter from 'gray-matter';
import { dedupeByLast } from '../lib/collectionUtils';
import { resolveSkillVersionInfo } from '../lib/skillVersionResolver';
import type {
  CliToolBatchUpdateSummary,
  CliToolUpdateLogEntry,
  CliToolUpdateReason,
  CliToolUpdateResult,
  CliToolVersionInfo,
  CommandSpec,
  InstalledSkillInfo,
  ManagedCliTool,
  SkillActivationAuditEvent,
  SkillInstallPathInfo,
  SkillProvider,
} from '../types/tool-maintenance';
import {
  createMaintenanceAdapters,
  type MaintenanceServiceAdapter,
  type SkillStoreAdapter,
  toSkillInstallPathInfo,
} from './maintenance/serviceIntegrations';
import {
  NOOP_SKILL_ACTIVATION_AUDIT_STORE,
  resolveSkillActivationAuditEventLimit,
  type SkillActivationAuditStore,
} from './maintenance/skillActivationAuditLog';
import {
  dedupeAndSortInstalledSkills,
  movePathWithExdevFallback,
  resolveSkillStoreScanRoots,
  runSkillStoreMoveTransaction,
  SKILL_FILE_NAME,
  scanSkillEntriesFromRoots,
} from './maintenance/skillStoreScanner';
import {
  NOOP_TOOL_UPDATE_AUDIT_STORE,
  resolveToolUpdateLogLimit,
  type ToolUpdateAuditStore,
} from './maintenance/toolUpdateAuditLog';

interface CommandExecutionResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
  spawnErrorCode?: string;
}

interface SkillLockEntryLike {
  source?: string;
  skillFolderHash?: string;
  updatedAt?: string;
}

interface SkillActivationState {
  active: boolean;
  path: string | null;
}

interface SkillActivationMovePlan {
  sourcePath: string;
  targetPath: string;
  ensureTargetRoot: string;
}

interface ResolvedSkillActivationState {
  before: SkillActivationState;
  existingActivePath: string | null;
  existingDisabledPath: string | null;
}

interface CliMaintenanceServiceOptions {
  activationAuditStore?: SkillActivationAuditStore;
  updateAuditStore?: ToolUpdateAuditStore;
}

const SKILL_LOCK_PATH = path.join(os.homedir(), '.agents', '.skill-lock.json');

function limitText(raw: string, max = 12000): string {
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}\n... (truncated)`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function ensureNoPathTraversal(skillId: string): string {
  const trimmed = skillId.trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
    throw new Error(`Invalid skill id: ${skillId}`);
  }
  return trimmed;
}

export class CliMaintenanceService {
  private readonly resolveAdapters: () => MaintenanceServiceAdapter[];
  private readonly activationAuditStore: SkillActivationAuditStore;
  private readonly updateAuditStore: ToolUpdateAuditStore;

  constructor(
    resolveAdapters: () => MaintenanceServiceAdapter[] = () => createMaintenanceAdapters(),
    options: CliMaintenanceServiceOptions = {},
  ) {
    this.resolveAdapters = resolveAdapters;
    this.activationAuditStore = options.activationAuditStore ?? NOOP_SKILL_ACTIVATION_AUDIT_STORE;
    this.updateAuditStore = options.updateAuditStore ?? NOOP_TOOL_UPDATE_AUDIT_STORE;
  }

  private getAdapters(): MaintenanceServiceAdapter[] {
    return this.resolveAdapters();
  }

  getManagedTools(): ManagedCliTool[] {
    const tools = this.getAdapters().flatMap((adapter) => {
      if (!adapter.capability.maintenance.enabled) {
        return [];
      }
      return adapter.getManagedTools?.() ?? [];
    });
    return dedupeByLast(tools, (tool) => tool.id);
  }

  async checkToolVersions(toolIds?: string[]): Promise<CliToolVersionInfo[]> {
    const tools = this.resolveToolTargets(toolIds);
    return Promise.all(tools.map((tool) => this.checkSingleToolVersion(tool)));
  }

  async runToolUpdate(toolId: string): Promise<CliToolUpdateResult> {
    const tool = this.getManagedTool(toolId);
    return this.runToolUpdateWithLogging(tool, null);
  }

  async runToolUpdates(toolIds: string[]): Promise<CliToolBatchUpdateSummary> {
    const normalizedToolIds = Array.from(new Set(toolIds.map((toolId) => toolId.trim()))).filter(
      (toolId) => toolId.length > 0,
    );
    const tools = normalizedToolIds.map((toolId) => this.getManagedTool(toolId));
    const batchId = randomUUID();
    const startedAt = Date.now();
    const results: CliToolUpdateResult[] = [];

    for (const tool of tools) {
      results.push(await this.runToolUpdateWithLogging(tool, batchId));
    }

    const completedAt = Date.now();
    const succeeded = results.filter((result) => result.success).length;
    const failed = results.length - succeeded;

    return {
      batchId,
      requestedToolIds: tools.map((tool) => tool.id),
      startedAt,
      completedAt,
      total: results.length,
      succeeded,
      failed,
      results,
    };
  }

  getSkillInstallPaths(): SkillInstallPathInfo[] {
    return this.getSkillStores().map((store) => toSkillInstallPathInfo(store));
  }

  async getInstalledSkills(): Promise<InstalledSkillInfo[]> {
    const lockMap = await this.readSkillLockMap();
    const targets = this.getSkillStores();
    const allSkills = (
      await Promise.all(targets.map((target) => this.scanSkillSet(target, lockMap)))
    ).flat();
    return dedupeAndSortInstalledSkills(allSkills);
  }

  async setSkillActivation(
    provider: SkillProvider,
    skillId: string,
    active: boolean,
  ): Promise<InstalledSkillInfo> {
    const normalizedSkillId = ensureNoPathTraversal(skillId);
    const config = this.getSkillPathConfig(provider);
    const roots = resolveSkillStoreScanRoots(config);
    const primaryInstallRoot = roots.installRoots[0] ?? config.installRoot;
    const primaryDisabledRoot = roots.disabledRoots[0] ?? config.disabledRoot;
    const activePath = this.buildSkillPath(primaryInstallRoot, normalizedSkillId);
    const disabledPath = this.buildSkillPath(primaryDisabledRoot, normalizedSkillId);
    const activeEntries = await scanSkillEntriesFromRoots(roots.installRoots);
    const disabledEntries = await scanSkillEntriesFromRoots(roots.disabledRoots);

    const resolvedState = await this.resolveSkillActivationState({
      provider,
      skillId: normalizedSkillId,
      active,
      activePath,
      disabledPath,
      activeEntries,
      disabledEntries,
    });
    const movePlan = this.resolveSkillActivationMovePlan({
      requestedActive: active,
      existingActivePath: resolvedState.existingActivePath,
      existingDisabledPath: resolvedState.existingDisabledPath,
      activePath,
      disabledPath,
      primaryInstallRoot,
      primaryDisabledRoot,
    });

    let refreshedSkill: InstalledSkillInfo | null = null;
    const transaction = await runSkillStoreMoveTransaction({
      apply: async () => {
        if (movePlan && movePlan.sourcePath !== movePlan.targetPath) {
          await fs.mkdir(movePlan.ensureTargetRoot, { recursive: true });
          await movePathWithExdevFallback(movePlan.sourcePath, movePlan.targetPath);
        }

        refreshedSkill = await this.findInstalledSkill(provider, normalizedSkillId);
        await this.activationAuditStore.append({
          provider,
          skillId: normalizedSkillId,
          before: resolvedState.before,
          after: {
            active: refreshedSkill.active,
            path: refreshedSkill.path,
          },
          timestamp: Date.now(),
        });
      },
      rollback: async () => {
        if (!movePlan || movePlan.sourcePath === movePlan.targetPath) {
          return;
        }
        if (!(await this.pathExists(movePlan.targetPath))) {
          return;
        }
        await fs.mkdir(path.dirname(movePlan.sourcePath), { recursive: true });
        await movePathWithExdevFallback(movePlan.targetPath, movePlan.sourcePath);
      },
    });

    if (!transaction.ok) {
      if (transaction.rollbackError) {
        throw new Error(
          `Skill activation transaction failed (${provider}/${normalizedSkillId}): ${transaction.error ?? 'Unknown error'} (rollback failed: ${transaction.rollbackError})`,
        );
      }
      throw new Error(
        `Skill activation transaction failed (${provider}/${normalizedSkillId}): ${transaction.error ?? 'Unknown error'}`,
      );
    }

    if (!refreshedSkill) {
      throw new Error(`Skill state refresh failed: ${provider}/${normalizedSkillId}`);
    }

    return refreshedSkill;
  }

  async getSkillActivationEvents(limit = 20): Promise<SkillActivationAuditEvent[]> {
    const resolvedLimit = resolveSkillActivationAuditEventLimit(limit);
    return this.activationAuditStore.listRecent(resolvedLimit);
  }

  async getToolUpdateLogs(limit = 20, toolId?: string): Promise<CliToolUpdateLogEntry[]> {
    const resolvedLimit = resolveToolUpdateLogLimit(limit);
    return this.updateAuditStore.listRecent({
      limit: resolvedLimit,
      toolId,
    });
  }

  private async resolveSkillActivationState({
    provider,
    skillId,
    active,
    activePath,
    disabledPath,
    activeEntries,
    disabledEntries,
  }: {
    provider: SkillProvider;
    skillId: string;
    active: boolean;
    activePath: string;
    disabledPath: string;
    activeEntries: Map<string, string>;
    disabledEntries: Map<string, string>;
  }): Promise<ResolvedSkillActivationState> {
    const existingActivePath =
      activeEntries.get(skillId) ?? ((await this.pathExists(activePath)) ? activePath : null);
    const existingDisabledPath =
      disabledEntries.get(skillId) ?? ((await this.pathExists(disabledPath)) ? disabledPath : null);

    if (!existingActivePath && !existingDisabledPath) {
      if (active) {
        throw new Error(`Skill not found for activation: ${provider}/${skillId}`);
      }
      throw new Error(`Skill not found for deactivation: ${provider}/${skillId}`);
    }

    if (existingActivePath) {
      return {
        before: {
          active: true,
          path: existingActivePath,
        },
        existingActivePath,
        existingDisabledPath,
      };
    }

    return {
      before: {
        active: false,
        path: existingDisabledPath,
      },
      existingActivePath,
      existingDisabledPath,
    };
  }

  private resolveSkillActivationMovePlan({
    requestedActive,
    existingActivePath,
    existingDisabledPath,
    activePath,
    disabledPath,
    primaryInstallRoot,
    primaryDisabledRoot,
  }: {
    requestedActive: boolean;
    existingActivePath: string | null;
    existingDisabledPath: string | null;
    activePath: string;
    disabledPath: string;
    primaryInstallRoot: string;
    primaryDisabledRoot: string;
  }): SkillActivationMovePlan | null {
    if (requestedActive) {
      if (existingActivePath) {
        return null;
      }
      return {
        sourcePath: existingDisabledPath ?? disabledPath,
        targetPath: activePath,
        ensureTargetRoot: primaryInstallRoot,
      };
    }

    if (existingDisabledPath) {
      return null;
    }

    return {
      sourcePath: existingActivePath ?? activePath,
      targetPath: disabledPath,
      ensureTargetRoot: primaryDisabledRoot,
    };
  }

  private async findInstalledSkill(
    provider: SkillProvider,
    skillId: string,
  ): Promise<InstalledSkillInfo> {
    const all = await this.getInstalledSkills();
    const found = all.find((item) => item.provider === provider && item.id === skillId);
    if (!found) {
      throw new Error(`Skill state refresh failed: ${provider}/${skillId}`);
    }
    return found;
  }

  private resolveToolTargets(toolIds?: string[]): ManagedCliTool[] {
    if (!toolIds || toolIds.length === 0) {
      return this.getManagedTools();
    }
    return toolIds.map((toolId) => this.getManagedTool(toolId));
  }

  private getManagedTool(toolId: string): ManagedCliTool {
    const tool = this.getManagedTools().find((item) => item.id === toolId);
    if (!tool) {
      throw new Error(`Unknown managed tool: ${toolId}`);
    }
    return tool;
  }

  private async runToolUpdateWithLogging(
    tool: ManagedCliTool,
    batchId: string | null,
  ): Promise<CliToolUpdateResult> {
    const startedAt = Date.now();
    const result = await this.executeCommand(tool.updateCommand);
    const completedAt = Date.now();
    const updateResult: CliToolUpdateResult = {
      toolId: tool.id,
      success: result.exitCode === 0 && !result.error,
      command: [tool.updateCommand.command, ...tool.updateCommand.args],
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      startedAt,
      completedAt,
      error: result.error,
    };

    await this.appendToolUpdateLog(updateResult, batchId);
    return updateResult;
  }

  private async appendToolUpdateLog(
    result: CliToolUpdateResult,
    batchId: string | null,
  ): Promise<void> {
    const entry: CliToolUpdateLogEntry = {
      logId: randomUUID(),
      batchId,
      toolId: result.toolId,
      success: result.success,
      command: [...result.command],
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      error: result.error,
    };
    try {
      await this.updateAuditStore.append(entry);
    } catch (error) {
      console.error('Failed to persist tool update log:', error);
    }
  }

  private getSkillStores(): SkillStoreAdapter[] {
    const stores = this.getAdapters()
      .filter((adapter) => adapter.capability.skills.enabled)
      .map((adapter) => adapter.getSkillStore?.())
      .filter((store): store is SkillStoreAdapter => Boolean(store));
    return dedupeByLast(stores, (store) => store.provider);
  }

  private getSkillPathConfig(provider: SkillProvider): SkillStoreAdapter {
    const found = this.getSkillStores().find((item) => item.provider === provider);
    if (!found) {
      throw new Error(`Unsupported skill provider: ${provider}`);
    }
    return found;
  }

  private buildSkillPath(root: string, skillId: string): string {
    const safeSkillId = ensureNoPathTraversal(skillId);
    const resolvedRoot = path.resolve(root);
    const resolvedPath = path.resolve(root, safeSkillId);
    if (!resolvedPath.startsWith(`${resolvedRoot}${path.sep}`) && resolvedPath !== resolvedRoot) {
      throw new Error(`Invalid skill path resolution for ${skillId}`);
    }
    return resolvedPath;
  }

  private async checkSingleToolVersion(tool: ManagedCliTool): Promise<CliToolVersionInfo> {
    const result = await this.executeCommand(tool.versionCommand);
    const command = [tool.versionCommand.command, ...tool.versionCommand.args];
    const rawOutput = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    const version = this.extractVersion(rawOutput);
    const checkedAt = Date.now();
    const status = result.error
      ? result.spawnErrorCode === 'ENOENT'
        ? 'missing'
        : 'error'
      : result.exitCode === 0
        ? 'ok'
        : 'error';
    const latestVersion = await this.resolveLatestVersion(tool, status);
    const updateNeed = this.resolveToolUpdateNeed({
      tool,
      status,
      version,
      latestVersion,
    });

    if (result.error) {
      return {
        toolId: tool.id,
        status,
        version: null,
        latestVersion,
        updateRequired: updateNeed.updateRequired,
        updateReason: updateNeed.updateReason,
        command,
        rawOutput,
        checkedAt,
        error: result.error,
      };
    }

    return {
      toolId: tool.id,
      status,
      version,
      latestVersion,
      updateRequired: updateNeed.updateRequired,
      updateReason: updateNeed.updateReason,
      command,
      rawOutput,
      checkedAt,
      error: result.exitCode === 0 ? undefined : `Command exited with code ${result.exitCode}`,
    };
  }

  private async resolveLatestVersion(
    tool: ManagedCliTool,
    versionStatus: CliToolVersionInfo['status'],
  ): Promise<string | null> {
    if (!tool.latestVersionCommand || versionStatus === 'missing') {
      return null;
    }

    const result = await this.executeCommand(tool.latestVersionCommand);
    if (result.error || result.exitCode !== 0) {
      return null;
    }

    const rawOutput = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    return this.extractVersion(rawOutput);
  }

  private resolveToolUpdateNeed({
    tool,
    status,
    version,
    latestVersion,
  }: {
    tool: ManagedCliTool;
    status: CliToolVersionInfo['status'];
    version: string | null;
    latestVersion: string | null;
  }): {
    updateRequired: boolean;
    updateReason: CliToolUpdateReason;
  } {
    const explicitUpdateRequired = tool.updatePolicy?.explicitUpdateRequired;
    if (typeof explicitUpdateRequired === 'boolean') {
      return {
        updateRequired: explicitUpdateRequired,
        updateReason: explicitUpdateRequired ? 'explicit-required' : 'explicit-not-required',
      };
    }

    if (status === 'missing') {
      return {
        updateRequired: true,
        updateReason: 'missing',
      };
    }

    if (status === 'error') {
      return {
        updateRequired: true,
        updateReason: 'version-check-error',
      };
    }

    if (version && latestVersion) {
      const comparison = this.compareSemver(version, latestVersion);
      if (comparison === null) {
        return {
          updateRequired: true,
          updateReason: 'invalid-version',
        };
      }
      return {
        updateRequired: comparison < 0,
        updateReason: comparison < 0 ? 'outdated' : 'up-to-date',
      };
    }

    if (version && !latestVersion) {
      return {
        updateRequired: true,
        updateReason: 'latest-version-unavailable',
      };
    }

    return {
      updateRequired: true,
      updateReason: 'fallback-required',
    };
  }

  private compareSemver(currentVersion: string, latestVersion: string): number | null {
    const current = this.parseSemver(currentVersion);
    const latest = this.parseSemver(latestVersion);
    if (!current || !latest) {
      return null;
    }

    if (current.major !== latest.major) {
      return current.major < latest.major ? -1 : 1;
    }
    if (current.minor !== latest.minor) {
      return current.minor < latest.minor ? -1 : 1;
    }
    if (current.patch !== latest.patch) {
      return current.patch < latest.patch ? -1 : 1;
    }

    if (!current.prerelease && !latest.prerelease) {
      return 0;
    }
    if (!current.prerelease) {
      return 1;
    }
    if (!latest.prerelease) {
      return -1;
    }

    const currentParts = current.prerelease.split('.');
    const latestParts = latest.prerelease.split('.');
    const totalParts = Math.max(currentParts.length, latestParts.length);

    for (let index = 0; index < totalParts; index += 1) {
      const currentPart = currentParts[index];
      const latestPart = latestParts[index];
      if (currentPart === undefined) {
        return -1;
      }
      if (latestPart === undefined) {
        return 1;
      }
      if (currentPart === latestPart) {
        continue;
      }

      const currentNumber = Number(currentPart);
      const latestNumber = Number(latestPart);
      const currentNumeric = Number.isInteger(currentNumber) && /^\d+$/.test(currentPart);
      const latestNumeric = Number.isInteger(latestNumber) && /^\d+$/.test(latestPart);

      if (currentNumeric && latestNumeric) {
        return currentNumber < latestNumber ? -1 : 1;
      }
      if (currentNumeric && !latestNumeric) {
        return -1;
      }
      if (!currentNumeric && latestNumeric) {
        return 1;
      }
      return currentPart < latestPart ? -1 : 1;
    }

    return 0;
  }

  private parseSemver(version: string): {
    major: number;
    minor: number;
    patch: number;
    prerelease: string | null;
  } | null {
    const match = version
      .trim()
      .match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
    if (!match) {
      return null;
    }

    return {
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3]),
      prerelease: match[4] ?? null,
    };
  }

  private extractVersion(rawOutput: string): string | null {
    const trimmed = rawOutput.trim();
    if (!trimmed) return null;

    const semver = trimmed.match(/\b\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\b/);
    if (semver?.[0]) {
      return semver[0];
    }

    const firstLine = trimmed.split(/\r?\n/).find((line) => line.trim().length > 0);
    return firstLine?.trim() ?? null;
  }

  private async executeCommand(spec: CommandSpec): Promise<CommandExecutionResult> {
    return new Promise((resolve) => {
      const child = spawn(spec.command, spec.args, {
        env: { ...process.env },
      });

      let settled = false;
      let stdout = '';
      let stderr = '';

      const settle = (payload: CommandExecutionResult) => {
        if (settled) return;
        settled = true;
        resolve({
          ...payload,
          stdout: limitText(payload.stdout),
          stderr: limitText(payload.stderr),
        });
      };

      child.stdout?.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      child.on('error', (error: NodeJS.ErrnoException) => {
        settle({
          exitCode: null,
          stdout,
          stderr,
          error: error.message,
          spawnErrorCode: error.code,
        });
      });

      child.on('close', (exitCode) => {
        settle({
          exitCode,
          stdout,
          stderr,
        });
      });
    });
  }

  private async readSkillLockMap(): Promise<Record<string, SkillLockEntryLike>> {
    try {
      const content = await fs.readFile(SKILL_LOCK_PATH, 'utf-8');
      const parsed = JSON.parse(content) as { skills?: Record<string, SkillLockEntryLike> };
      if (!parsed.skills || !isRecord(parsed.skills)) {
        return {};
      }
      return parsed.skills;
    } catch {
      return {};
    }
  }

  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  private async scanSkillSet(
    config: SkillStoreAdapter,
    lockMap: Record<string, SkillLockEntryLike>,
  ): Promise<InstalledSkillInfo[]> {
    const roots = resolveSkillStoreScanRoots(config);
    const activeEntries = await scanSkillEntriesFromRoots(roots.installRoots);
    const disabledEntries = await scanSkillEntriesFromRoots(roots.disabledRoots);
    const allSkillIds = new Set<string>([...activeEntries.keys(), ...disabledEntries.keys()]);
    const primaryInstallRoot = roots.installRoots[0] ?? config.installRoot;
    const primaryDisabledRoot = roots.disabledRoots[0] ?? config.disabledRoot;

    const skills: InstalledSkillInfo[] = [];
    for (const skillId of allSkillIds) {
      const activePath = this.buildSkillPath(primaryInstallRoot, skillId);
      const disabledPath = this.buildSkillPath(primaryDisabledRoot, skillId);
      const currentPath = activeEntries.get(skillId) ?? disabledEntries.get(skillId);
      if (!currentPath) {
        continue;
      }

      const parsed = await this.parseInstalledSkill(
        currentPath,
        config.provider,
        skillId,
        activeEntries.has(skillId),
        activePath,
        disabledPath,
        lockMap,
      );
      if (parsed) {
        skills.push(parsed);
      }
    }

    return skills;
  }

  private async parseInstalledSkill(
    currentPath: string,
    provider: SkillProvider,
    skillId: string,
    active: boolean,
    activePath: string,
    disabledPath: string,
    lockMap: Record<string, SkillLockEntryLike>,
  ): Promise<InstalledSkillInfo | null> {
    const skillFilePath = path.join(currentPath, SKILL_FILE_NAME);
    let rawContent = '';
    try {
      rawContent = await fs.readFile(skillFilePath, 'utf-8');
    } catch {
      return null;
    }

    const parsed = matter(rawContent);
    const frontmatter = isRecord(parsed.data) ? parsed.data : {};
    const metadata = isRecord(frontmatter.metadata) ? frontmatter.metadata : {};
    const lock = lockMap[skillId];
    const versionInfo = resolveSkillVersionInfo({
      frontmatter,
      metadata,
      lock,
    });

    const name = this.readString(frontmatter.name) ?? this.readString(metadata.name) ?? skillId;
    const description =
      this.readString(frontmatter.description) ?? this.readString(metadata.description) ?? '';

    let updatedAt: number | null = null;
    if (lock?.updatedAt) {
      const parsedDate = Date.parse(lock.updatedAt);
      if (!Number.isNaN(parsedDate)) {
        updatedAt = parsedDate;
      }
    }

    if (updatedAt === null) {
      try {
        const stats = await fs.stat(skillFilePath);
        updatedAt = stats.mtimeMs;
      } catch {
        updatedAt = null;
      }
    }

    return {
      id: skillId,
      name,
      description,
      path: currentPath,
      provider,
      active,
      installRoot: path.dirname(activePath),
      disabledRoot: path.dirname(disabledPath),
      activePath,
      disabledPath,
      versionHint: versionInfo.versionHint,
      source: versionInfo.source,
      updatedAt,
    };
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
}

export const cliMaintenanceService = new CliMaintenanceService();
