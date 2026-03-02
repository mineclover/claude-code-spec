/**
 * Tools IPC Handlers
 * Handles tool registry queries
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { shell } from 'electron';
import { settingsService } from '../../services/appSettings';
import { CliMaintenanceService } from '../../services/CliMaintenanceService';
import { FileCliStatusStore } from '../../services/maintenance/cliStatusStore';
import { createMaintenanceAdapters } from '../../services/maintenance/serviceIntegrations';
import { FileSkillActivationAuditStore } from '../../services/maintenance/skillActivationAuditLog';
import { FileToolUpdateAuditStore } from '../../services/maintenance/toolUpdateAuditLog';
import { ReferenceAssetService } from '../../services/ReferenceAssetService';
import { toolRegistry } from '../../services/ToolRegistry';
import type {
  ReferenceAssetPreference,
  ReferenceAssetPreferenceUpdate,
  ReferenceAssetType,
  ReferenceProvider,
} from '../../types/reference-assets';
import type { SkillProvider } from '../../types/tool-maintenance';
import type { IPCRouter } from '../IPCRouter';

const userDataDir = path.dirname(settingsService.getSettingsPath());

const cliMaintenanceService = new CliMaintenanceService(
  () => createMaintenanceAdapters({ customServices: settingsService.getMaintenanceServices() }),
  {
    activationAuditStore: new FileSkillActivationAuditStore(
      path.join(userDataDir, 'skill-activation-events.json'),
    ),
    updateAuditStore: new FileToolUpdateAuditStore(
      path.join(userDataDir, 'tool-update-events.json'),
    ),
  },
);

const cliStatusStore = new FileCliStatusStore(path.join(userDataDir, 'cli-status.json'));

const referenceAssetService = new ReferenceAssetService();

export function registerToolsHandlers(router: IPCRouter): void {
  router.handle('get-registered-tools', async () => {
    return toolRegistry.getAll();
  });

  router.handle('get-tool-by-id', async (_event, toolId: string) => {
    return toolRegistry.get(toolId) ?? null;
  });

  router.handle('get-maintenance-tools', async () => {
    return cliMaintenanceService.getManagedTools();
  });

  router.handle('check-tool-versions', async (_event, toolIds?: string[]) => {
    const results = await cliMaintenanceService.checkToolVersions(toolIds);
    // Persist discovered version info to cli-status.json
    for (const info of results) {
      if (info.version) {
        cliStatusStore
          .setToolStatus(info.toolId, {
            lastKnownVersion: info.version,
            lastCheckedAt: info.checkedAt,
          })
          .catch(() => {});
      }
    }
    return results;
  });

  router.handle('run-tool-update', async (_event, toolId: string) => {
    return cliMaintenanceService.runToolUpdate(toolId);
  });

  router.handle('run-tool-updates', async (_event, toolIds: string[]) => {
    return cliMaintenanceService.runToolUpdates(toolIds);
  });

  router.handle(
    'get-tool-update-logs',
    async (_event, args?: { limit?: number; toolId?: string }) => {
      return cliMaintenanceService.getToolUpdateLogs(args?.limit, args?.toolId);
    },
  );

  router.handle('get-skill-install-paths', async () => {
    return cliMaintenanceService.getSkillInstallPaths();
  });

  router.handle('get-installed-skills', async () => {
    return cliMaintenanceService.getInstalledSkills();
  });

  router.handle('get-skill-activation-events', async (_event, limit?: number) => {
    return cliMaintenanceService.getSkillActivationEvents(limit);
  });

  router.handle(
    'list-reference-assets',
    async (_event, assetType: ReferenceAssetType, provider?: ReferenceProvider) => {
      return referenceAssetService.listAssets(assetType, provider);
    },
  );

  router.handle('read-reference-asset', async (_event, relativePath: string) => {
    return referenceAssetService.readAsset(relativePath);
  });

  router.handle('open-reference-asset', async (_event, relativePath: string) => {
    const resolved = referenceAssetService.getAssetAbsolutePath(relativePath);
    if (!resolved.success || !resolved.absolutePath) {
      return { success: false, error: resolved.error ?? 'Failed to resolve asset path' };
    }

    const openResult = await shell.openPath(resolved.absolutePath);
    if (openResult) {
      return { success: false, error: openResult };
    }
    return { success: true };
  });

  router.handle('reveal-reference-asset', async (_event, relativePath: string) => {
    const resolved = referenceAssetService.getAssetAbsolutePath(relativePath);
    if (!resolved.success || !resolved.absolutePath) {
      return { success: false, error: resolved.error ?? 'Failed to resolve asset path' };
    }

    try {
      shell.showItemInFolder(resolved.absolutePath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reveal reference asset',
      };
    }
  });

  router.handle('get-reference-asset-preferences', async () => {
    return settingsService.getReferenceAssetPreferences();
  });

  router.handle(
    'set-reference-asset-preference',
    async (_event, relativePath: string, preference: ReferenceAssetPreference) => {
      settingsService.setReferenceAssetPreference(relativePath, preference);
      return { success: true };
    },
  );

  router.handle(
    'set-reference-asset-preferences-batch',
    async (_event, updates: ReferenceAssetPreferenceUpdate[]) => {
      const updated = settingsService.setReferenceAssetPreferencesBatch(updates);
      return { success: true, updated };
    },
  );

  router.handle(
    'set-skill-activation',
    async (_event, args: { provider: SkillProvider; skillId: string; active: boolean }) => {
      return cliMaintenanceService.setSkillActivation(args.provider, args.skillId, args.active);
    },
  );

  router.handle(
    'get-skill-content',
    async (_event, args: { provider: SkillProvider; skillId: string }) => {
      try {
        const skills = await cliMaintenanceService.getInstalledSkills();
        const skill = skills.find((s) => s.provider === args.provider && s.id === args.skillId);
        if (!skill) return null;
        const skillFilePath = path.join(skill.path, 'SKILL.md');
        const raw = await fs.readFile(skillFilePath, 'utf-8');
        // Strip YAML frontmatter (--- ... ---)
        return raw.replace(/^---\n[\s\S]*?\n---\n?/, '').trimStart();
      } catch {
        return null;
      }
    },
  );

  router.handle('get-cli-status', async () => {
    return cliStatusStore.readAll();
  });

  router.handle('open-cli-status-file', async () => {
    const filePath = cliStatusStore.getFilePath();
    // Ensure the file exists before opening
    const doc = await cliStatusStore.readAll();
    await cliStatusStore.writeAll(doc);
    const openResult = await shell.openPath(filePath);
    return openResult ? { success: false, error: openResult } : { success: true };
  });
}
