/**
 * Application-level settings storage service
 * Stores user preferences in JSON file
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import {
  createEmptyMaintenanceRegistry,
  runMaintenanceRegistryMigrationTransaction,
} from '../lib/maintenanceRegistryMigration';
import { validateMaintenanceRegistryPayload } from '../lib/maintenanceRegistryValidation';
import type {
  MaintenanceRegistryDocument,
  MaintenanceRegistryService,
} from '../types/maintenance-registry';
import type {
  ReferenceAssetPreference,
  ReferenceAssetPreferenceMap,
  ReferenceAssetPreferenceUpdate,
} from '../types/reference-assets';

interface AppSettings {
  claudeProjectsPath?: string;
  currentProjectPath?: string;
  currentProjectDirName?: string;
  mcpResourcePaths?: string[];
  claudeDocsPath?: string;
  controllerDocsPath?: string;
  metadataPath?: string;
  maintenanceRegistry?: MaintenanceRegistryDocument;
  // Legacy key (v1): array-root registry payload kept for migration compatibility.
  maintenanceServices?: unknown;
  referenceAssetPreferences?: ReferenceAssetPreferenceMap;
}

function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }
  const normalized = tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return Array.from(new Set(normalized));
}

function normalizeReferenceAssetPreference(input: unknown): ReferenceAssetPreference | undefined {
  if (typeof input !== 'object' || input === null) {
    return undefined;
  }

  const candidate = input as Partial<ReferenceAssetPreference>;
  const favorite = candidate.favorite === true;
  const tags = sanitizeTags(candidate.tags);

  if (!favorite && tags.length === 0) {
    return undefined;
  }

  return { favorite, tags };
}

function normalizeReferenceAssetPreferences(input: unknown): ReferenceAssetPreferenceMap {
  if (typeof input !== 'object' || input === null) {
    return {};
  }

  const result: ReferenceAssetPreferenceMap = {};
  for (const [relativePath, pref] of Object.entries(input as Record<string, unknown>)) {
    const normalizedPath = relativePath.trim();
    if (!normalizedPath) {
      continue;
    }
    const normalizedPreference = normalizeReferenceAssetPreference(pref);
    if (normalizedPreference) {
      result[normalizedPath] = normalizedPreference;
    }
  }
  return result;
}

export class SettingsService {
  private settingsPath: string;
  private settings: AppSettings = {};

  constructor() {
    const userDataPath = app.getPath('userData');
    this.settingsPath = path.join(userDataPath, 'app-settings.json');
    this.ensureDirectoryExists();
    this.loadSettings();
  }

  private ensureDirectoryExists(): void {
    const dir = path.dirname(this.settingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private cloneSettingsSnapshot(): AppSettings {
    return structuredClone(this.settings);
  }

  private writeSettingsToDisk(settings: AppSettings): void {
    this.ensureDirectoryExists();
    fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  private saveSettingsWithRollback(snapshot: AppSettings): void {
    try {
      this.writeSettingsToDisk(this.settings);
    } catch (error) {
      this.settings = snapshot;
      try {
        this.writeSettingsToDisk(this.settings);
      } catch (rollbackError) {
        console.error('Failed to rollback settings snapshot:', rollbackError);
      }
      console.error('Failed to save migrated settings. Restored previous snapshot:', error);
    }
  }

  private normalizeMaintenanceRegistry(): void {
    const migrationInput =
      this.settings.maintenanceRegistry !== undefined
        ? this.settings.maintenanceRegistry
        : this.settings.maintenanceServices;

    if (migrationInput === undefined) {
      return;
    }

    const snapshot = this.cloneSettingsSnapshot();
    const transaction = runMaintenanceRegistryMigrationTransaction({
      input: migrationInput,
      apply: (registry) => {
        const validation = validateMaintenanceRegistryPayload(registry);
        if (!validation.valid || !validation.value) {
          throw new Error(validation.errors.join('\n'));
        }
        this.settings.maintenanceRegistry = {
          schemaVersion: validation.value.schemaVersion,
          services: [...validation.value.services],
        };
        delete this.settings.maintenanceServices;
      },
      rollback: () => {
        this.settings = snapshot;
      },
    });

    if (!transaction.ok || !this.settings.maintenanceRegistry) {
      console.warn(
        `[Settings] Invalid maintenance registry in ${this.settingsPath}, resetting to empty registry document:\n${transaction.error ?? 'Unknown migration error'}`,
      );
      this.settings.maintenanceRegistry = createEmptyMaintenanceRegistry();
      delete this.settings.maintenanceServices;
      this.saveSettingsWithRollback(snapshot);
      return;
    }

    if (transaction.migrated || snapshot.maintenanceServices !== undefined) {
      this.saveSettingsWithRollback(snapshot);
    }
  }

  private loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        this.settings = JSON.parse(data) as AppSettings;

        this.normalizeMaintenanceRegistry();

        if (this.settings.referenceAssetPreferences !== undefined) {
          this.settings.referenceAssetPreferences = normalizeReferenceAssetPreferences(
            this.settings.referenceAssetPreferences,
          );
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = {};
    }
  }

  private saveSettings(): void {
    try {
      this.writeSettingsToDisk(this.settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  getSettingsPath(): string {
    return this.settingsPath;
  }

  getClaudeProjectsPath(): string | undefined {
    return this.settings.claudeProjectsPath;
  }

  setClaudeProjectsPath(projectsPath: string): void {
    this.settings.claudeProjectsPath = projectsPath;
    this.saveSettings();
  }

  getAllSettings(): AppSettings {
    return { ...this.settings };
  }

  getCurrentProjectPath(): string | undefined {
    return this.settings.currentProjectPath;
  }

  getCurrentProjectDirName(): string | undefined {
    return this.settings.currentProjectDirName;
  }

  setCurrentProject(projectPath: string, projectDirName: string): void {
    this.settings.currentProjectPath = projectPath;
    this.settings.currentProjectDirName = projectDirName;
    this.saveSettings();
  }

  clearCurrentProject(): void {
    this.settings.currentProjectPath = undefined;
    this.settings.currentProjectDirName = undefined;
    this.saveSettings();
  }

  getMcpResourcePaths(): string[] {
    return this.settings.mcpResourcePaths || [];
  }

  setMcpResourcePaths(paths: string[]): void {
    this.settings.mcpResourcePaths = paths;
    this.saveSettings();
  }

  addMcpResourcePath(newPath: string): void {
    if (!this.settings.mcpResourcePaths) {
      this.settings.mcpResourcePaths = [];
    }
    if (!this.settings.mcpResourcePaths.includes(newPath)) {
      this.settings.mcpResourcePaths.push(newPath);
      this.saveSettings();
    }
  }

  removeMcpResourcePath(pathToRemove: string): void {
    if (this.settings.mcpResourcePaths) {
      this.settings.mcpResourcePaths = this.settings.mcpResourcePaths.filter(
        (p) => p !== pathToRemove,
      );
      this.saveSettings();
    }
  }

  getDefaultPaths(): {
    claudeProjectsPath: string;
    mcpConfigPath: string;
    claudeDocsPath: string;
    controllerDocsPath: string;
    metadataPath: string;
  } {
    const homeDir = app.getPath('home');
    const isDev = !app.isPackaged;
    const appPath = app.getAppPath();
    const projectRoot = isDev ? appPath : path.join(homeDir, 'Documents', 'claude-code-spec');

    return {
      claudeProjectsPath: path.join(homeDir, '.claude', 'projects'),
      mcpConfigPath: path.join(homeDir, '.claude.json'),
      claudeDocsPath: path.join(projectRoot, 'docs', 'claude-context'),
      controllerDocsPath: path.join(projectRoot, 'docs', 'controller-docs'),
      metadataPath: path.join(projectRoot, 'docs', 'claude-context-meta'),
    };
  }

  getDefaultMcpResourcePaths(): string[] {
    const homeDir = app.getPath('home');
    return [path.join(homeDir, '.claude.json')];
  }

  getClaudeDocsPath(): string | undefined {
    return this.settings.claudeDocsPath;
  }
  setClaudeDocsPath(p: string): void {
    this.settings.claudeDocsPath = p;
    this.saveSettings();
  }
  getControllerDocsPath(): string | undefined {
    return this.settings.controllerDocsPath;
  }
  setControllerDocsPath(p: string): void {
    this.settings.controllerDocsPath = p;
    this.saveSettings();
  }
  getMetadataPath(): string | undefined {
    return this.settings.metadataPath;
  }
  setMetadataPath(p: string): void {
    this.settings.metadataPath = p;
    this.saveSettings();
  }

  getMaintenanceRegistry(): MaintenanceRegistryDocument {
    const source =
      this.settings.maintenanceRegistry !== undefined
        ? this.settings.maintenanceRegistry
        : this.settings.maintenanceServices;
    const validation = validateMaintenanceRegistryPayload(source);
    if (validation.valid && validation.value) {
      return {
        schemaVersion: validation.value.schemaVersion,
        services: [...validation.value.services],
      };
    }
    return createEmptyMaintenanceRegistry();
  }

  setMaintenanceRegistry(registry: MaintenanceRegistryDocument): void {
    const validation = validateMaintenanceRegistryPayload(registry);
    if (!validation.valid || !validation.value) {
      throw new Error(`Invalid maintenance service registry:\n${validation.errors.join('\n')}`);
    }
    this.settings.maintenanceRegistry = {
      schemaVersion: validation.value.schemaVersion,
      services: [...validation.value.services],
    };
    delete this.settings.maintenanceServices;
    this.saveSettings();
  }

  getMaintenanceServices(): MaintenanceRegistryService[] {
    return this.getMaintenanceRegistry().services;
  }

  setMaintenanceServices(services: MaintenanceRegistryService[]): void {
    this.setMaintenanceRegistry({
      ...createEmptyMaintenanceRegistry(),
      services,
    });
  }

  getReferenceAssetPreferences(): ReferenceAssetPreferenceMap {
    return {
      ...(this.settings.referenceAssetPreferences ?? {}),
    };
  }

  private setReferenceAssetPreferenceInternal(
    relativePath: string,
    preference: ReferenceAssetPreference,
  ): void {
    const normalizedPath = relativePath.trim();
    if (!normalizedPath) {
      throw new Error('relativePath is required');
    }

    const normalizedPreference = normalizeReferenceAssetPreference(preference);
    if (!this.settings.referenceAssetPreferences) {
      this.settings.referenceAssetPreferences = {};
    }

    if (!normalizedPreference) {
      delete this.settings.referenceAssetPreferences[normalizedPath];
    } else {
      this.settings.referenceAssetPreferences[normalizedPath] = normalizedPreference;
    }
  }

  setReferenceAssetPreference(relativePath: string, preference: ReferenceAssetPreference): void {
    this.setReferenceAssetPreferenceInternal(relativePath, preference);
    this.saveSettings();
  }

  setReferenceAssetPreferencesBatch(updates: ReferenceAssetPreferenceUpdate[]): number {
    let updated = 0;
    for (const update of updates) {
      this.setReferenceAssetPreferenceInternal(update.relativePath, update.preference);
      updated += 1;
    }
    this.saveSettings();
    return updated;
  }
}

export const settingsService = new SettingsService();
