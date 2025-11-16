import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StreamParser } from '../../src/parser/StreamParser';
import type { StreamEvent } from '../../src/parser/types';

describe('StreamParser', () => {
  let onEvent: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;
  let parser: StreamParser;

  beforeEach(() => {
    onEvent = vi.fn();
    onError = vi.fn();
    parser = new StreamParser(onEvent, onError);
  });

  describe('processChunk', () => {
    it('should parse valid JSON lines', () => {
      const event: StreamEvent = {
        type: 'system',
        subtype: 'init',
        session_id: 'test-123',
        model: 'claude-sonnet-4',
        cwd: '/test',
        timestamp: '2024-01-01T00:00:00Z',
      };

      parser.processChunk(JSON.stringify(event) + '\n');

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(event);
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle multiple events in one chunk', () => {
      const event1: StreamEvent = {
        type: 'system',
        subtype: 'init',
        session_id: 'test-123',
        model: 'claude-sonnet-4',
        cwd: '/test',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const event2: StreamEvent = {
        type: 'message',
        subtype: 'user',
        message: {
          role: 'user',
          content: 'Test message',
        },
      };

      const chunk = JSON.stringify(event1) + '\n' + JSON.stringify(event2) + '\n';
      parser.processChunk(chunk);

      expect(onEvent).toHaveBeenCalledTimes(2);
      expect(onEvent).toHaveBeenNthCalledWith(1, event1);
      expect(onEvent).toHaveBeenNthCalledWith(2, event2);
    });

    it('should buffer incomplete lines', () => {
      const event: StreamEvent = {
        type: 'system',
        subtype: 'init',
        session_id: 'test-123',
        model: 'claude-sonnet-4',
        cwd: '/test',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const jsonString = JSON.stringify(event);
      const part1 = jsonString.substring(0, 20);
      const part2 = jsonString.substring(20) + '\n';

      // First chunk - incomplete
      parser.processChunk(part1);
      expect(onEvent).not.toHaveBeenCalled();

      // Second chunk - completes the line
      parser.processChunk(part2);
      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(event);
    });

    it('should strip ANSI escape codes', () => {
      const event: StreamEvent = {
        type: 'system',
        subtype: 'init',
        session_id: 'test-123',
        model: 'claude-sonnet-4',
        cwd: '/test',
        timestamp: '2024-01-01T00:00:00Z',
      };

      // Add ANSI codes
      const chunk = '\x1b[32m' + JSON.stringify(event) + '\x1b[0m\n';
      parser.processChunk(chunk);

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(event);
    });

    it('should handle empty lines', () => {
      parser.processChunk('\n\n\n');
      expect(onEvent).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('should call onError for invalid JSON', () => {
      parser.processChunk('invalid json\n');

      expect(onEvent).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('invalid json'));
    });

    it('should recover from invalid JSON and process next valid line', () => {
      const validEvent: StreamEvent = {
        type: 'system',
        subtype: 'init',
        session_id: 'test-123',
        model: 'claude-sonnet-4',
        cwd: '/test',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const chunk = 'invalid json\n' + JSON.stringify(validEvent) + '\n';
      parser.processChunk(chunk);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(validEvent);
    });

    it('should handle chunks with mixed newlines', () => {
      const event: StreamEvent = {
        type: 'system',
        subtype: 'init',
        session_id: 'test-123',
        model: 'claude-sonnet-4',
        cwd: '/test',
        timestamp: '2024-01-01T00:00:00Z',
      };

      // Mixed \n and \r\n
      parser.processChunk(JSON.stringify(event) + '\r\n');

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(event);
    });
  });

  describe('getBuffer', () => {
    it('should return current buffer content', () => {
      const incomplete = '{"type":"system"';
      parser.processChunk(incomplete);

      const buffer = parser.getBuffer();
      expect(buffer).toBe(incomplete);
    });

    it('should return empty string when buffer is empty', () => {
      expect(parser.getBuffer()).toBe('');
    });

    it('should clear buffer after complete line', () => {
      const event: StreamEvent = {
        type: 'system',
        subtype: 'init',
        session_id: 'test-123',
        model: 'claude-sonnet-4',
        cwd: '/test',
        timestamp: '2024-01-01T00:00:00Z',
      };

      parser.processChunk(JSON.stringify(event) + '\n');
      expect(parser.getBuffer()).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should handle very large JSON objects', () => {
      const largeEvent: StreamEvent = {
        type: 'message',
        subtype: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'A'.repeat(10000), // 10KB text
            },
          ],
        },
      };

      parser.processChunk(JSON.stringify(largeEvent) + '\n');

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(largeEvent);
    });

    it('should handle rapid successive chunks', () => {
      const events: StreamEvent[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'message',
        subtype: 'user',
        message: {
          role: 'user',
          content: `Message ${i}`,
        },
      }));

      events.forEach((event) => {
        parser.processChunk(JSON.stringify(event) + '\n');
      });

      expect(onEvent).toHaveBeenCalledTimes(100);
    });

    it('should handle events with special characters', () => {
      const event: StreamEvent = {
        type: 'message',
        subtype: 'user',
        message: {
          role: 'user',
          content: 'Special chars: "quotes" \\backslash\\ \nnewline\n \ttab',
        },
      };

      parser.processChunk(JSON.stringify(event) + '\n');

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(event);
    });
  });
});
