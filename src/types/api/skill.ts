/**
 * Skill API types for IPC communication between renderer and main process
 */

import type {
  Skill,
  SkillCreateInput,
  SkillExportOptions,
  SkillFile,
  SkillImportOptions,
  SkillListItem,
  SkillScanResult,
  SkillUpdateInput,
  ValidationResult,
} from '../skill';

export interface SkillAPI {
  // CRUD operations
  listSkills: (scope?: 'global' | 'project', projectPath?: string) => Promise<SkillListItem[]>;
  getSkill: (
    id: string,
    scope: 'global' | 'project',
    projectPath?: string,
  ) => Promise<Skill | null>;
  createSkill: (input: SkillCreateInput) => Promise<Skill>;
  updateSkill: (
    id: string,
    updates: SkillUpdateInput,
    scope: 'global' | 'project',
    projectPath?: string,
  ) => Promise<Skill>;
  deleteSkill: (id: string, scope: 'global' | 'project', projectPath?: string) => Promise<void>;

  // Utility operations
  scanSkills: (projectPath?: string) => Promise<SkillScanResult>;
  validateSkill: (input: SkillCreateInput | SkillUpdateInput) => Promise<ValidationResult>;
  exportSkill: (
    id: string,
    scope: 'global' | 'project',
    options: SkillExportOptions,
  ) => Promise<string>;
  importSkill: (options: SkillImportOptions) => Promise<Skill>;

  // File operations
  listSkillFiles: (
    id: string,
    scope: 'global' | 'project',
    projectPath?: string,
  ) => Promise<SkillFile[]>;
  getSkillFile: (
    id: string,
    fileName: string,
    scope: 'global' | 'project',
    projectPath?: string,
  ) => Promise<string>;
  updateSkillFile: (
    id: string,
    fileName: string,
    content: string,
    scope: 'global' | 'project',
    projectPath?: string,
  ) => Promise<void>;
  deleteSkillFile: (
    id: string,
    fileName: string,
    scope: 'global' | 'project',
    projectPath?: string,
  ) => Promise<void>;

  // Watch for changes
  onSkillChanged: (callback: (skill: Skill) => void) => () => void;
  onSkillDeleted: (callback: (id: string, scope: 'global' | 'project') => void) => () => void;
}
