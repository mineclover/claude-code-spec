/**
 * Session Interpreter Service
 * Dispatches stream parsing to the correct interpreter based on toolId
 */

import { getInterpreter } from '../interpreters';
import type { StreamEvent } from '../types/stream-events';
import { composeCliCommand, getCliStdinInput } from './CliCommandComposer';
import { toolRegistry } from './ToolRegistry';

export class SessionInterpreterService {
  private getTool(toolId: string) {
    const tool = toolRegistry.get(toolId);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolId}`);
    }
    return tool;
  }

  /**
   * Parse a single stream line using the appropriate interpreter
   */
  parseLine(toolId: string, line: string): StreamEvent | null {
    const tool = this.getTool(toolId);
    const interpreter = getInterpreter(tool.interpreterType);
    if (!interpreter) {
      console.warn(
        `[SessionInterpreterService] No interpreter for toolId=${toolId}, interpreterType=${tool.interpreterType}`,
      );
      return null;
    }

    return interpreter.parseStreamLine(line) as StreamEvent | null;
  }

  /**
   * Build command arguments for a tool
   */
  buildCommand(toolId: string, options: Record<string, unknown>): string[] {
    const tool = this.getTool(toolId);
    return composeCliCommand(tool, options);
  }

  /**
   * Optional stdin payload for tools that read prompts from stdin.
   */
  getStdinInput(toolId: string, options: Record<string, unknown>): string | undefined {
    const tool = this.getTool(toolId);
    return getCliStdinInput(tool, options);
  }
}

export const sessionInterpreterService = new SessionInterpreterService();
