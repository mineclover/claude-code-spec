/**
 * StreamParser - Handles line-by-line JSON parsing from Claude CLI stream-json output
 * Now with Zod schema validation for runtime type safety
 */

import { safeValidateStreamEvent } from './schemas';
import type { StreamEvent } from './types';

export type { StreamEvent };
export type StreamCallback = (event: StreamEvent) => void;
export type ErrorCallback = (error: string) => void;

/**
 * Creates a regex pattern to remove ANSI escape sequences that may appear in streamed output.
 * Matches two patterns:
 * - CSI sequences (Control Sequence Introducer): ESC [ ... letter (e.g., ESC[31m for red, ESC[2K for clear)
 * - OSC sequences (Operating System Command): ESC ) letter
 * Constructs the pattern dynamically using String.fromCharCode(27) for the ESC character
 * to avoid embedding literal control characters in the source code.
 */
function createAnsiEscapeRegex(): RegExp {
  const esc = String.fromCharCode(27);
  return new RegExp(`${esc}\\[[0-9;?]*[a-zA-Z]|${esc}\\)[a-zA-Z]`, 'g');
}

export interface StreamParserOptions {
  maxBufferSize?: number; // Maximum buffer size in bytes (default: 10MB)
  onBufferOverflow?: (bufferSize: number) => void; // Called when buffer exceeds max size
}

export class StreamParser {
  private buffer = '';
  private onEvent: StreamCallback;
  private onError?: ErrorCallback;
  private maxBufferSize: number;
  private onBufferOverflow?: (bufferSize: number) => void;

  constructor(
    onEvent: StreamCallback,
    onError?: ErrorCallback,
    options: StreamParserOptions = {},
  ) {
    this.onEvent = onEvent;
    this.onError = onError;
    this.maxBufferSize = options.maxBufferSize ?? 10 * 1024 * 1024; // 10MB default
    this.onBufferOverflow = options.onBufferOverflow;
  }

  /**
   * Process incoming data chunk from stdout
   */
  processChunk(chunk: Buffer | string): void {
    const data = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    this.buffer += data;

    // Check buffer size limit
    const bufferSize = Buffer.byteLength(this.buffer, 'utf8');
    if (bufferSize > this.maxBufferSize) {
      // Buffer overflow - clear buffer and notify
      const errorMsg = `Buffer overflow: ${bufferSize} bytes exceeds limit of ${this.maxBufferSize} bytes`;
      console.error('[StreamParser]', errorMsg);

      if (this.onBufferOverflow) {
        this.onBufferOverflow(bufferSize);
      }

      if (this.onError) {
        this.onError(errorMsg);
      }

      // Clear buffer to prevent unbounded growth
      this.buffer = '';
      return;
    }

    // Split by newlines
    const lines = this.buffer.split('\n');

    // Keep the last incomplete line in buffer
    this.buffer = lines.pop() || '';

    // Process complete lines
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Remove ANSI escape sequences (e.g., cursor control, colors)
      const cleanedLine = trimmedLine.replace(createAnsiEscapeRegex(), '');

      // Only try to parse if line looks like it starts with JSON
      if (cleanedLine.startsWith('{') || cleanedLine.startsWith('[')) {
        this.parseLine(cleanedLine);
      } else if (cleanedLine) {
        // Non-JSON output (e.g., debug messages, warnings)
        console.log('[StreamParser] Non-JSON output:', cleanedLine);
      }
    }
  }

  /**
   * Parse a single line as JSON with runtime validation
   */
  private parseLine(line: string): void {
    try {
      // Step 1: Parse JSON
      const parsed = JSON.parse(line);

      // Step 2: Validate with Zod schema
      const validated = safeValidateStreamEvent(parsed);

      if (!validated) {
        // Validation failed - log and report error
        console.error('[StreamParser] Schema validation failed:', {
          line: line.substring(0, 100),
          parsed,
        });

        if (this.onError) {
          this.onError(`Schema validation failed: ${line.substring(0, 100)}`);
        }
        return;
      }

      // Step 3: Forward validated event
      this.onEvent(validated as StreamEvent);
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
