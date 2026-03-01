/**
 * TaskValidator - Validates task definitions for correctness and completeness
 *
 * Checks:
 * - Frontmatter structure and required fields
 * - Section presence and format
 * - Reference validity
 * - Success criteria format
 * - Task dependencies
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Task } from '../types/task';
import { parseTaskMarkdown } from './taskParser';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export class TaskValidator {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Validate task from markdown content
   */
  async validateTaskContent(content: string, taskId?: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    try {
      // 1. Parse task
      const task = parseTaskMarkdown(content);

      // 2. Validate metadata
      this.validateMetadata(task, taskId, errors, warnings);

      // 3. Validate references
      await this.validateReferences(task.references, errors, warnings);

      // 4. Validate success criteria
      this.validateSuccessCriteria(task.successCriteria, errors, warnings);

      // 5. Validate description
      this.validateDescription(task.description, errors, warnings);
    } catch (error) {
      errors.push({
        field: 'structure',
        message: `Failed to parse task: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate task file
   */
  async validateTaskFile(taskFilePath: string): Promise<ValidationResult> {
    try {
      const content = await fs.readFile(taskFilePath, 'utf-8');
      const taskId = path.basename(taskFilePath, '.md');
      return await this.validateTaskContent(content, taskId);
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            field: 'file',
            message: `Failed to read task file: ${error instanceof Error ? error.message : String(error)}`,
            severity: 'error',
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Validate all tasks in workflow/tasks directory
   */
  async validateAllTasks(): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();
    const tasksDir = path.join(this.projectPath, 'workflow', 'tasks');

    try {
      const files = await fs.readdir(tasksDir);
      const taskFiles = files.filter((f) => f.endsWith('.md'));

      for (const file of taskFiles) {
        const filePath = path.join(tasksDir, file);
        const result = await this.validateTaskFile(filePath);
        results.set(file, result);
      }
    } catch (_error) {
      // Directory might not exist, return empty results
    }

    return results;
  }

  /**
   * Validate task metadata
   */
  private validateMetadata(
    task: Task,
    expectedId: string | undefined,
    errors: ValidationError[],
    warnings: ValidationError[],
  ): void {
    // Required fields
    if (!task.id) {
      errors.push({ field: 'id', message: 'Task ID is required', severity: 'error' });
    } else if (expectedId && task.id !== expectedId) {
      warnings.push({
        field: 'id',
        message: `Task ID '${task.id}' does not match filename '${expectedId}'`,
        severity: 'warning',
      });
    }

    if (!task.title || task.title.trim().length === 0) {
      errors.push({ field: 'title', message: 'Task title is required', severity: 'error' });
    }

    if (!task.area || task.area.trim().length === 0) {
      errors.push({ field: 'area', message: 'Work area is required', severity: 'error' });
    }

    if (!task.assigned_agent || task.assigned_agent.trim().length === 0) {
      errors.push({
        field: 'assigned_agent',
        message: 'Assigned agent is required',
        severity: 'error',
      });
    }

    // Status validation
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(task.status)) {
      errors.push({
        field: 'status',
        message: `Invalid status '${task.status}'. Must be one of: ${validStatuses.join(', ')}`,
        severity: 'error',
      });
    }

    // Timestamp validation
    if (task.created) {
      try {
        new Date(task.created);
      } catch {
        errors.push({
          field: 'created',
          message: `Invalid created timestamp '${task.created}'`,
          severity: 'error',
        });
      }
    }

    if (task.updated) {
      try {
        new Date(task.updated);
      } catch {
        errors.push({
          field: 'updated',
          message: `Invalid updated timestamp '${task.updated}'`,
          severity: 'error',
        });
      }
    }

    // Reviewer format (optional but should be valid if present)
    if (task.reviewer) {
      const isHumanReviewer = task.reviewer.startsWith('human:');
      const isAgentReviewer = /^[a-z0-9-]+$/.test(task.reviewer);

      if (!isHumanReviewer && !isAgentReviewer) {
        warnings.push({
          field: 'reviewer',
          message: `Reviewer should be either 'human:email' or 'agent-name' format`,
          severity: 'warning',
        });
      }
    }
  }

  /**
   * Validate references
   */
  private async validateReferences(
    references: string[],
    _errors: ValidationError[],
    warnings: ValidationError[],
  ): Promise<void> {
    if (references.length === 0) {
      warnings.push({
        field: 'references',
        message: 'No references specified. Consider adding relevant files or docs.',
        severity: 'warning',
      });
      return;
    }

    for (const ref of references) {
      // Skip URLs and @context references
      if (ref.startsWith('http') || ref.startsWith('@context')) {
        continue;
      }

      // Check if file exists
      const refPath = path.join(this.projectPath, ref);
      try {
        await fs.access(refPath);
      } catch {
        warnings.push({
          field: 'references',
          message: `Referenced file not found: ${ref}`,
          severity: 'warning',
        });
      }
    }
  }

  /**
   * Validate success criteria
   */
  private validateSuccessCriteria(
    criteria: string[],
    errors: ValidationError[],
    warnings: ValidationError[],
  ): void {
    if (criteria.length === 0) {
      errors.push({
        field: 'successCriteria',
        message: 'At least one success criterion is required',
        severity: 'error',
      });
      return;
    }

    // Check criteria format (should start with [ ] or [x])
    for (const criterion of criteria) {
      if (!criterion.match(/^\[([ x])\]/)) {
        warnings.push({
          field: 'successCriteria',
          message: `Criterion should start with [ ] or [x]: ${criterion}`,
          severity: 'warning',
        });
      }

      // Check for vague criteria
      const lowerCriterion = criterion.toLowerCase();
      const vagueTerms = ['works', 'looks good', 'is done', 'completed'];

      for (const term of vagueTerms) {
        if (lowerCriterion.includes(term) && !lowerCriterion.includes('test')) {
          warnings.push({
            field: 'successCriteria',
            message: `Criterion may be too vague: ${criterion}`,
            severity: 'warning',
          });
          break;
        }
      }
    }
  }

  /**
   * Validate description
   */
  private validateDescription(
    description: string,
    errors: ValidationError[],
    warnings: ValidationError[],
  ): void {
    if (!description || description.trim().length === 0) {
      errors.push({
        field: 'description',
        message: 'Task description is required',
        severity: 'error',
      });
      return;
    }

    // Warn if description is too short
    if (description.trim().length < 50) {
      warnings.push({
        field: 'description',
        message: 'Description is quite short. Consider adding more context.',
        severity: 'warning',
      });
    }

    // Warn if description is very long (might need splitting)
    if (description.trim().length > 2000) {
      warnings.push({
        field: 'description',
        message: 'Description is very long. Consider breaking this into multiple tasks.',
        severity: 'warning',
      });
    }
  }

  /**
   * Quick validation check (returns true if valid, false otherwise)
   */
  async isValid(content: string): Promise<boolean> {
    const result = await this.validateTaskContent(content);
    return result.valid;
  }

  /**
   * Get validation summary
   */
  static formatValidationResult(result: ValidationResult): string {
    const lines: string[] = [];

    if (result.valid) {
      lines.push('✓ Task is valid');
    } else {
      lines.push('✗ Task validation failed');
    }

    if (result.errors.length > 0) {
      lines.push('\nErrors:');
      for (const error of result.errors) {
        lines.push(`  - [${error.field}] ${error.message}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push('\nWarnings:');
      for (const warning of result.warnings) {
        lines.push(`  - [${warning.field}] ${warning.message}`);
      }
    }

    return lines.join('\n');
  }
}
