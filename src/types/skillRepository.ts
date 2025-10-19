/**
 * Skills Repository data models
 */

export interface SkillRepositoryConfig {
  // Git repository URL
  url: string;
  // Local clone path
  localPath: string;
  // Branch to track
  branch: string;
  // Last update timestamp
  lastUpdate?: Date;
  // Upstream repository (for syncing with original)
  upstream?: {
    url: string;
    branch: string;
  };
}

export interface OfficialSkill {
  // Skill identifier (directory name)
  id: string;
  // Skill name from frontmatter
  name: string;
  // Description from frontmatter
  description: string;
  // Full path in repository
  path: string;
  // SKILL.md content
  content: string;
  // Supporting files
  files: string[];
  // Repository source
  source: 'official' | 'fork';
  // Git info
  lastCommit?: {
    hash: string;
    date: Date;
    message: string;
    author: string;
  };
}

export interface SkillUpdateInfo {
  // Skill ID
  id: string;
  // Current version info
  current?: {
    hash: string;
    date: Date;
  };
  // Available version info
  available?: {
    hash: string;
    date: Date;
    message: string;
  };
  // Has updates available
  hasUpdate: boolean;
  // Changes summary
  changes?: string[];
}

export interface RepositoryStatus {
  // Repository exists locally
  exists: boolean;
  // Local path
  path: string;
  // Current branch
  branch?: string;
  // Last update
  lastUpdate?: Date;
  // Number of skills
  skillCount?: number;
  // Ahead/behind upstream
  sync?: {
    ahead: number;
    behind: number;
  };
}

export interface SkillImportOptions {
  // Skill ID to import
  skillId: string;
  // Target scope
  scope: 'global' | 'project';
  // Project path (for project scope)
  projectPath?: string;
  // Custom name (optional, defaults to original)
  customName?: string;
  // Overwrite if exists
  overwrite?: boolean;
}

export interface SkillSyncOptions {
  // Skill ID to sync
  skillId: string;
  // Scope where skill is installed
  scope: 'global' | 'project';
  // Project path (for project scope)
  projectPath?: string;
  // Merge strategy
  strategy: 'overwrite' | 'merge' | 'keep-local';
}
