import type { Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { SkillStoreAdapter } from '../../types/maintenance-adapter-sdk';
import type { InstalledSkillInfo, SkillProvider } from '../../types/tool-maintenance';

export const SKILL_FILE_NAME = 'SKILL.md';

export interface SkillStoreFileOps {
  rename(fromPath: string, toPath: string): Promise<void>;
  cp(
    source: string,
    destination: string,
    options?: {
      recursive?: boolean;
    },
  ): Promise<void>;
  rm(
    targetPath: string,
    options?: {
      recursive?: boolean;
      force?: boolean;
    },
  ): Promise<void>;
  readdir(
    dirPath: string,
    options: {
      withFileTypes: true;
    },
  ): Promise<Dirent[]>;
  access(targetPath: string): Promise<void>;
}

export interface SkillStoreScanRoots {
  installRoots: string[];
  disabledRoots: string[];
}

export interface SkillStoreScanRootStrategy {
  id: string;
  resolveInstallRoots(store: SkillStoreAdapter): string[];
  resolveDisabledRoots(store: SkillStoreAdapter): string[];
}

interface ProviderSkillStoreScanRootStrategy extends SkillStoreScanRootStrategy {
  provider: SkillProvider;
}

export interface ResolvedSkillStoreScanRoots extends SkillStoreScanRoots {
  strategyId: string;
}

export interface SkillStoreMoveTransactionResult {
  ok: boolean;
  rolledBack: boolean;
  error?: string;
  rollbackError?: string;
}

function defineProviderSkillStoreScanRootStrategy(
  strategy: ProviderSkillStoreScanRootStrategy,
): ProviderSkillStoreScanRootStrategy {
  return strategy;
}

function createFlatRootsStrategy(id: string): SkillStoreScanRootStrategy {
  return {
    id,
    resolveInstallRoots: (store) => [store.installRoot],
    resolveDisabledRoots: (store) => [store.disabledRoot],
  };
}

const DEFAULT_SCAN_STRATEGY_ID = 'flat';
const DEFAULT_SCAN_STRATEGY = createFlatRootsStrategy(DEFAULT_SCAN_STRATEGY_ID);
const AGENTS_SCAN_STRATEGY = createFlatRootsStrategy('agents-flat');

const PROVIDER_SCAN_STRATEGIES = [
  defineProviderSkillStoreScanRootStrategy({
    provider: 'claude',
    ...DEFAULT_SCAN_STRATEGY,
  }),
  defineProviderSkillStoreScanRootStrategy({
    provider: 'codex',
    ...DEFAULT_SCAN_STRATEGY,
  }),
  defineProviderSkillStoreScanRootStrategy({
    provider: 'gemini',
    ...DEFAULT_SCAN_STRATEGY,
  }),
  defineProviderSkillStoreScanRootStrategy({
    provider: 'agents',
    ...AGENTS_SCAN_STRATEGY,
  }),
] as const;

const scanStrategies = new Map<string, SkillStoreScanRootStrategy>([
  [DEFAULT_SCAN_STRATEGY.id, DEFAULT_SCAN_STRATEGY],
  [AGENTS_SCAN_STRATEGY.id, AGENTS_SCAN_STRATEGY],
]);

const providerToStrategyId = new Map<string, string>(
  PROVIDER_SCAN_STRATEGIES.map((strategy) => [strategy.provider, strategy.id]),
);

function resolveStrategyById(strategyId: string | undefined): SkillStoreScanRootStrategy | null {
  if (!strategyId) {
    return null;
  }
  return scanStrategies.get(strategyId) ?? null;
}

function inferStrategyByProvider(provider: SkillProvider): SkillStoreScanRootStrategy | null {
  const strategyId = providerToStrategyId.get(provider);
  if (!strategyId) {
    return null;
  }
  return resolveStrategyById(strategyId);
}

function normalizeRoots(roots: string[], fallbackRoot: string): string[] {
  const resolved = roots.map((root) => path.resolve(root)).filter((root) => root.length > 0);
  if (resolved.length === 0) {
    return [path.resolve(fallbackRoot)];
  }
  return Array.from(new Set(resolved));
}

function shouldSkipDirectoryEntry(entry: Dirent): boolean {
  const isSymbolicLink = entry.isSymbolicLink();
  return (!entry.isDirectory() && !isSymbolicLink) || entry.name.startsWith('.');
}

function compareInstalledSkills(a: InstalledSkillInfo, b: InstalledSkillInfo): number {
  if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
  if (a.name !== b.name) return a.name.localeCompare(b.name);
  return a.id.localeCompare(b.id);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

export function resolveSkillStoreScanRoots(store: SkillStoreAdapter): ResolvedSkillStoreScanRoots {
  const explicit = resolveStrategyById(store.scanStrategy);
  const inferred = inferStrategyByProvider(store.provider);
  const strategy = explicit ?? inferred ?? DEFAULT_SCAN_STRATEGY;
  // Progressive rollout: explicit > inferred(provider) > safe default(flat roots)
  return {
    strategyId: strategy.id,
    installRoots: normalizeRoots(strategy.resolveInstallRoots(store), store.installRoot),
    disabledRoots: normalizeRoots(strategy.resolveDisabledRoots(store), store.disabledRoot),
  };
}

export async function movePathWithExdevFallback(
  fromPath: string,
  toPath: string,
  fileOps: SkillStoreFileOps = fs,
): Promise<void> {
  try {
    await fileOps.rename(fromPath, toPath);
    return;
  } catch (error) {
    const maybeErr = error as NodeJS.ErrnoException;
    if (maybeErr.code !== 'EXDEV') {
      throw error;
    }
  }

  await fileOps.cp(fromPath, toPath, { recursive: true });
  await fileOps.rm(fromPath, { recursive: true, force: true });
}

export async function runSkillStoreMoveTransaction({
  apply,
  rollback,
}: {
  apply: () => Promise<void>;
  rollback: () => Promise<void>;
}): Promise<SkillStoreMoveTransactionResult> {
  try {
    await apply();
    return {
      ok: true,
      rolledBack: false,
    };
  } catch (error) {
    try {
      await rollback();
      return {
        ok: false,
        rolledBack: true,
        error: toErrorMessage(error),
      };
    } catch (rollbackError) {
      return {
        ok: false,
        rolledBack: true,
        error: toErrorMessage(error),
        rollbackError: toErrorMessage(rollbackError),
      };
    }
  }
}

export async function scanSkillDirectoryEntries(
  dirPath: string,
  fileOps: SkillStoreFileOps = fs,
): Promise<Map<string, string>> {
  const found = new Map<string, string>();

  let entries: Dirent[];
  try {
    entries = await fileOps.readdir(dirPath, { withFileTypes: true });
  } catch {
    return found;
  }

  for (const entry of entries) {
    if (shouldSkipDirectoryEntry(entry)) {
      continue;
    }

    const skillDir = path.join(dirPath, entry.name);
    const skillFilePath = path.join(skillDir, SKILL_FILE_NAME);
    try {
      await fileOps.access(skillFilePath);
      found.set(entry.name, skillDir);
    } catch {}
  }

  return found;
}

export async function scanSkillEntriesFromRoots(
  roots: readonly string[],
  fileOps: SkillStoreFileOps = fs,
): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const root of roots) {
    const entries = await scanSkillDirectoryEntries(root, fileOps);
    for (const [skillId, skillPath] of entries) {
      if (!found.has(skillId)) {
        found.set(skillId, skillPath);
      }
    }
  }
  return found;
}

export function dedupeAndSortInstalledSkills(
  skills: readonly InstalledSkillInfo[],
): InstalledSkillInfo[] {
  const deduped = new Map<string, InstalledSkillInfo>();
  for (const skill of skills) {
    const key = `${skill.provider}:${skill.id}`;
    if (!deduped.has(key)) {
      deduped.set(key, skill);
    }
  }
  return Array.from(deduped.values()).sort(compareInstalledSkills);
}
