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
        tools: [],
        mcp_servers: [],
        permissionMode: 'default',
        slash_commands: [],
        apiKeySource: 'env',
        output_style: 'stream-json',
        agents: [],
        uuid: 'test-uuid-123',
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
        tools: [],
        mcp_servers: [],
        permissionMode: 'default',
        slash_commands: [],
        apiKeySource: 'env',
        output_style: 'stream-json',
        agents: [],
        uuid: 'test-uuid-123',
      };

      const event2: StreamEvent = {
        type: 'user',
        message: {
          role: 'user',
          content: 'Test message',
        },
        session_id: 'test-123',
        parent_tool_use_id: null,
        uuid: 'test-uuid-456',
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
        tools: [],
        mcp_servers: [],
        permissionMode: 'default',
        slash_commands: [],
        apiKeySource: 'env',
        output_style: 'stream-json',
        agents: [],
        uuid: 'test-uuid-123',
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
        tools: [],
        mcp_servers: [],
        permissionMode: 'default',
        slash_commands: [],
        apiKeySource: 'env',
        output_style: 'stream-json',
        agents: [],
        uuid: 'test-uuid-123',
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
      parser.processChunk('{invalid json}\n');

      expect(onEvent).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('{invalid json}'));
    });

    it('should recover from invalid JSON and process next valid line', () => {
      const validEvent: StreamEvent = {
        type: 'system',
        subtype: 'init',
        session_id: 'test-123',
        model: 'claude-sonnet-4',
        cwd: '/test',
        tools: [],
        mcp_servers: [],
        permissionMode: 'default',
        slash_commands: [],
        apiKeySource: 'env',
        output_style: 'stream-json',
        agents: [],
        uuid: 'test-uuid-123',
      };

      const chunk = '{invalid json}\n' + JSON.stringify(validEvent) + '\n';
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
        tools: [],
        mcp_servers: [],
        permissionMode: 'default',
        slash_commands: [],
        apiKeySource: 'env',
        output_style: 'stream-json',
        agents: [],
        uuid: 'test-uuid-123',
      };

      // Mixed \n and \r\n
      parser.processChunk(JSON.stringify(event) + '\r\n');

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(event);
    });
  });

  // Note: getBuffer is private, testing through behavior instead

  describe('buffer management', () => {
    it('should handle buffer overflow', () => {
      const onBufferOverflow = vi.fn();
      const smallBufferParser = new StreamParser(onEvent, onError, {
        maxBufferSize: 100, // Very small buffer for testing
        onBufferOverflow,
      });

      // Send a chunk larger than buffer size without newline
      const largeChunk = 'A'.repeat(150);
      smallBufferParser.processChunk(largeChunk);

      // Buffer should have been cleared
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Buffer overflow'));
      expect(onBufferOverflow).toHaveBeenCalledTimes(1);
      expect(onBufferOverflow).toHaveBeenCalledWith(150);
      expect(onEvent).not.toHaveBeenCalled();
    });

    it('should continue processing after buffer overflow', () => {
      const onBufferOverflow = vi.fn();
      const smallBufferParser = new StreamParser(onEvent, onError, {
        maxBufferSize: 100,
        onBufferOverflow,
      });

      // Cause buffer overflow
      smallBufferParser.processChunk('A'.repeat(150));

      // Reset mocks
      onError.mockClear();
      onEvent.mockClear();

      // Should be able to process valid events after overflow
      // Use a small event that fits in the 100-byte buffer
      const validEvent: StreamEvent = {
        type: 'error',
        error: {
          type: 'test',
          message: 'ok',
        },
      };

      smallBufferParser.processChunk(JSON.stringify(validEvent) + '\n');

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(validEvent);
    });
  });

  describe('edge cases', () => {
    it('should handle very large JSON objects', () => {
      const largeEvent: StreamEvent = {
        type: 'assistant',
        message: {
          id: 'msg-123',
          type: 'message',
          role: 'assistant',
          model: 'claude-sonnet-4',
          content: [
            {
              type: 'text',
              text: 'A'.repeat(10000), // 10KB text
            },
          ],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            service_tier: 'default',
          },
        },
        parent_tool_use_id: null,
        session_id: 'test-123',
        uuid: 'test-uuid-789',
      };

      parser.processChunk(JSON.stringify(largeEvent) + '\n');

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(largeEvent);
    });

    it('should handle rapid successive chunks', () => {
      const events: StreamEvent[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'user',
        message: {
          role: 'user',
          content: `Message ${i}`,
        },
        session_id: 'test-123',
        parent_tool_use_id: null,
        uuid: `test-uuid-${i}`,
      }));

      events.forEach((event) => {
        parser.processChunk(JSON.stringify(event) + '\n');
      });

      expect(onEvent).toHaveBeenCalledTimes(100);
    });

    it('should handle events with special characters', () => {
      const event: StreamEvent = {
        type: 'user',
        message: {
          role: 'user',
          content: 'Special chars: "quotes" and backslash',
        },
        session_id: 'test-123',
        parent_tool_use_id: null,
        uuid: 'test-uuid-special',
      };

      parser.processChunk(JSON.stringify(event) + '\n');

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(event);
    });
  });
});
