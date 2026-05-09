/**
 * Thin TypeScript client for the codex app-server JSON-RPC 2.0 stream
 * over stdio.
 *
 * Modeled after openai/symphony's `app_server.ex` (see
 * `references/symphony-codex-app-server.md`). The protocol is:
 *
 *   1. Spawn `codex app-server` with cwd set to the project root.
 *   2. Send `initialize` (id 1), wait for the response, then send the
 *      `initialized` notification.
 *   3. Send `thread/start` / `thread/fork` / `thread/resume` to obtain
 *      a thread id, then `turn/start` to drive the model.
 *   4. While a turn is in flight, codex emits notifications
 *      (`turn/started`, `item/started`, `item/completed`,
 *      `thread/tokenUsage/updated`, `turn/completed`, …) on the same
 *      channel, and may also send reverse-RPC requests (approvals,
 *      tool input). We auto-deny those for the annotator scenario.
 *
 * v1 scope is exactly what the annotator needs:
 *   - `initialize` / `initialized`
 *   - `thread/fork` (and `thread/start` as a fallback)
 *   - `turn/start` with optional `outputSchema`
 *   - listen for the matching `turn/completed` and the agentMessage(s)
 *     produced during the turn
 *   - `shutdown` (SIGTERM + drain)
 *
 * Reverse RPC handling is intentionally minimal: every server-initiated
 * request gets a `{decision: "denied"}` (or `abort`) response, and
 * `requestUserInput` gets a non-interactive blurb. Combined with the
 * annotator's sandboxPolicy `readOnly` + approvalPolicy `never`, the
 * model effectively cannot use tools — exactly what we want.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface, type Interface as ReadlineInterface } from 'node:readline';

const NON_INTERACTIVE_INPUT_ANSWER =
  'This is a non-interactive session. Operator input is unavailable.';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: unknown;
}
export interface JsonRpcNotification {
  jsonrpc?: '2.0';
  method: string;
  params?: unknown;
}
export interface JsonRpcResponse {
  jsonrpc?: '2.0';
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * Subset of `ThreadItem` we actually surface to callers — full union
 * lives in the codex generated bindings under `serverNotification ->
 * item/completed`. Annotator only cares about agentMessage text + the
 * fact that a non-message item happened (so we can log a warning if
 * the model tried to use a tool).
 */
export interface CodexThreadItem {
  type: string;
  id?: string;
  text?: string;
  [key: string]: unknown;
}

export interface CodexTokenUsage {
  total: {
    totalTokens: number;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningOutputTokens: number;
  };
  last: {
    totalTokens: number;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningOutputTokens: number;
  };
  modelContextWindow: number | null;
}

export interface RunTurnOptions {
  onItem?: (item: CodexThreadItem) => void;
  onTokenUsage?: (usage: CodexTokenUsage) => void;
  /**
   * Hard upper bound on a single turn. Defaults to 5 minutes — generous
   * enough that a slow annotator batch isn't killed mid-thought, tight
   * enough that a stuck server doesn't block the run forever.
   */
  timeoutMs?: number;
}

export interface RunTurnResult {
  turnId: string;
  /** Concatenation of every `agentMessage` item.text in turn order. */
  finalAgentMessage: string;
  items: CodexThreadItem[];
  tokenUsage: CodexTokenUsage | null;
  durationMs: number | null;
  status: string;
  /** True when the model produced a tool-call type item. Annotator */
  /** uses this as a signal that the prompt may have leaked into a   */
  /** tool path despite the sandbox lockdown.                        */
  attemptedTool: boolean;
}

export interface CodexAppServerOptions {
  /** Working directory for the spawned `codex app-server`. */
  cwd: string;
  /**
   * Optional override for the binary. Falls back to `codex` on PATH.
   * Useful for tests that want to point at a stub script.
   */
  command?: string;
  /** Extra args after `app-server`. Reserved for `--listen stdio://`-style flags. */
  extraArgs?: string[];
  /** Custom env. Falls through to `process.env` when omitted. */
  env?: NodeJS.ProcessEnv;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  method: string;
}

export class CodexAppServerClient {
  private child: ChildProcess | null = null;
  private rl: ReadlineInterface | null = null;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private notificationListeners: Array<(n: JsonRpcNotification) => void> = [];
  private rawListeners: Array<(line: string) => void> = [];
  private stderrBuffer = '';
  private exited = false;
  private exitError: Error | null = null;

