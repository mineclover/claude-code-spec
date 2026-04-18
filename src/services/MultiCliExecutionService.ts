/**
 * Multi-CLI Execution Service
 * Manages process spawning and stream parsing for multiple CLI tools.
 */

import { v4 as uuidv4 } from 'uuid';
import { emptyCacheMetrics, updateCacheMetrics } from '../lib/cacheMetrics';
import { type StreamingPromise, type StreamingSubprocess, spawnStreaming } from '../lib/cliRunner';
import { detectDrift, extractObservedFingerprint } from '../lib/observedFingerprint';
import type { ExecutionInfo, ExecutionRequest } from '../types/execution';
import type { ResolvedMcpConfig } from '../types/mcp-policy';
import type { SessionMeta } from '../types/prefix-fingerprint';
import { isSystemInitEvent, type StreamEvent } from '../types/stream-events';
import { fingerprintService } from './FingerprintService';
import { errorReporter } from './errorReporter';
import { mcpResolverService } from './McpResolverService';
import { sessionInterpreterService } from './SessionInterpreterService';
import { sessionMetaStore } from './SessionMetaStore';

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
  private processes = new Map<string, StreamingSubprocess>();
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
    const { toolId, projectPath, query, mcpOverride } = request;
    let options = { ...request.options };

    // If the caller supplied an MCP override, resolve it now. This:
    //   1. materializes a `.claude/.mcp-generated-<hash>.json` so --mcp-config
    //      has something stable to point at
    //   2. overrides any options.mcpConfig the caller also passed — the
    //      resolver output is the source of truth when an override is used
    //   3. stamps the resolved object on the ExecutionInfo, which later feeds
    //      the sidecar SessionMeta (T15)
    let mcpResolved: ResolvedMcpConfig | undefined;
    if (mcpOverride) {
      try {
        const registry = mcpResolverService.loadRegistry({ projectPath });
        const policy = mcpResolverService.loadPolicy(projectPath);
        const resolved = mcpResolverService.resolve({
          registry,
          policy,
          override: mcpOverride,
        });
        const written = mcpResolverService.materialize(resolved, projectPath);
        mcpResolved = { ...resolved, configPath: written.path };
        options.mcpConfig = written.path;
      } catch (error) {
        console.error(
          `[MultiCliExec:${sessionId}] MCP resolve failed; continuing without override:`,
          error,
        );
        errorReporter.report('multiCliExec.mcpResolve', error);
      }
    }

    const mcpConfigPath = typeof options.mcpConfig === 'string' ? options.mcpConfig : null;
    const staticFingerprint = fingerprintService.computeStatic({
      projectPath,
      mcpConfigPath,
    });

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
      metrics: emptyCacheMetrics(),
      fingerprint: { static: staticFingerprint },
      mcpResolved,
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

    const subprocess: StreamingPromise = spawnStreaming(command, args, {
      cwd: projectPath,
      input: stdinInput,
      // execa handles platform-specific shell quoting internally; no explicit
      // shell on POSIX, shell on Windows for proper .cmd / .bat resolution.
      shell: process.platform === 'win32',
    });

    execution.pid = subprocess.pid ?? null;
    execution.status = 'running';
    this.processes.set(sessionId, subprocess);

    const parser = new ToolStreamParser(
      toolId,
      (event: StreamEvent) => {
        event.toolId = toolId;
        execution.events.push(event);
        if (execution.metrics) {
          updateCacheMetrics(execution.metrics, event);
        }
        if (execution.fingerprint && !execution.fingerprint.observed && isSystemInitEvent(event)) {
          const observed = extractObservedFingerprint(event);
          execution.fingerprint.observed = observed;
          execution.fingerprint.drift = detectDrift(execution.fingerprint.static, observed);
          execution.cliSessionId = event.session_id;
          console.log(
            `[MultiCliExec:${sessionId}] system/init observed: cliSessionId=${event.session_id}, ` +
              `tools=${event.tools.length}, mcp=${event.mcp_servers.length}, agents=${event.agents.length}`,
          );
        }
        this.emitStream(sessionId, event);
      },
      (error: string) => {
        console.error(`[MultiCliExec:${sessionId}] Parse error:`, error);
        errorReporter.report('multiCliExec.streamParse', error);
      },
    );

    let stderrOutput = '';

    subprocess.stdout?.on('data', (data: Buffer) => {
      parser.processChunk(data);
    });

    subprocess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderrOutput += text;
      console.log(`[MultiCliExec:${sessionId}] stderr:`, text);
    });

    // Await exit asynchronously; we still return sessionId synchronously.
    subprocess.then(
      (result) => {
        parser.flush();
        execution.completedAt = Date.now();
        const code = result.exitCode ?? null;
        execution.status = code === 0 ? 'completed' : 'failed';
        if (code !== 0) {
          const stderrTail = stderrOutput.trim().split(/\r?\n/).filter(Boolean).pop();
          execution.error = stderrTail
            ? `Process exited with code ${code}: ${stderrTail}`
            : `Process exited with code ${code}`;
        }
        this.persistSidecar(execution);
        this.processes.delete(sessionId);
        this.emitComplete(sessionId);
        console.log(`[MultiCliExec:${sessionId}] Process exited with code ${code}`);
      },
      (error: Error) => {
        // Spawn failure (ENOENT etc.) or fatal runtime error.
        execution.status = 'failed';
        execution.error = error.message;
        execution.completedAt = Date.now();
        this.processes.delete(sessionId);
        this.emitError(sessionId, error.message);
        console.error(`[MultiCliExec:${sessionId}] Process error:`, error);
        errorReporter.report('multiCliExec.process', error);
      },
    );

    return sessionId;
  }

  getExecution(sessionId: string): ExecutionInfo | undefined {
    return this.executions.get(sessionId);
  }

  getAllExecutions(): ExecutionInfo[] {
    return Array.from(this.executions.values());
  }

  killExecution(sessionId: string): void {
    const subprocess = this.processes.get(sessionId);
    if (!subprocess) return;
    // spawnStreaming wires forceKillAfterDelay so a plain kill() escalates
    // SIGTERM → SIGKILL after 3s automatically.
    subprocess.kill('SIGTERM');
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

  private persistSidecar(execution: ExecutionInfo): void {
    const tag = `[MultiCliExec:${execution.sessionId}]`;
    if (!execution.cliSessionId) {
      console.warn(
        `${tag} Sidecar skipped: no cliSessionId (system/init event not observed). ` +
          `Execution status=${execution.status}, event count=${execution.events.length}`,
      );
      return;
    }
    if (!execution.fingerprint) {
      console.warn(`${tag} Sidecar skipped: fingerprint missing`);
      return;
    }
    if (!execution.metrics) {
      console.warn(`${tag} Sidecar skipped: metrics missing`);
      return;
    }
    const meta: SessionMeta = {
      schemaVersion: 1,
      sessionId: execution.cliSessionId,
      toolId: execution.toolId,
      projectPath: execution.projectPath,
      fingerprint: execution.fingerprint,
      metrics: execution.metrics,
      mcpResolved: execution.mcpResolved
        ? {
            enabledServerIds: execution.mcpResolved.enabledServerIds,
            hash: execution.mcpResolved.hash,
            baselineServerIds: execution.mcpResolved.baselineServerIds,
            overrideAdd: execution.mcpResolved.addedByOverride,
            overrideRemove: execution.mcpResolved.removedByOverride,
            canonicalJson: execution.mcpResolved.canonicalJson,
          }
        : undefined,
      writtenAt: Date.now(),
    };
    const written = sessionMetaStore.write({
      projectPath: execution.projectPath,
      cliSessionId: execution.cliSessionId,
      meta,
    });
    if (written) {
      console.log(`${tag} Sidecar written: ${written}`);
    } else {
      console.warn(`${tag} Sidecar write returned null for cliSessionId=${execution.cliSessionId}`);
    }
  }
}

export const multiCliExecutionService = new MultiCliExecutionService();
