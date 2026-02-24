/**
 * Claude CLI JSONL stream interpreter
 * Parses stream-json output from Claude CLI into StreamEvent objects
 */

import type { CLIToolInterpreter } from '../types/cli-tool';
import type { StreamEvent } from '../types/stream-events';

export class ClaudeInterpreter implements CLIToolInterpreter {
  toolId = 'claude';

  parseStreamLine(line: string): StreamEvent | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Remove ANSI escape sequences
    const esc = String.fromCharCode(27);
    const ansiRegex = new RegExp(`${esc}\\[[0-9;?]*[a-zA-Z]|${esc}\\)[a-zA-Z]`, 'g');
    const cleaned = trimmed.replace(ansiRegex, '');

    if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
      return null;
    }

    try {
      const parsed = JSON.parse(cleaned) as StreamEvent;
      // Stamp with toolId
      parsed.toolId = this.toolId;
      return parsed;
    } catch {
      return null;
    }
  }
}
