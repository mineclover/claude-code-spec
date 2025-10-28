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
 * Get all marketplace skill directories from known_marketplaces.json
 */
async function getMarketplaceSkillDirs(): Promise<string[]> {
  const knownMarketplacesPath = path.join(os.homedir(), '.claude', 'plugins', 'known_marketplaces.json');
  
  try {
    const content = await fs.readFile(knownMarketplacesPath, 'utf-8');
    const marketplaces = JSON.parse(content);
    
    const skillDirs: string[] = [];
    
    // Scan all marketplaces for skill directories
    for (const [marketplaceId, marketplace] of Object.entries(marketplaces)) {
      if (marketplace && typeof marketplace === 'object' && 'installLocation' in marketplace) {
        const installLocation = (marketplace as { installLocation?: string }).installLocation;
        if (typeof installLocation === 'string') {
          // Check if this marketplace has skills
          try {
            const entries = await fs.readdir(installLocation, { withFileTypes: true });
            const hasSkills = entries.some(entry => entry.isDirectory());
            if (hasSkills) {
              skillDirs.push(installLocation);
              console.log(`[SkillHandlers] Found marketplace with skills: ${marketplaceId} at ${installLocation}`);
            }
          } catch (error) {
            // Skip if directory doesn't exist or can't be read
            console.warn(`[SkillHandlers] Skipping marketplace ${marketplaceId}: ${error}`);
          }
        }
      }
    }
    
    return skillDirs;
  } catch (error) {
    console.error('[SkillHandlers] Failed to read known_marketplaces.json:', error);
  }
  
  // Fallback to default path if no marketplaces found
  const defaultPath = path.join(os.homedir(), '.claude', 'plugins', 'marketplaces', 'anthropic-agent-skills');
  try {
    await fs.access(defaultPath);
    return [defaultPath];
  } catch {
    return [];
  }
}

/**
 * Get project skills directory path
 */
function getProjectSkillsDir(projectPath: string): string {
  return path.join(projectPath, PROJECT_SKILLS_DIR);
}

/**
 * Find skill directory path across all marketplaces
 */
async function findSkillDir(id: string, scope: 'global' | 'project', projectPath?: string): Promise<string | null> {
  if (scope === 'project' && !projectPath) {
    throw new Error('projectPath is required for project scope');
  }
  
  if (scope === 'global') {
    // Search across all marketplace directories
    const marketplaceDirs = await getMarketplaceSkillDirs();
    for (const marketplaceDir of marketplaceDirs) {
      const skillDir = path.join(marketplaceDir, id);
      try {
        await fs.access(skillDir);
        return skillDir;
      } catch {
        // Continue searching
      }
    }
    return null;
  } else {
    // Project scope - single directory
    const projectDir = getProjectSkillsDir(projectPath!);
    const skillDir = path.join(projectDir, id);
    try {
      await fs.access(skillDir);
      return skillDir;
    } catch {
      return null;
    }
  }
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
          
          if (currentScope === 'global') {
            // Search across all marketplace directories
            const marketplaceDirs = await getMarketplaceSkillDirs();
            for (const marketplaceDir of marketplaceDirs) {
              const skillDirs = await listSkillDirs(marketplaceDir);
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
          } else {
            // Project scope - single directory
            const baseDir = getProjectSkillsDir(projectPath!);
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
        const skillDir = await findSkillDir(id, scope, projectPath);
        if (!skillDir) {
          return null;
        }
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
      const skillDir = scope === 'global' 
        ? path.join(os.homedir(), '.claude', 'plugins', 'marketplaces', 'anthropic-agent-skills', skillId)
        : path.join(projectPath!, PROJECT_SKILLS_DIR, skillId);
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
        const skillDir = await findSkillDir(id, scope, projectPath);
        if (!skillDir) {
          throw new Error(`Skill ${id} not found in ${scope} scope`);
        }
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
        const skillDir = await findSkillDir(id, scope, projectPath);
        if (!skillDir) {
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

        // Scan global skills from all marketplaces
        const marketplaceDirs = await getMarketplaceSkillDirs();
        for (const marketplaceDir of marketplaceDirs) {
          const globalSkillDirs = await listSkillDirs(marketplaceDir);
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
