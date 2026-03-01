/**
 * Multi-CLI Execution Service
 * Manages process spawning and stream parsing for multiple CLI tools.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { v4 as uuidv4 } from 'uuid';
import type { ExecutionInfo, ExecutionRequest } from '../types/execution';
import type { StreamEvent } from '../types/stream-events';
import { sessionInterpreterService } from './SessionInterpreterService';

type StreamHandler = (sessionId: string, event: StreamEvent) => void;
type CompleteHandler = (sessionId: string) => void;
type ErrorHandler = (sessionId: string, error: string) => void;

const ANSI_ESCAPE_REGEX = new RegExp(
  `${String.fromCharCode(27)}\\[[0-9;?]*[a-zA-Z]|${String.fromCharCode(27)}\\)[a-zA-Z]`,
  'g',
);

class ToolStreamParser {
  private buffer = '';

  constructor(
    private readonly toolId: string,
    private readonly onEvent: (event: StreamEvent) => void,
    private readonly onParseError: (error: string) => void,
  ) {}

  processChunk(chunk: Buffer | string): void {
    const data = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    this.buffer += data;

    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      this.parseLine(line);
    }
  }

  flush(): void {
    if (!this.buffer.trim()) {
      this.buffer = '';
      return;
    }

    this.parseLine(this.buffer);
    this.buffer = '';
  }

  private parseLine(rawLine: string): void {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      return;
    }

    const cleaned = trimmed.replace(ANSI_ESCAPE_REGEX, '');

    try {
      const parsed = sessionInterpreterService.parseLine(this.toolId, cleaned);
      if (parsed) {
        this.onEvent(parsed);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.onParseError(message);
    }
  }
}

export class MultiCliExecutionService {
  private executions = new Map<string, ExecutionInfo>();
  private processes = new Map<string, ChildProcess>();
  private streamHandlers: StreamHandler[] = [];
  private completeHandlers: CompleteHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];

  onStream(handler: StreamHandler): () => void {
    this.streamHandlers.push(handler);
    return () => {
      this.streamHandlers = this.streamHandlers.filter((h) => h !== handler);
    };
  }

  onComplete(handler: CompleteHandler): () => void {
    this.completeHandlers.push(handler);
    return () => {
      this.completeHandlers = this.completeHandlers.filter((h) => h !== handler);
    };
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.push(handler);
    return () => {
      this.errorHandlers = this.errorHandlers.filter((h) => h !== handler);
    };
  }

  private emitStream(sessionId: string, event: StreamEvent): void {
    for (const handler of this.streamHandlers) handler(sessionId, event);
  }

  private emitComplete(sessionId: string): void {
    for (const handler of this.completeHandlers) handler(sessionId);
  }

  private emitError(sessionId: string, error: string): void {
    for (const handler of this.errorHandlers) handler(sessionId, error);
  }

  execute(request: ExecutionRequest): string {
    const sessionId = uuidv4();
    const { toolId, projectPath, query, options } = request;

    const execution: ExecutionInfo = {
      sessionId,
      pid: null,
      status: 'pending',
      toolId,
      projectPath,
      query,
      options,
      events: [],
      startedAt: Date.now(),
    };

    this.executions.set(sessionId, execution);

    const mergedOptions = { ...options, query };
    const cmdArgs = sessionInterpreterService.buildCommand(toolId, mergedOptions);
    if (cmdArgs.length === 0 || !cmdArgs[0]) {
      throw new Error(`Interpreter returned empty command for tool: ${toolId}`);
    }

    const command = cmdArgs[0];
    const args = cmdArgs.slice(1);
    const stdinInput = sessionInterpreterService.getStdinInput(toolId, mergedOptions);

    console.log(`[MultiCliExec] Spawning: ${command} ${args.join(' ')}`);
    console.log(`[MultiCliExec] CWD: ${projectPath}`);

    const useShell = process.platform === 'win32';

    const child = spawn(command, args, {
      cwd: projectPath,
      env: { ...process.env },
      shell: useShell,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (child.stdin) {
      if (stdinInput !== undefined) {
        child.stdin.write(stdinInput);
      }
      child.stdin.end();
    }

    execution.pid = child.pid ?? null;
    execution.status = 'running';
    this.processes.set(sessionId, child);

    const parser = new ToolStreamParser(
      toolId,
      (event: StreamEvent) => {
        event.toolId = toolId;
        execution.events.push(event);
        this.emitStream(sessionId, event);
      },
      (error: string) => {
        console.error(`[MultiCliExec:${sessionId}] Parse error:`, error);
      },
    );

    let stderrOutput = '';

    child.stdout?.on('data', (data: Buffer) => {
      parser.processChunk(data);
    });

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderrOutput += text;
      console.log(`[MultiCliExec:${sessionId}] stderr:`, text);
    });

    child.on('close', (code) => {
      parser.flush();
      execution.completedAt = Date.now();
      execution.status = code === 0 ? 'completed' : 'failed';
      if (code !== 0) {
        const stderrTail = stderrOutput.trim().split(/\r?\n/).filter(Boolean).pop();
        execution.error = stderrTail
          ? `Process exited with code ${code}: ${stderrTail}`
          : `Process exited with code ${code}`;
      }
      this.processes.delete(sessionId);
      this.emitComplete(sessionId);
      console.log(`[MultiCliExec:${sessionId}] Process exited with code ${code}`);
    });

    child.on('error', (error) => {
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = Date.now();
      this.processes.delete(sessionId);
      this.emitError(sessionId, error.message);
      console.error(`[MultiCliExec:${sessionId}] Process error:`, error);
    });

    return sessionId;
  }

  getExecution(sessionId: string): ExecutionInfo | undefined {
    return this.executions.get(sessionId);
  }

  getAllExecutions(): ExecutionInfo[] {
    return Array.from(this.executions.values());
  }

  killExecution(sessionId: string): void {
    const child = this.processes.get(sessionId);
    if (child) {
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 3000);
    }
  }

  cleanupExecution(sessionId: string): void {
    this.killExecution(sessionId);
    this.executions.delete(sessionId);
    this.processes.delete(sessionId);
  }

  killAll(): void {
    for (const [sessionId] of this.processes) {
      this.killExecution(sessionId);
    }
  }

  getActiveExecutions(): string[] {
    return Array.from(this.processes.keys());
  }
}

export const multiCliExecutionService = new MultiCliExecutionService();
