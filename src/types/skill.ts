/**
 * Skill data models for Claude Code Skills management
 */

export interface SkillFrontmatter {
  name: string;
  description: string;
  // Additional optional fields
  version?: string;
  author?: string;
  tags?: string[];
  [key: string]: any;
}

export interface SkillFile {
  path: string; // Relative to skill directory
  name: string;
  type: 'template' | 'example' | 'script' | 'other';
  content?: string;
  size?: number;
}

export interface Skill {
  // Identifiers
  id: string; // Unique identifier (folder name)
  scope: 'global' | 'project';

  // Paths
  path: string; // Absolute path to skill directory
  relativePath?: string; // Relative path from project root (for project skills)

  // Frontmatter
  frontmatter: SkillFrontmatter;

  // Content
  content: string; // Markdown content (without frontmatter)
  rawContent: string; // Full SKILL.md content including frontmatter

  // Metadata
  createdAt?: Date;
  updatedAt?: Date;

  // Supporting files
  files?: SkillFile[];
}

export interface SkillListItem {
  id: string;
  name: string;
  description: string;
  scope: 'global' | 'project';
  path: string;
  updatedAt?: Date;
  hasFiles: boolean; // Whether skill has supporting files
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning';
}

export interface SkillCreateInput {
  name: string;
  description: string;
  content: string;
  scope: 'global' | 'project';
  projectPath?: string; // Required for project scope
  frontmatter?: Partial<SkillFrontmatter>;
}

export interface SkillUpdateInput {
  frontmatter?: Partial<SkillFrontmatter>;
  content?: string;
}

export interface SkillScanResult {
  global: SkillListItem[];
  project: SkillListItem[];
  total: number;
}

export interface SkillExportOptions {
  destinationPath: string;
  includeFiles?: boolean;
  compress?: boolean;
}

export interface SkillImportOptions {
  sourcePath: string;
  scope: 'global' | 'project';
  projectPath?: string;
  overwrite?: boolean;
}
