/**
 * Tools IPC Handlers
 * Handles tool registry queries
 */

import { shell } from 'electron';
import { settingsService } from '../../services/appSettings';
import { CliMaintenanceService } from '../../services/CliMaintenanceService';
import { createMaintenanceAdapters } from '../../services/maintenance/serviceIntegrations';
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

const cliMaintenanceService = new CliMaintenanceService(() =>
  createMaintenanceAdapters({ customServices: settingsService.getMaintenanceServices() }),
);
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
    return cliMaintenanceService.checkToolVersions(toolIds);
  });

  router.handle('run-tool-update', async (_event, toolId: string) => {
    return cliMaintenanceService.runToolUpdate(toolId);
  });

  router.handle('get-skill-install-paths', async () => {
    return cliMaintenanceService.getSkillInstallPaths();
  });

  router.handle('get-installed-skills', async () => {
    return cliMaintenanceService.getInstalledSkills();
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
}