  static async start(opts: CodexAppServerOptions): Promise<CodexAppServerClient> {
    const client = new CodexAppServerClient();
    await client.spawnProcess(opts);
    await client.initialize();
    return client;
  }

  /** Subscribe to every server notification. Returns an unsubscribe fn. */
  onNotification(fn: (n: JsonRpcNotification) => void): () => void {
    this.notificationListeners.push(fn);
    return () => {
      this.notificationListeners = this.notificationListeners.filter(
        (l) => l !== fn,
      );
    };
  }

  /** Subscribe to raw stdout lines (for tracing / debugging). */
  onRawLine(fn: (line: string) => void): () => void {
    this.rawListeners.push(fn);
    return () => {
      this.rawListeners = this.rawListeners.filter((l) => l !== fn);
    };
  }

  /**
   * Send a JSON-RPC request and wait for the matching response.
   * Notifications and reverse-RPC requests interleaved on the channel
   * are routed by the read loop; this just waits for the response with
   * `id === requestId`.
   */
  async request(method: string, params?: unknown): Promise<unknown> {
    if (!this.child || this.exited) {
      throw this.exitError ?? new Error(`codex app-server is not running`);
    }
    const id = this.nextRequestId++;
    const payload: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      ...(params === undefined ? {} : { params }),
    };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      try {
        this.writeMessage(payload);
      } catch (err) {
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /** Send a notification (no response expected). */
  notify(method: string, params?: unknown): void {
    if (!this.child || this.exited) return;
    const payload: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      ...(params === undefined ? {} : { params }),
    };
    this.writeMessage(payload);
  }

