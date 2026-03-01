/**
 * Tool Registry - manages registered CLI tool definitions
 */

import { getRegisteredInterpreterTypes } from '../interpreters';
import type { CLICommandSegment, CLIToolDefinition } from '../types/cli-tool';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export class ToolRegistry {
  private tools = new Map<string, CLIToolDefinition>();

  private invalid(path: string, toolId: string, message: string): never {
    throw new Error(`Tool registration failed (${toolId}): ${path} ${message}`);
  }

  private validateSegment(segment: CLICommandSegment, path: string, toolId: string): void {
    if (segment.type === 'static') {
      if (!Array.isArray(segment.args) || segment.args.some((arg) => !isNonEmptyString(arg))) {
        this.invalid(path, toolId, '.args must be an array of non-empty strings');
      }
      return;
    }

    if (segment.type === 'option') {
      if (!isNonEmptyString(segment.key)) {
        this.invalid(path, toolId, '.key must be a non-empty string');
      }
      if (segment.flag !== undefined && !isNonEmptyString(segment.flag)) {
        this.invalid(path, toolId, '.flag must be a non-empty string');
      }
      return;
    }

    if (segment.type === 'mapped') {
      if (!isNonEmptyString(segment.key)) {
        this.invalid(path, toolId, '.key must be a non-empty string');
      }

      if (!segment.map || typeof segment.map !== 'object') {
        this.invalid(path, toolId, '.map must be an object');
      }

      for (const [mapKey, mapArgs] of Object.entries(segment.map)) {
        if (!Array.isArray(mapArgs) || mapArgs.some((arg) => !isNonEmptyString(arg))) {
          this.invalid(path, toolId, `.map["${mapKey}"] must be an array of non-empty strings`);
        }
      }
      return;
    }

    if (!Array.isArray(segment.segments) || segment.segments.length === 0) {
      this.invalid(path, toolId, '.segments must be a non-empty array');
    }

    if (segment.type === 'conditional') {
      for (let index = 0; index < segment.segments.length; index += 1) {
        this.validateSegment(segment.segments[index], `${path}.segments[${index}]`, toolId);
      }
      return;
    }

    if (segment.type === 'fallback') {
      for (let index = 0; index < segment.segments.length; index += 1) {
        this.validateSegment(segment.segments[index], `${path}.segments[${index}]`, toolId);
      }
    }
  }

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
      this.validateSegment(commandSpec.segments[index], `commandSpec.segments[${index}]`, tool.id);
    }
  }
}

export const toolRegistry = new ToolRegistry();
