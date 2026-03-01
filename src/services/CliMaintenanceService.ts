/**
 * CLI maintenance service
 * - Version checks and updates for managed CLIs
 * - Local installed skill inventory with version hints
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import matter from 'gray-matter';
import { dedupeByLast } from '../lib/collectionUtils';
import type {
  CliToolUpdateResult,
  CliToolVersionInfo,
  CommandSpec,
  InstalledSkillInfo,
  ManagedCliTool,
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
  dedupeAndSortInstalledSkills,
  movePathWithExdevFallback,
  resolveSkillStoreScanRoots,
  SKILL_FILE_NAME,
  scanSkillEntriesFromRoots,
} from './maintenance/skillStoreScanner';

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

  constructor(
    resolveAdapters: () => MaintenanceServiceAdapter[] = () => createMaintenanceAdapters(),
  ) {
    this.resolveAdapters = resolveAdapters;
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
    const startedAt = Date.now();
    const result = await this.executeCommand(tool.updateCommand);
    const completedAt = Date.now();

    return {
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

    if (active) {
      const hasActive = activeEntries.has(normalizedSkillId) || (await this.pathExists(activePath));
      if (!hasActive) {
        const existingDisabledPath = disabledEntries.get(normalizedSkillId);
        if (!existingDisabledPath && !(await this.pathExists(disabledPath))) {
          throw new Error(`Skill not found for activation: ${provider}/${normalizedSkillId}`);
        }
        await fs.mkdir(primaryInstallRoot, { recursive: true });
        const sourcePath = existingDisabledPath ?? disabledPath;
        if (sourcePath !== activePath) {
          await movePathWithExdevFallback(sourcePath, activePath);
        }
      }
    } else {
      const hasDisabled =
        disabledEntries.has(normalizedSkillId) || (await this.pathExists(disabledPath));
      if (!hasDisabled) {
        const existingActivePath = activeEntries.get(normalizedSkillId);
        if (!existingActivePath && !(await this.pathExists(activePath))) {
          throw new Error(`Skill not found for deactivation: ${provider}/${normalizedSkillId}`);
        }
        await fs.mkdir(primaryDisabledRoot, { recursive: true });
        const sourcePath = existingActivePath ?? activePath;
        if (sourcePath !== disabledPath) {
          await movePathWithExdevFallback(sourcePath, disabledPath);
        }
      }
    }

    const all = await this.getInstalledSkills();
    const found = all.find((item) => item.provider === provider && item.id === normalizedSkillId);
    if (!found) {
      throw new Error(`Skill state refresh failed: ${provider}/${normalizedSkillId}`);
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

    if (result.error) {
      const status = result.spawnErrorCode === 'ENOENT' ? 'missing' : 'error';
      return {
        toolId: tool.id,
        status,
        version: null,
        command,
        rawOutput,
        checkedAt,
        error: result.error,
      };
    }

    return {
      toolId: tool.id,
      status: result.exitCode === 0 ? 'ok' : 'error',
      version,
      command,
      rawOutput,
      checkedAt,
      error: result.exitCode === 0 ? undefined : `Command exited with code ${result.exitCode}`,
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

    const name = this.readString(frontmatter.name) ?? this.readString(metadata.name) ?? skillId;
    const description =
      this.readString(frontmatter.description) ?? this.readString(metadata.description) ?? '';
    const versionHint =
      lock?.skillFolderHash ??
      this.readString(frontmatter.version) ??
      this.readString(metadata.version) ??
      null;
    const source =
      lock?.source ??
      this.readString(frontmatter.source) ??
      this.readString(metadata.source) ??
      null;

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
      versionHint,
      source,
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
