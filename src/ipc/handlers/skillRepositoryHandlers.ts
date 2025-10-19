/**
 * Skill Repository IPC handlers
 */

import { skillRepositoryManager } from '../../services/SkillRepositoryManager';
import type {
  SkillRepositoryConfig,
  OfficialSkill,
  RepositoryStatus,
  SkillImportOptions,
  SkillUpdateInfo,
} from '../../types/skillRepository';
import type { Skill } from '../../types/skill';
import type { IPCRouter } from '../IPCRouter';

/**
 * Register skill repository IPC handlers
 */
export function registerSkillRepositoryHandlers(router: IPCRouter): void {
  // Initialize on first call
  let initialized = false;
  const ensureInit = async () => {
    if (!initialized) {
      await skillRepositoryManager.init();
      initialized = true;
    }
  };

  // Get repository configuration
  router.handle('getRepositoryConfig', async (): Promise<SkillRepositoryConfig> => {
    await ensureInit();
    return skillRepositoryManager.getConfig();
  });

  // Set repository configuration
  router.handle(
    'setRepositoryConfig',
    async (_event, config: Partial<SkillRepositoryConfig>): Promise<void> => {
      await ensureInit();
      await skillRepositoryManager.setConfig(config);
    }
  );

  // Get repository status
  router.handle('getRepositoryStatus', async (): Promise<RepositoryStatus> => {
    await ensureInit();
    return await skillRepositoryManager.getStatus();
  });

  // Clone repository
  router.handle('cloneRepository', async (): Promise<void> => {
    await ensureInit();
    await skillRepositoryManager.clone();
  });

  // Update repository
  router.handle('updateRepository', async (): Promise<void> => {
    await ensureInit();
    await skillRepositoryManager.update();
  });

  // List official skills
  router.handle('listOfficialSkills', async (): Promise<OfficialSkill[]> => {
    await ensureInit();
    return await skillRepositoryManager.listSkills();
  });

  // Get official skill
  router.handle(
    'getOfficialSkill',
    async (_event, skillId: string): Promise<OfficialSkill | null> => {
      await ensureInit();
      return await skillRepositoryManager.getSkill(skillId);
    }
  );

  // Search official skills
  router.handle('searchOfficialSkills', async (_event, query: string): Promise<OfficialSkill[]> => {
    await ensureInit();
    return await skillRepositoryManager.searchSkills(query);
  });

  // Import skill
  router.handle('importSkill', async (_event, options: SkillImportOptions): Promise<Skill> => {
    await ensureInit();
    return await skillRepositoryManager.importSkill(options);
  });

  // Check skill updates
  router.handle(
    'checkSkillUpdates',
    async (
      _event,
      args: { skillId: string; scope: 'global' | 'project'; projectPath?: string }
    ): Promise<SkillUpdateInfo> => {
      await ensureInit();
      const { skillId, scope, projectPath } = args;
      return await skillRepositoryManager.checkUpdates(skillId, scope, projectPath);
    }
  );

  // Check all updates (batch)
  router.handle(
    'checkAllUpdates',
    async (
      _event,
      args: { scope?: 'global' | 'project'; projectPath?: string }
    ): Promise<SkillUpdateInfo[]> => {
      await ensureInit();
      // This would need to be implemented in SkillRepositoryManager
      // For now, return empty array
      return [];
    }
  );
}
