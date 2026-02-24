/**
 * Tool Registry - manages registered CLI tool definitions
 */

import { getRegisteredInterpreterTypes } from '../interpreters';
import type { CLIToolDefinition } from '../types/cli-tool';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export class ToolRegistry {
  private tools = new Map<string, CLIToolDefinition>();

  register(tool: CLIToolDefinition): void {
    this.validate(tool);
    this.tools.set(tool.id, tool);
    console.log(`[ToolRegistry] Registered tool: ${tool.id} (${tool.name})`);
  }

  get(toolId: string): CLIToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  getAll(): CLIToolDefinition[] {
    return Array.from(this.tools.values());
  }

  has(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  unregister(toolId: string): boolean {
    return this.tools.delete(toolId);
  }

  private validate(tool: CLIToolDefinition): void {
    if (!isNonEmptyString(tool.id)) {
      throw new Error('Tool registration failed: "id" must be a non-empty string');
    }

    if (this.tools.has(tool.id)) {
      throw new Error(`Tool registration failed: duplicate tool id "${tool.id}"`);
    }

    if (!isNonEmptyString(tool.name)) {
      throw new Error(`Tool registration failed (${tool.id}): "name" must be a non-empty string`);
    }

    if (!isNonEmptyString(tool.interpreterType)) {
      throw new Error(
        `Tool registration failed (${tool.id}): "interpreterType" must be a non-empty string`,
      );
    }

    const interpreterTypes = new Set(getRegisteredInterpreterTypes());
    if (!interpreterTypes.has(tool.interpreterType)) {
      throw new Error(
        `Tool registration failed (${tool.id}): interpreter "${tool.interpreterType}" is not registered`,
      );
    }

    const { commandSpec } = tool;
    if (!isNonEmptyString(commandSpec.executable)) {
      throw new Error(
        `Tool registration failed (${tool.id}): commandSpec.executable must be a non-empty string`,
      );
    }

    if (!Array.isArray(commandSpec.segments)) {
      throw new Error(
        `Tool registration failed (${tool.id}): commandSpec.segments must be an array`,
      );
    }

    for (let index = 0; index < commandSpec.segments.length; index += 1) {
      const segment = commandSpec.segments[index];
      const path = `commandSpec.segments[${index}]`;

      if (segment.type === 'static') {
        if (!Array.isArray(segment.args) || segment.args.some((arg) => !isNonEmptyString(arg))) {
          throw new Error(
            `Tool registration failed (${tool.id}): ${path}.args must be an array of non-empty strings`,
          );
        }
        continue;
      }

      if (segment.type === 'option') {
        if (!isNonEmptyString(segment.key)) {
          throw new Error(
            `Tool registration failed (${tool.id}): ${path}.key must be a non-empty string`,
          );
        }
        if (segment.flag !== undefined && !isNonEmptyString(segment.flag)) {
          throw new Error(
            `Tool registration failed (${tool.id}): ${path}.flag must be a non-empty string`,
          );
        }
        continue;
      }

      if (segment.type === 'mapped') {
        if (!isNonEmptyString(segment.key)) {
          throw new Error(
            `Tool registration failed (${tool.id}): ${path}.key must be a non-empty string`,
          );
        }

        if (!segment.map || typeof segment.map !== 'object') {
          throw new Error(`Tool registration failed (${tool.id}): ${path}.map must be an object`);
        }

        for (const [mapKey, mapArgs] of Object.entries(segment.map)) {
          if (!Array.isArray(mapArgs) || mapArgs.some((arg) => !isNonEmptyString(arg))) {
            throw new Error(
              `Tool registration failed (${tool.id}): ${path}.map["${mapKey}"] must be an array of non-empty strings`,
            );
          }
        }
      }
    }
  }
}

export const toolRegistry = new ToolRegistry();
