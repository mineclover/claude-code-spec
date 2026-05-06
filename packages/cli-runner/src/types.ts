/**
 * Public surface for cli-runner.
 *
 * The runner takes a "fork context" (which session to branch from, what
 * kind of evaluation to run) and produces a complete `SummaryResult`. The
 * runner owns the prefix-preservation mechanic — copying the source's
 * JSONL into a new sessionId, spawning the CLI against the copy, capturing
 * the stream, validating the model's JSON output, and synthesizing the
 * `cacheInvariants` block from observed token counts.
 */

import type {
  SummaryLanguage as DomainSummaryLanguage,
  SummaryResult,
} from '@context-action/session-core';

/**
 * Re-exported for convenience — runners receive this through ForkContext.
 * Canonical definition lives in @context-action/session-core/summary/types.
 */
export type SummaryLanguage = DomainSummaryLanguage;

/**
 * In-process progress callback type for cli-runner. The Electrobun host
 * forwards each event verbatim to the renderer as a `BranchProgressEvent`
 * (see apps/session-viewer/src/shared/rpc-schema.ts). The two shapes MUST
 * stay in sync — they're declared separately because cli-runner has no
 * dependency on the renderer's transport types.
 */
export type ForkProgressPhase =
  | 'started'
  | 'cli-spawned'
  | 'system-init'
  | 'assistant-streaming'
  | 'assistant-complete'
  | 'parsed'
  | 'failed';

export interface ForkProgress {
  /** Source session being forked from. */
  sourceSessionId: string;
  /** Coarse phase — UI uses it to drive spinner + status text. */
  phase: ForkProgressPhase;
  /** Operator-facing one-liner. */
  message?: string;
  /** Wall-clock ms since the runner began. */
  elapsedMs: number;
  /** Newly-minted fork session id, set once the system/init event fires. */
  forkSessionId?: string;
  /**
   * Delta text for the assistant turn currently streaming. Only present
   * when phase === 'assistant-streaming'. Renderer accumulates these
   * deltas to show the model's response forming in real time.
   */
  textDelta?: string;
  /** Cumulative cache_read tokens observed so far. */
  cacheReadTokens?: number;
  /** Human-readable error blurb when phase === 'failed'. */
  error?: string;
}

export interface ForkContext {
  /** Session being branched from — must already exist on disk. */
  sourceSessionId: string;
  /**
   * cwd of the source session. Required because the underlying CLI usually
   * resolves the dash-encoded project directory from cwd, and the fork
   * needs to land in the same project space so cache lookup matches.
   */
  cwd: string;
  /** Which CLI owns the session — drives which runner is dispatched. */
  toolId: 'claude' | 'codex' | 'gemini';
  /** What the sidecar should do; v1 supports `summarize` only. */
  kind?: 'summarize';
  /** Output language for the model narrative — defaults to 'en'. */
  language?: SummaryLanguage;
  /**
   * Free-form text appended after the canonical prompt template. Lets the
   * operator narrow the eval ("focus on the auth flow") without losing the
   * JSON-envelope contract.
   */
  promptOverride?: string;
  /**
   * Optional progress sink. The runner calls this with `ForkProgress`
   * events as the fork advances; the bun host forwards them to the
   * renderer via RPC so the operator can watch the model think instead
   * of staring at a static spinner.
   */
  onProgress?: (event: ForkProgress) => void;
}

export interface RunnerCapability {
  toolId: ForkContext['toolId'];
  /**
   * Whether this runner supports the current host environment. False when
   * required CLI binary or platform features are missing — surfaced to the
   * UI as a disabled "Branch & Summarize" button rather than a crash.
   */
  available: boolean;
  /** Human-readable reason when `available === false`. */
  unavailableReason?: string;
}

export interface CliRunner {
  capability(): Promise<RunnerCapability>;
  fork(ctx: ForkContext): Promise<SummaryResult>;
}

/**
 * Errors thrown by runners. The UI translates these into actionable banners
 * — `RunnerUnavailableError` becomes a "this CLI isn't installed" hint,
 * `ForkPrerequisiteError` becomes a "we couldn't find the source session"
 * message, and `ModelOutputParseError` triggers a "raw output" fallback
 * panel so the operator at least sees what the model said.
 */
export class RunnerUnavailableError extends Error {
  constructor(
    public readonly toolId: ForkContext['toolId'],
    public readonly reason: string,
  ) {
    super(`CLI runner not available for ${toolId}: ${reason}`);
    this.name = 'RunnerUnavailableError';
  }
}

export class ForkPrerequisiteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForkPrerequisiteError';
  }
}

export class ModelOutputParseError extends Error {
  constructor(
    message: string,
    public readonly rawOutput: string,
  ) {
    super(message);
    this.name = 'ModelOutputParseError';
  }
}
