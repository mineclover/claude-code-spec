/**
 * Skill-related IPC handlers
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  ensureDirectory,
  fileExists,
  readMarkdownFile,
  writeMarkdownFile,
} from '../../lib/fileLoader';
import { parseSkillMarkdown, serializeSkill, validateSkillStructure } from '../../lib/skillParser';
import type {
  Skill,
  SkillCreateInput,
  SkillFile,
  SkillListItem,
  SkillScanResult,
  SkillUpdateInput,
  ValidationResult,
} from '../../types/skill';
import type { IPCRouter } from '../IPCRouter';

const PROJECT_SKILLS_DIR = '.claude/skills';
const SKILL_FILE_NAME = 'SKILL.md';

/**
 * Get global skills directory path
 */
function getGlobalSkillsDir(): string {
  return path.join(os.homedir(), '.claude', 'skills');
}

/**
 * Get project skills directory path
 */
function getProjectSkillsDir(projectPath: string): string {
  return path.join(projectPath, PROJECT_SKILLS_DIR);
}

/**
 * Get skill directory path
 */
function getSkillDir(id: string, scope: 'global' | 'project', projectPath?: string): string {
  if (scope === 'project' && !projectPath) {
    throw new Error('projectPath is required for project scope');
  }
  const baseDir = scope === 'global' ? getGlobalSkillsDir() : getProjectSkillsDir(projectPath);
  return path.join(baseDir, id);
}

/**
 * List skill directories in a given path
 */
async function listSkillDirs(baseDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    const skillDirs: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillFilePath = path.join(baseDir, entry.name, SKILL_FILE_NAME);
        if (await fileExists(skillFilePath)) {
          skillDirs.push(path.join(baseDir, entry.name));
        }
      }
    }

    return skillDirs;
  } catch (error) {
    console.error(`[SkillHandlers] Failed to list skill directories:`, error);
    return [];
  }
}

/**
 * Read skill from directory
 */
async function readSkill(skillDir: string, scope: 'global' | 'project'): Promise<Skill | null> {
  try {
    const skillFilePath = path.join(skillDir, SKILL_FILE_NAME);
    const content = await readMarkdownFile(skillFilePath);

    if (!content) {
      return null;
    }

    const skill = parseSkillMarkdown(content, skillFilePath, scope);

    // Read file stats
    const stats = await fs.stat(skillFilePath);
    skill.createdAt = stats.birthtime;
    skill.updatedAt = stats.mtime;

    // Check for supporting files
    const entries = await fs.readdir(skillDir, { withFileTypes: true });
    const files: SkillFile[] = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name !== SKILL_FILE_NAME) {
        const filePath = path.join(skillDir, entry.name);
        const stats = await fs.stat(filePath);
        files.push({
          path: entry.name,
          name: entry.name,
          type: detectFileType(entry.name),
          size: stats.size,
        });
      }
    }

    skill.files = files;

    return skill;
  } catch (error) {
    console.error(`[SkillHandlers] Failed to read skill from ${skillDir}:`, error);
    return null;
  }
}

/**
 * Detect file type from filename
 */
function detectFileType(filename: string): SkillFile['type'] {
  if (filename.includes('template')) return 'template';
  if (filename.includes('example')) return 'example';
  if (filename.endsWith('.sh') || filename.endsWith('.js') || filename.endsWith('.py'))
    return 'script';
  return 'other';
}

/**
 * Register skill-related IPC handlers
 */
