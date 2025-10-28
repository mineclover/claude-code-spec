/**
 * ClaudeClient - Manages Claude CLI execution with stream-json I/O
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { type ErrorCallback, type StreamCallback, StreamParser } from './StreamParser';
import type { StreamEvent } from './types';
import { isSystemInitEvent } from './types';

export interface ClaudeClientOptions {
  cwd: string;
  model?: 'sonnet' | 'opus' | 'heroku'; // Add model option
  onStream: StreamCallback;
  onError?: ErrorCallback;
  onClose?: (code: number) => void;
  sessionId?: string;
  mcpConfig?: string; // Path to MCP config file (e.g., '.claude/.mcp-dev.json')
  skillId?: string; // Skill ID to use
  skillScope?: 'global' | 'project'; // Skill scope (global or project)
}

export interface ClaudeMessage {
  type: 'user';
  message: {
    role: 'user';
    content: Array<{
      type: 'text';
      text: string;
    }>;
  };
}

export class ClaudeClient {
  private process: ChildProcess | null = null;
  private parser: StreamParser;
  private options: ClaudeClientOptions;
  private currentSessionId: string | null = null;

  constructor(options: ClaudeClientOptions) {
    this.options = options;
    this.currentSessionId = options.sessionId || null;

    this.parser = new StreamParser((event) => this.handleStreamEvent(event), options.onError);
  }

  /**
   * Execute a query with Claude CLI
   */
  execute(query: string): ChildProcess {
    if (this.process) {
      throw new Error('Client already has an active process');
    }

    console.log('[ClaudeClient] Executing query:', {
      cwd: this.options.cwd,
      query: `${query.substring(0, 50)}...`,
      sessionId: this.currentSessionId,
    });

    // Build command arguments
    const args = [
      '-p',
      query,
      '--output-format',
      'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
    ];

    // Add MCP config if specified
    if (this.options.mcpConfig) {
      args.push('--mcp-config', this.options.mcpConfig);
      args.push('--strict-mcp-config');
    }

    // Add model if specified (defaults to sonnet for better performance)
    if (this.options.model) {
      args.push('--model', this.options.model);
    } else {
      // Default to sonnet instead of opus for better speed/cost balance
      args.push('--model', 'sonnet');
    }

    // Add session resume if available
    if (this.currentSessionId) {
      args.push('--resume', this.currentSessionId);
    }

    console.log('[ClaudeClient] Args:', args);

    // Spawn Claude directly with -p flag
    this.process = spawn('claude', args, {
      cwd: this.options.cwd,
      env: {
        ...process.env,
        PATH: process.env.PATH,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.setupProcessHandlers();

    return this.process;
  }

  /**
   * Setup stdout, stderr, and close handlers
   */
  private setupProcessHandlers(): void {
    if (!this.process) return;

    // Handle stdout - parse stream-json
    this.process.stdout?.on('data', (chunk) => {
      this.parser.processChunk(chunk);
    });

    // Handle stderr
    this.process.stderr?.on('data', (chunk) => {
      const errorMsg = chunk.toString('utf8');
      console.error('[ClaudeClient] stderr:', errorMsg);
      if (this.options.onError) {
        this.options.onError(errorMsg);
      }
    });

    // Handle process close
    this.process.on('close', (code) => {
      console.log('[ClaudeClient] Process closed:', code);
      this.parser.flush(); // Process any remaining data
      this.cleanup();
      if (this.options.onClose) {
        this.options.onClose(code || 0);
      }
    });

    // Handle process error
    this.process.on('error', (error) => {
      console.error('[ClaudeClient] Process error:', error);
      if (this.options.onError) {
        this.options.onError(`Process error: ${error.message}`);
      }
      this.cleanup();
    });
  }

  /**
   * Handle parsed stream events
   */
  private handleStreamEvent(event: StreamEvent): void {
    // Extract session_id from system init event using type guard
    if (isSystemInitEvent(event)) {
      this.currentSessionId = event.session_id;
      console.log('[ClaudeClient] Session ID:', this.currentSessionId);
    }

    // Forward to callback
    this.options.onStream(event);
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Kill the running process
   */
  kill(): void {
    if (this.process) {
      this.process.kill();
      this.cleanup();
    }
  }

  /**
   * Cleanup internal state
   */
  private cleanup(): void {
    this.process = null;
    this.parser.reset();
  }

  /**
   * Check if process is running
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}