  /**
   * Drive a single turn end-to-end. Returns once `turn/completed`
   * fires for the turn id we were assigned, or rejects on
   * `turn/failed` / timeout / unexpected exit.
   */
  async runTurn(
    params: {
      threadId: string;
      prompt: string;
      cwd?: string;
      outputSchema?: unknown;
      sandboxPolicy?: unknown;
      approvalPolicy?: unknown;
      model?: string;
    },
    options: RunTurnOptions = {},
  ): Promise<RunTurnResult> {
    const {
      threadId,
      prompt,
      cwd,
      outputSchema,
      sandboxPolicy,
      approvalPolicy,
      model,
    } = params;
    const { onItem, onTokenUsage, timeoutMs = 5 * 60_000 } = options;

    const items: CodexThreadItem[] = [];
    const messageChunks: string[] = [];
    let tokenUsage: CodexTokenUsage | null = null;
    let attemptedTool = false;
    let turnId: string | null = null;
    let resolveDone!: (value: RunTurnResult) => void;
    let rejectDone!: (err: Error) => void;
    const done = new Promise<RunTurnResult>((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });

    const unsubscribe = this.onNotification((n) => {
      try {
        // Drop notifications for unrelated turns/threads — not fatal,
        // just noise from a long-running server we don't care about
        // for this single-turn invocation.
        const notifThreadId =
          (n.params as { threadId?: string } | undefined)?.threadId;
        if (notifThreadId && notifThreadId !== threadId) return;

        switch (n.method) {
          case 'turn/started': {
            const t = (n.params as { turn?: { id?: string } } | undefined)?.turn;
            if (t?.id) turnId = t.id;
            break;
          }
          case 'item/completed': {
            const item = (n.params as { item?: CodexThreadItem } | undefined)
              ?.item;
            if (!item) break;
            items.push(item);
            onItem?.(item);
            if (item.type === 'agentMessage' && typeof item.text === 'string') {
              messageChunks.push(item.text);
            } else if (
              item.type === 'commandExecution' ||
              item.type === 'fileChange' ||
              item.type === 'mcpToolCall' ||
              item.type === 'dynamicToolCall'
            ) {
              attemptedTool = true;
            }
            break;
          }
          case 'thread/tokenUsage/updated': {
            const u = (n.params as { tokenUsage?: CodexTokenUsage } | undefined)
              ?.tokenUsage;
            if (u) {
              tokenUsage = u;
              onTokenUsage?.(u);
            }
            break;
          }
          case 'turn/completed': {
            const turn = (
              n.params as
                | {
                    turn?: {
                      id?: string;
                      status?: string;
                      durationMs?: number | null;
                    };
                  }
                | undefined
            )?.turn;
            if (!turn || turn.id !== turnId) break;
            unsubscribe();
            clearTimeout(timer);
            resolveDone({
              turnId,
              finalAgentMessage: messageChunks.join('\n').trim(),
              items,
              tokenUsage,
              durationMs: turn.durationMs ?? null,
              status: turn.status ?? 'completed',
              attemptedTool,
            });
            break;
          }
          case 'turn/failed':
          case 'turn/cancelled': {
            const turn = (
              n.params as { turn?: { id?: string }; error?: unknown } | undefined
            ) ?? {};
            const failedTurnId = (turn.turn as { id?: string } | undefined)?.id;
            if (failedTurnId && turnId && failedTurnId !== turnId) break;
            unsubscribe();
            clearTimeout(timer);
            rejectDone(
              new Error(
                `codex turn ${n.method}: ${JSON.stringify((turn as { error?: unknown }).error ?? null)}`,
              ),
            );
            break;
          }
          default:
            break;
        }
      } catch (err) {
        unsubscribe();
        clearTimeout(timer);
        rejectDone(err instanceof Error ? err : new Error(String(err)));
      }
    });

    const timer = setTimeout(() => {
      unsubscribe();
      rejectDone(new Error(`codex turn timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Kick off the turn. The response carries `turn.id`; we also catch
    // it from the `turn/started` notification (whichever lands first
    // wins). Either way, by the time `turn/completed` arrives, turnId
    // must be set.
    let response: { turn?: { id?: string } };
    try {
      response = (await this.request('turn/start', {
        threadId,
        input: [
          {
            type: 'text',
            text: prompt,
            text_elements: [],
          },
        ],
        ...(cwd === undefined ? {} : { cwd }),
        ...(approvalPolicy === undefined ? {} : { approvalPolicy }),
        ...(sandboxPolicy === undefined ? {} : { sandboxPolicy }),
        ...(outputSchema === undefined ? {} : { outputSchema }),
        ...(model === undefined ? {} : { model }),
      })) as { turn?: { id?: string } };
    } catch (err) {
      unsubscribe();
      clearTimeout(timer);
      throw err;
    }
    if (response?.turn?.id) {
      turnId = response.turn.id;
    } else if (!turnId) {
      // Couldn't extract a turn id — still wait, but the matching test
      // in `turn/completed` would never succeed. Surface this early.
      unsubscribe();
      clearTimeout(timer);
      throw new Error(
        `codex turn/start did not return a turn id; raw=${JSON.stringify(response).slice(0, 400)}`,
      );
    }

    return done;
  }

  async shutdown(): Promise<void> {
    if (!this.child || this.exited) return;
    try {
      this.child.kill('SIGTERM');
    } catch {
      // best-effort
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        try {
          this.child?.kill('SIGKILL');
        } catch {
          /* noop */
        }
        resolve();
      }, 2000);
      this.child?.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  // ─── private ────────────────────────────────────────────────────

  private async spawnProcess(opts: CodexAppServerOptions): Promise<void> {
    const command = opts.command ?? 'codex';
    const args = ['app-server', ...(opts.extraArgs ?? [])];
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;

    if (!child.stdout || !child.stdin) {
      throw new Error(
        `codex app-server: stdio handles unavailable (process likely failed to spawn)`,
      );
    }

    this.rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
    this.rl.on('line', (line) => this.handleLine(line));
    child.stderr?.on('data', (chunk: Buffer) => {
      this.stderrBuffer += chunk.toString('utf8');
      // Cap stderr buffer so a noisy server doesn't grow unbounded.
      if (this.stderrBuffer.length > 32 * 1024) {
        this.stderrBuffer = this.stderrBuffer.slice(-32 * 1024);
      }
    });
    child.on('error', (err) => {
      this.exited = true;
      this.exitError = err;
      this.failPending(err);
    });
    child.on('close', (code) => {
      this.exited = true;
      if (code !== 0 && !this.exitError) {
        this.exitError = new Error(
          `codex app-server exited with code ${code}; stderr=${this.stderrBuffer.slice(-800)}`,
        );
      }
      this.failPending(
        this.exitError ?? new Error('codex app-server closed'),
      );
    });
  }

  private async initialize(): Promise<void> {
    const initResponse = (await this.request('initialize', {
      capabilities: { experimentalApi: true },
      clientInfo: {
        name: 'cli-runner',
        title: 'cli-runner annotator',
        version: '0.1.0',
      },
    })) as unknown;
    void initResponse;
    this.notify('initialized', {});
  }

  private writeMessage(payload: JsonRpcRequest | JsonRpcNotification): void {
    if (!this.child?.stdin) {
      throw new Error('codex app-server stdin is not available');
    }
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  private handleLine(line: string): void {
    if (!line) return;
    for (const fn of this.rawListeners) {
      try {
        fn(line);
      } catch {
        /* never let tracers break the read loop */
      }
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      // Non-JSON line on stdout — codex sometimes prints diagnostics
      // (especially on startup). Drop silently; raw listeners (above)
      // can still capture for tracing.
      return;
    }
    if (!parsed || typeof parsed !== 'object') return;
    const obj = parsed as Record<string, unknown>;

    // Server response: has an `id` matching one of our pending
    // requests AND a `result` or `error` field.
    if (
      'id' in obj &&
      (typeof obj.id === 'number' || typeof obj.id === 'string') &&
      ('result' in obj || 'error' in obj) &&
      !('method' in obj)
    ) {
      this.handleResponse(obj as unknown as JsonRpcResponse);
      return;
    }

    // Server-initiated request: has both `method` and `id`. We
    // auto-respond with a "denied / no-op" answer, then fan it out
    // as a notification too so observers can log it.
    if ('method' in obj && 'id' in obj && typeof obj.method === 'string') {
      this.handleServerRequest(obj as unknown as JsonRpcRequest);
      this.dispatchNotification(obj as unknown as JsonRpcNotification);
      return;
    }

    // Notification: just `method` (+ optional params), no id.
    if ('method' in obj && typeof obj.method === 'string') {
      this.dispatchNotification(obj as unknown as JsonRpcNotification);
    }
  }

  private handleResponse(msg: JsonRpcResponse): void {
    const id = typeof msg.id === 'string' ? Number.parseInt(msg.id, 10) : msg.id;
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    if (msg.error) {
      pending.reject(
        new Error(
          `codex ${pending.method} failed (${msg.error.code}): ${msg.error.message}`,
        ),
      );
    } else {
      pending.resolve(msg.result);
    }
  }

  private handleServerRequest(req: JsonRpcRequest): void {
    const id = req.id;
    let result: unknown;
    switch (req.method) {
      case 'execCommandApproval':
      case 'applyPatchApproval':
      case 'item/commandExecution/requestApproval':
      case 'item/fileChange/requestApproval':
      case 'item/permissions/requestApproval':
        result = { decision: 'denied' };
        break;
      case 'item/tool/requestUserInput':
        // Symphony's pattern — tell the tool there's no human here.
        result = { input: NON_INTERACTIVE_INPUT_ANSWER };
        break;
      case 'mcpServer/elicitation/request':
        result = { action: 'cancel' };
        break;
      case 'item/tool/call':
        // Dynamic tool calls — we don't expose any, so this is a misroute.
        // Reply with a short error result rather than a runtime exception.
        result = {
          content: [],
          isError: true,
          errorMessage: 'cli-runner does not host dynamic tools',
        };
        break;
      default:
        // Unknown reverse RPC — return an error reply so the server
        // doesn't deadlock waiting for a response.
        this.writeMessage({
          jsonrpc: '2.0',
          id,
          // @ts-expect-error JsonRpcResponse normally goes the other
          // direction; for server-initiated requests, the client
          // produces this shape too.
          error: { code: -32601, message: `Method not handled: ${req.method}` },
        });
        return;
    }
    this.writeMessage({
      jsonrpc: '2.0',
      id,
      // @ts-expect-error see comment above
      result,
    });
  }

  private dispatchNotification(n: JsonRpcNotification): void {
    for (const fn of this.notificationListeners) {
      try {
        fn(n);
      } catch (err) {
        // A listener throwing must not poison the read loop or other
        // listeners — log the failure and continue.
        // eslint-disable-next-line no-console
        console.error('[codexAppServer] notification listener threw', err);
      }
    }
  }

  private failPending(err: Error): void {
    for (const [, p] of this.pending) {
      try {
        p.reject(err);
      } catch {
        /* noop */
      }
    }
    this.pending.clear();
  }
}