export function registerSkillHandlers(router: IPCRouter): void {
  // List all skills
  router.handle(
    'listSkills',
    async (
      _event,
      args: { scope?: 'global' | 'project'; projectPath?: string },
    ): Promise<SkillListItem[]> => {
      const { scope, projectPath } = args;
      console.log('[SkillHandlers] listSkills called with:', { scope, projectPath });

      try {
        const skills: SkillListItem[] = [];

        // Determine which scopes to scan
        const scopes: Array<'global' | 'project'> = scope ? [scope] : ['global', 'project'];

        for (const currentScope of scopes) {
          if (currentScope === 'project' && !projectPath) {
            console.warn('[SkillHandlers] Skipping project scope - no projectPath provided');
            continue;
          }
          const baseDir =
            currentScope === 'global' ? getGlobalSkillsDir() : getProjectSkillsDir(projectPath);

          const skillDirs = await listSkillDirs(baseDir);

          for (const skillDir of skillDirs) {
            const skill = await readSkill(skillDir, currentScope);
            if (skill) {
              skills.push({
                id: skill.id,
                name: skill.frontmatter.name,
                description: skill.frontmatter.description,
                scope: currentScope,
                path: skill.path,
                updatedAt: skill.updatedAt,
                hasFiles: (skill.files?.length || 0) > 0,
              });
            }
          }
        }

        // Sort by updated date (newest first)
        skills.sort((a, b) => {
          if (!a.updatedAt) return 1;
          if (!b.updatedAt) return -1;
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        });

        console.log(`[SkillHandlers] Found ${skills.length} skills`);
        return skills;
      } catch (error) {
        console.error('[SkillHandlers] Failed to list skills:', error);
        return [];
      }
    },
  );

  // Get a single skill
  router.handle(
    'getSkill',
    async (
      _event,
      args: { id: string; scope: 'global' | 'project'; projectPath?: string },
    ): Promise<Skill | null> => {
      const { id, scope, projectPath } = args;
      console.log('[SkillHandlers] getSkill called with:', { id, scope, projectPath });

      try {
        const skillDir = getSkillDir(id, scope, projectPath);
        return await readSkill(skillDir, scope);
      } catch (error) {
        console.error(`[SkillHandlers] Failed to get skill ${id}:`, error);
        return null;
      }
    },
  );

  // Create a new skill
  router.handle('createSkill', async (_event, input: SkillCreateInput): Promise<Skill> => {
    const { name, description, content, scope, projectPath, frontmatter } = input;
    console.log('[SkillHandlers] createSkill called with:', { name, scope });

    try {
      // Generate skill ID from name (lowercase, hyphens only)
      const skillId = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // Prepare skill directory
      const skillDir = getSkillDir(skillId, scope, projectPath);
      await ensureDirectory(skillDir);

      // Check if skill already exists
      const skillFilePath = path.join(skillDir, SKILL_FILE_NAME);
      if (await fileExists(skillFilePath)) {
        throw new Error(`Skill ${skillId} already exists in ${scope} scope`);
      }

      // Create skill object
      const skill: Partial<Skill> = {
        id: skillId,
        scope,
        path: skillFilePath,
        frontmatter: {
          name,
          description,
          ...frontmatter,
        },
        content: content || '',
      };

      // Serialize and write to file
      const serialized = serializeSkill(skill);
      await writeMarkdownFile(skillFilePath, serialized);

      // Read back the created skill
      const createdSkill = await readSkill(skillDir, scope);
      if (!createdSkill) {
        throw new Error('Failed to read created skill');
      }

      console.log(`[SkillHandlers] Created skill: ${skillId}`);
      return createdSkill;
    } catch (error) {
      console.error('[SkillHandlers] Failed to create skill:', error);
      throw error;
    }
  });

  // Update an existing skill
  router.handle(
    'updateSkill',
    async (
      _event,
      args: {
        id: string;
        updates: SkillUpdateInput;
        scope: 'global' | 'project';
        projectPath?: string;
      },
    ): Promise<Skill> => {
      const { id, updates, scope, projectPath } = args;
      console.log('[SkillHandlers] updateSkill called with:', { id, scope });

      try {
        // Read existing skill
        const skillDir = getSkillDir(id, scope, projectPath);
        const existingSkill = await readSkill(skillDir, scope);

        if (!existingSkill) {
          throw new Error(`Skill ${id} not found in ${scope} scope`);
        }

        // Merge updates
        const updatedSkill: Partial<Skill> = {
          ...existingSkill,
          frontmatter: {
            ...existingSkill.frontmatter,
            ...updates.frontmatter,
          },
          content: updates.content !== undefined ? updates.content : existingSkill.content,
        };

        // Serialize and write to file
        const serialized = serializeSkill(updatedSkill);
        const skillFilePath = path.join(skillDir, SKILL_FILE_NAME);
        await writeMarkdownFile(skillFilePath, serialized);

        // Read back the updated skill
        const updatedSkillResult = await readSkill(skillDir, scope);
        if (!updatedSkillResult) {
          throw new Error('Failed to read updated skill');
        }

        console.log(`[SkillHandlers] Updated skill: ${id}`);
        return updatedSkillResult;
      } catch (error) {
        console.error('[SkillHandlers] Failed to update skill:', error);
        throw error;
      }
    },
  );

  // Delete a skill
  router.handle(
    'deleteSkill',
    async (
      _event,
      args: { id: string; scope: 'global' | 'project'; projectPath?: string },
    ): Promise<void> => {
      const { id, scope, projectPath } = args;
      console.log('[SkillHandlers] deleteSkill called with:', { id, scope });

      try {
        const skillDir = getSkillDir(id, scope, projectPath);

        // Check if skill exists
        if (!(await fileExists(skillDir))) {
          throw new Error(`Skill ${id} not found in ${scope} scope`);
        }

        // Delete entire skill directory
        await fs.rm(skillDir, { recursive: true, force: true });

        console.log(`[SkillHandlers] Deleted skill: ${id}`);
      } catch (error) {
        console.error('[SkillHandlers] Failed to delete skill:', error);
        throw error;
      }
    },
  );

  // Scan for all skills
  router.handle(
    'scanSkills',
    async (_event, args: { projectPath?: string }): Promise<SkillScanResult> => {
      const { projectPath } = args;
      console.log('[SkillHandlers] scanSkills called with:', { projectPath });

      try {
        const global: SkillListItem[] = [];
        const project: SkillListItem[] = [];

        // Scan global skills
        const globalDir = getGlobalSkillsDir();
        const globalSkillDirs = await listSkillDirs(globalDir);

        for (const skillDir of globalSkillDirs) {
          const skill = await readSkill(skillDir, 'global');
          if (skill) {
            global.push({
              id: skill.id,
              name: skill.frontmatter.name,
              description: skill.frontmatter.description,
              scope: 'global',
              path: skill.path,
              updatedAt: skill.updatedAt,
              hasFiles: (skill.files?.length || 0) > 0,
            });
          }
        }

        // Scan project skills if projectPath provided
        if (projectPath) {
          const projectDir = getProjectSkillsDir(projectPath);
          const projectSkillDirs = await listSkillDirs(projectDir);

          for (const skillDir of projectSkillDirs) {
            const skill = await readSkill(skillDir, 'project');
            if (skill) {
              project.push({
                id: skill.id,
                name: skill.frontmatter.name,
                description: skill.frontmatter.description,
                scope: 'project',
                path: skill.path,
                updatedAt: skill.updatedAt,
                hasFiles: (skill.files?.length || 0) > 0,
              });
            }
          }
        }

        const result: SkillScanResult = {
          global,
          project,
          total: global.length + project.length,
        };

        console.log(`[SkillHandlers] Scanned ${result.total} skills`);
        return result;
      } catch (error) {
        console.error('[SkillHandlers] Failed to scan skills:', error);
        throw error;
      }
    },
  );

  // Validate skill structure
  router.handle(
    'validateSkill',
    async (_event, input: SkillCreateInput | SkillUpdateInput): Promise<ValidationResult> => {
      console.log('[SkillHandlers] validateSkill called');

      try {
        // Build test skill content
        const testSkill: Partial<Skill> = {
          frontmatter:
            'frontmatter' in input && input.frontmatter
              ? input.frontmatter
              : { name: '', description: '' },
          content: input.content || '',
        } as Partial<Skill>;

        const serialized = serializeSkill(testSkill);
        const validation = validateSkillStructure(serialized);

        return {
          valid: validation.valid,
          errors: validation.errors.map((msg) => ({
            field: 'general',
            message: msg,
            severity: 'error' as const,
          })),
          warnings: [],
        };
      } catch (error) {
        return {
          valid: false,
          errors: [
            {
              field: 'general',
              message: error instanceof Error ? error.message : String(error),
              severity: 'error' as const,
            },
          ],
          warnings: [],
        };
      }
    },
  );
}
