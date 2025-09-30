/**
 * StreamParser - Handles line-by-line JSON parsing from Claude CLI stream-json output
 */

import type { StreamEvent } from './types';

export type { StreamEvent };
export type StreamCallback = (event: StreamEvent) => void;
export type ErrorCallback = (error: string) => void;

export class StreamParser {
  private buffer = '';
  private onEvent: StreamCallback;
  private onError?: ErrorCallback;

  constructor(onEvent: StreamCallback, onError?: ErrorCallback) {
    this.onEvent = onEvent;
    this.onError = onError;
  }

  /**
   * Process incoming data chunk from stdout
   */
  processChunk(chunk: Buffer | string): void {
    const data = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    this.buffer += data;

    // Split by newlines
    const lines = this.buffer.split('\n');

    // Keep the last incomplete line in buffer
    this.buffer = lines.pop() || '';

    // Process complete lines
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Only try to parse if line looks like it starts with JSON
      if (trimmedLine.startsWith('{') || trimmedLine.startsWith('[')) {
        this.parseLine(trimmedLine);
      } else {
        // Non-JSON output (e.g., debug messages, warnings)
        console.log('[StreamParser] Non-JSON output:', trimmedLine);
      }
    }
  }

  /**
   * Parse a single line as JSON
   */
  private parseLine(line: string): void {
    try {
      const event: StreamEvent = JSON.parse(line);
      this.onEvent(event);
    } catch (error) {
      // Check if this looks like a truncated JSON (incomplete)
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      const openBrackets = (line.match(/\[/g) || []).length;
      const closeBrackets = (line.match(/]/g) || []).length;

      if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
        // This looks like incomplete JSON, might be a chunking issue
        console.warn(
          '[StreamParser] Incomplete JSON detected (possible chunking issue):',
          line.substring(0, 100),
        );
        console.warn(
          `[StreamParser] Braces: ${openBraces} open, ${closeBraces} close | Brackets: ${openBrackets} open, ${closeBrackets} close`,
        );
      } else {
        // Complete but invalid JSON
        const errorMsg = `Failed to parse JSON: ${line.substring(0, 100)}`;
        console.error('[StreamParser]', errorMsg, error);
      }

      if (this.onError) {
        this.onError(`JSON parse error: ${line.substring(0, 100)}`);
      }
    }
  }

  /**
   * Flush any remaining data in buffer (call on stream end)
   */
  flush(): void {
    if (this.buffer.trim()) {
      this.parseLine(this.buffer);
      this.buffer = '';
    }
  }

  /**
   * Reset parser state
   */
  reset(): void {
    this.buffer = '';
  }
}
