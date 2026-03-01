/**
 * Parser for SKILL.md files
 */

import type { Skill, SkillFrontmatter } from '../types/skill';

/**
 * Simple YAML parser for frontmatter (supports basic key-value pairs and arrays)
 */
function parseYaml(yamlText: string): Record<string, string | string[] | number | boolean> {
  const result: Record<string, string | string[] | number | boolean> = {};
  const lines = yamlText.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Array item
    if (trimmed.startsWith('- ')) {
      if (currentArray && currentKey) {
        currentArray.push(trimmed.substring(2).trim());
      }
      continue;
    }

    // Key-value pair
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();

      if (!value || value === '') {
        // Start of array
        currentKey = key;
        currentArray = [];
        result[key] = currentArray;
      } else {
        // Simple value
        result[key] = value;
        currentKey = null;
        currentArray = null;
      }
    }
  }

  return result;
}

/**
 * Simple YAML stringifier for frontmatter
 */
function stringifyYaml(obj: Record<string, string | string[] | number | boolean>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

interface ParsedSkillData {
  frontmatter: SkillFrontmatter;
  content: string;
  rawContent: string;
}

/**
 * Parse SKILL.md markdown content and extract frontmatter and content
 */
export function parseSkillMarkdown(
  rawContent: string,
  filePath: string,
  scope: 'global' | 'project',
): Skill {
  const { frontmatter, content } = parseFrontmatter(rawContent);

  // Extract skill ID from file path
  const skillId = extractSkillId(filePath);

  // Get file stats if available
  const now = new Date();

  return {
    id: skillId,
    scope,
    path: filePath,
    frontmatter,
    content,
    rawContent,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content: string): ParsedSkillData {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    throw new Error('Invalid SKILL.md format: missing frontmatter');
  }

  const [, frontmatterText, markdownContent] = frontmatterMatch;

  let frontmatter: SkillFrontmatter;
  try {
    frontmatter = parseYaml(frontmatterText) as SkillFrontmatter;
  } catch (error) {
    throw new Error(`Failed to parse frontmatter YAML: ${error}`);
  }

  // Validate required fields
  if (!frontmatter.name) {
    throw new Error('SKILL.md frontmatter must include "name" field');
  }

  if (!frontmatter.description) {
    throw new Error('SKILL.md frontmatter must include "description" field');
  }

  return {
    frontmatter,
    content: markdownContent.trim(),
    rawContent: content,
  };
}

/**
 * Extract skill ID from file path
 * e.g., "/path/to/skills/my-skill/SKILL.md" -> "my-skill"
 */
function extractSkillId(filePath: string): string {
  const parts = filePath.split('/');
  // Find SKILL.md and get the parent directory name
  const skillMdIndex = parts.indexOf('SKILL.md');
  if (skillMdIndex > 0) {
    return parts[skillMdIndex - 1];
  }
  // Fallback: return last directory name
  return parts[parts.length - 2] || 'unknown';
}

/**
 * Serialize skill to SKILL.md format
 */
export function serializeSkill(skill: Partial<Skill>): string {
  const { frontmatter, content } = skill;

  if (!frontmatter) {
    throw new Error('Cannot serialize skill without frontmatter');
  }

  // Remove undefined values from frontmatter
  const cleanedFrontmatter = Object.fromEntries(
    Object.entries(frontmatter).filter(([, value]) => value !== undefined),
  );

  const yamlFrontmatter = stringifyYaml(
    cleanedFrontmatter as Record<string, string | number | boolean | string[]>,
  );
  const markdown = content || '';

  return `---\n${yamlFrontmatter}\n---\n${markdown}\n`;
}

/**
 * Validate skill structure
 */
export function validateSkillStructure(content: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    const { frontmatter } = parseFrontmatter(content);

    if (!frontmatter.name || frontmatter.name.trim() === '') {
      errors.push('Frontmatter "name" field is required and cannot be empty');
    }

    if (!frontmatter.description || frontmatter.description.trim() === '') {
      errors.push('Frontmatter "description" field is required and cannot be empty');
    }

    // Validate name format (lowercase, hyphens only)
    if (frontmatter.name && !/^[a-z0-9-]+$/.test(frontmatter.name)) {
      errors.push('Frontmatter "name" should only contain lowercase letters, numbers, and hyphens');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      valid: false,
      errors,
    };
  }
}
