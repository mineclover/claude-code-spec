/**
 * Skills Repository Manager
 * Manages official skills repository (cloning, updating, browsing)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { parseSkillMarkdown } from '../lib/skillParser';
import type {
  SkillRepositoryConfig,
  OfficialSkill,
  RepositoryStatus,
  SkillImportOptions,
  SkillUpdateInfo,
} from '../types/skillRepository';
import type { Skill } from '../types/skill';

const execAsync = promisify(exec);

// Default configuration
const DEFAULT_CONFIG: SkillRepositoryConfig = {
  url: 'https://github.com/mineclover/skills.git',
  localPath: path.join(os.homedir(), '.claude', 'skills-repo'),
  branch: 'main',
  upstream: {
    url: 'https://github.com/anthropics/skills.git',
    branch: 'main',
  },
};

const CONFIG_FILE = path.join(os.homedir(), '.claude', 'skills-repo-config.json');
const SKILL_FILE_NAME = 'SKILL.md';

export class SkillRepositoryManager {
  private config: SkillRepositoryConfig;

  constructor() {
    this.config = DEFAULT_CONFIG;
  }

  /**
   * Initialize and load configuration
   */
  async init(): Promise<void> {
    try {
      await this.loadConfig();
    } catch (error) {
      console.log('[SkillRepositoryManager] Using default configuration');
      await this.saveConfig();
    }
  }

  /**
   * Load configuration from file
   */
  private async loadConfig(): Promise<void> {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    const saved = JSON.parse(content);
    this.config = { ...DEFAULT_CONFIG, ...saved };
  }

  /**
   * Save configuration to file
   */
  private async saveConfig(): Promise<void> {
    const dir = path.dirname(CONFIG_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  /**
   * Get current configuration
   */
  getConfig(): SkillRepositoryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async setConfig(updates: Partial<SkillRepositoryConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();
  }

  /**
   * Get repository status
   */
  async getStatus(): Promise<RepositoryStatus> {
    const exists = await this.repositoryExists();

    if (!exists) {
      return {
        exists: false,
        path: this.config.localPath,
      };
    }

    try {
      // Get current branch
      const { stdout: branch } = await execAsync('git branch --show-current', {
        cwd: this.config.localPath,
      });

      // Get last commit date
      const { stdout: lastCommit } = await execAsync('git log -1 --format=%ci', {
        cwd: this.config.localPath,
      });

      // Count skills
      const skills = await this.listSkills();

      return {
        exists: true,
        path: this.config.localPath,
        branch: branch.trim(),
        lastUpdate: new Date(lastCommit.trim()),
        skillCount: skills.length,
      };
    } catch (error) {
      console.error('[SkillRepositoryManager] Failed to get status:', error);
      return {
        exists: true,
        path: this.config.localPath,
      };
    }
  }

  /**
   * Check if repository exists locally
   */
  private async repositoryExists(): Promise<boolean> {
    try {
      const gitDir = path.join(this.config.localPath, '.git');
      await fs.access(gitDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clone the repository
   */
  async clone(): Promise<void> {
    const exists = await this.repositoryExists();
    if (exists) {
      throw new Error('Repository already exists. Use update() instead.');
    }

    console.log(`[SkillRepositoryManager] Cloning ${this.config.url}...`);

    // Ensure parent directory exists
    const parentDir = path.dirname(this.config.localPath);
    await fs.mkdir(parentDir, { recursive: true });

    // Clone repository
    await execAsync(
      `git clone --depth 1 --branch ${this.config.branch} ${this.config.url} ${this.config.localPath}`
    );

    // Add upstream if configured
    if (this.config.upstream) {
      await execAsync(`git remote add upstream ${this.config.upstream.url}`, {
        cwd: this.config.localPath,
      });
    }

    // Update last update timestamp
    this.config.lastUpdate = new Date();
    await this.saveConfig();

    console.log('[SkillRepositoryManager] Clone completed');
  }

  /**
   * Update the repository
   */
  async update(): Promise<void> {
    const exists = await this.repositoryExists();
    if (!exists) {
      throw new Error('Repository does not exist. Use clone() first.');
    }

    console.log('[SkillRepositoryManager] Updating repository...');

    // Fetch and pull
    await execAsync(`git fetch origin ${this.config.branch}`, {
      cwd: this.config.localPath,
    });
    await execAsync(`git pull origin ${this.config.branch}`, {
      cwd: this.config.localPath,
    });

    // Update last update timestamp
    this.config.lastUpdate = new Date();
    await this.saveConfig();

    console.log('[SkillRepositoryManager] Update completed');
  }

  /**
   * List all skills in the repository
   */
  async listSkills(): Promise<OfficialSkill[]> {
    const exists = await this.repositoryExists();
    if (!exists) {
      return [];
    }

    const skills: OfficialSkill[] = [];
    const entries = await fs.readdir(this.config.localPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) {
        continue;
      }

      const skillPath = path.join(this.config.localPath, entry.name);
      const skillFilePath = path.join(skillPath, SKILL_FILE_NAME);

      try {
        // Check if SKILL.md exists
        await fs.access(skillFilePath);

        // Read and parse SKILL.md
        const content = await fs.readFile(skillFilePath, 'utf-8');
        const skill = parseSkillMarkdown(content, skillFilePath, 'global');

        // List supporting files
        const files: string[] = [];
        const skillEntries = await fs.readdir(skillPath);
        for (const file of skillEntries) {
          if (file !== SKILL_FILE_NAME) {
            files.push(file);
          }
        }

        // Get last commit info for this skill
        let lastCommit;
        try {
          const { stdout: commitInfo } = await execAsync(
            `git log -1 --format="%H|%ci|%s|%an" -- ${entry.name}`,
            { cwd: this.config.localPath }
          );
          const [hash, date, message, author] = commitInfo.trim().split('|');
          lastCommit = {
            hash,
            date: new Date(date),
            message,
            author,
          };
        } catch (error) {
          console.warn(`[SkillRepositoryManager] Failed to get commit info for ${entry.name}`);
        }

        skills.push({
          id: entry.name,
          name: skill.frontmatter.name,
          description: skill.frontmatter.description,
          path: skillPath,
          content,
          files,
          source: this.config.url.includes('anthropics') ? 'official' : 'fork',
          lastCommit,
        });
      } catch (error) {
        console.warn(`[SkillRepositoryManager] Failed to parse skill ${entry.name}:`, error);
      }
    }

    return skills;
  }

  /**
   * Get a specific skill
   */
  async getSkill(skillId: string): Promise<OfficialSkill | null> {
    const skills = await this.listSkills();
    return skills.find((s) => s.id === skillId) || null;
  }

  /**
   * Search skills
   */
  async searchSkills(query: string): Promise<OfficialSkill[]> {
    const skills = await this.listSkills();
    const lowerQuery = query.toLowerCase();

    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(lowerQuery) ||
        skill.description.toLowerCase().includes(lowerQuery) ||
        skill.id.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Import a skill to local skills directory
   */
  async importSkill(options: SkillImportOptions): Promise<Skill> {
    const { skillId, scope, projectPath, customName, overwrite } = options;

    // Get skill from repository
    const officialSkill = await this.getSkill(skillId);
    if (!officialSkill) {
      throw new Error(`Skill ${skillId} not found in repository`);
    }

    // Determine destination
    const targetName = customName || skillId;
    const baseDir =
      scope === 'global'
        ? path.join(os.homedir(), '.claude', 'skills')
        : path.join(projectPath!, '.claude', 'skills');

    const targetDir = path.join(baseDir, targetName);

    // Check if already exists
    try {
      await fs.access(targetDir);
      if (!overwrite) {
        throw new Error(`Skill ${targetName} already exists in ${scope} scope`);
      }
    } catch {
      // Does not exist, OK to proceed
    }

    // Create target directory
    await fs.mkdir(targetDir, { recursive: true });

    // Copy SKILL.md
    const sourceSkillFile = path.join(officialSkill.path, SKILL_FILE_NAME);
    const targetSkillFile = path.join(targetDir, SKILL_FILE_NAME);
    await fs.copyFile(sourceSkillFile, targetSkillFile);

    // Copy supporting files
    for (const file of officialSkill.files) {
      const sourceFile = path.join(officialSkill.path, file);
      const targetFile = path.join(targetDir, file);
      await fs.copyFile(sourceFile, targetFile);
    }

    // Parse and return imported skill
    const content = await fs.readFile(targetSkillFile, 'utf-8');
    const skill = parseSkillMarkdown(content, targetSkillFile, scope);

    // Get file stats
    const stats = await fs.stat(targetSkillFile);
    skill.createdAt = stats.birthtime;
    skill.updatedAt = stats.mtime;

    console.log(`[SkillRepositoryManager] Imported skill ${skillId} as ${targetName}`);
    return skill;
  }

  /**
   * Check for updates to an installed skill
   */
  async checkUpdates(
    skillId: string,
    scope: 'global' | 'project',
    projectPath?: string
  ): Promise<SkillUpdateInfo> {
    // Get installed skill path
    const baseDir =
      scope === 'global'
        ? path.join(os.homedir(), '.claude', 'skills')
        : path.join(projectPath!, '.claude', 'skills');

    const installedPath = path.join(baseDir, skillId, SKILL_FILE_NAME);

    // Check if installed
    try {
      await fs.access(installedPath);
    } catch {
      return {
        id: skillId,
        hasUpdate: false,
      };
    }

    // Get repository version
    const repoSkill = await this.getSkill(skillId);
    if (!repoSkill) {
      return {
        id: skillId,
        hasUpdate: false,
      };
    }

    // Compare content (simple hash comparison)
    const installedContent = await fs.readFile(installedPath, 'utf-8');
    const hasUpdate = installedContent.trim() !== repoSkill.content.trim();

    return {
      id: skillId,
      current: repoSkill.lastCommit
        ? {
            hash: repoSkill.lastCommit.hash.substring(0, 7),
            date: repoSkill.lastCommit.date,
          }
        : undefined,
      available: repoSkill.lastCommit
        ? {
            hash: repoSkill.lastCommit.hash.substring(0, 7),
            date: repoSkill.lastCommit.date,
            message: repoSkill.lastCommit.message,
          }
        : undefined,
      hasUpdate,
    };
  }
}

// Singleton instance
export const skillRepositoryManager = new SkillRepositoryManager();
