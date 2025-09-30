/**
 * StreamParser - Handles line-by-line JSON parsing from Claude CLI stream-json output
 */

import type { StreamEvent } from './types';

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
      if (!line.trim()) continue;
      this.parseLine(line);
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
      const errorMsg = `Failed to parse JSON: ${line.substring(0, 100)}`;
      console.error('[StreamParser]', errorMsg, error);
      if (this.onError) {
        this.onError(errorMsg);
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