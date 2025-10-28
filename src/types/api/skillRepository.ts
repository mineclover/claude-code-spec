/**
 * Skills Repository API types
 */

import type { Skill } from '../skill';
import type {
  OfficialSkill,
  RepositoryStatus,
  SkillImportOptions,
  SkillRepositoryConfig,
  SkillSyncOptions,
  SkillUpdateInfo,
} from '../skillRepository';

export interface SkillRepositoryAPI {
  // Repository management
  getRepositoryConfig: () => Promise<SkillRepositoryConfig>;
  setRepositoryConfig: (config: Partial<SkillRepositoryConfig>) => Promise<void>;
  getRepositoryStatus: () => Promise<RepositoryStatus>;

  // Clone and update
  cloneRepository: () => Promise<void>;
  updateRepository: () => Promise<void>;

  // Browse official skills
  listOfficialSkills: () => Promise<OfficialSkill[]>;
  getOfficialSkill: (skillId: string) => Promise<OfficialSkill | null>;
  searchOfficialSkills: (query: string) => Promise<OfficialSkill[]>;

  // Import skills
  importSkill: (options: SkillImportOptions) => Promise<Skill>;

  // Update management
  checkSkillUpdates: (
    skillId: string,
    scope: 'global' | 'project',
    projectPath?: string,
  ) => Promise<SkillUpdateInfo>;
  syncSkill: (options: SkillSyncOptions) => Promise<Skill>;

  // Batch operations
  checkAllUpdates: (
    scope?: 'global' | 'project',
    projectPath?: string,
  ) => Promise<SkillUpdateInfo[]>;

  // Events
  onRepositoryUpdated: (callback: () => void) => () => void;
}
