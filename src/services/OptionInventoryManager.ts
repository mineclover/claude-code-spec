/**
 * Option Inventory Manager
 * Manages and validates option schemas for CLI tools
 */

import type { CLIOptionSchema } from '../types/cli-tool';
import { toolRegistry } from './ToolRegistry';

export class OptionInventoryManager {
  /**
   * Get options for a specific tool
   */
  getOptionsForTool(toolId: string): CLIOptionSchema[] {
    const tool = toolRegistry.get(toolId);
    return tool?.options ?? [];
  }

  /**
   * Validate option values against schema
   */
  validateOptions(toolId: string, values: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const options = this.getOptionsForTool(toolId);
    const errors: string[] = [];

    for (const opt of options) {
      if (opt.required && (values[opt.key] === undefined || values[opt.key] === '')) {
        errors.push(`Required option "${opt.label}" is missing`);
      }

      const value = values[opt.key];
      if (value !== undefined && value !== '') {
        switch (opt.type) {
          case 'number':
            if (typeof value !== 'number' && Number.isNaN(Number(value))) {
              errors.push(`"${opt.label}" must be a number`);
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean') {
              errors.push(`"${opt.label}" must be a boolean`);
            }
            break;
          case 'select':
            if (opt.choices && !opt.choices.some(c => c.value === value)) {
              errors.push(`"${opt.label}" has an invalid selection`);
            }
            break;
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Build CLI arguments from option values
   */
  buildArgs(toolId: string, values: Record<string, unknown>): Record<string, unknown> {
    const options = this.getOptionsForTool(toolId);
    const args: Record<string, unknown> = {};

    for (const opt of options) {
      const value = values[opt.key];
      if (value !== undefined && value !== '' && value !== opt.defaultValue) {
        args[opt.key] = value;
      }
    }

    return args;
  }
}

export const optionInventoryManager = new OptionInventoryManager();
