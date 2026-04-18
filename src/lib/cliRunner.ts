/**
 * Thin execa wrappers used by every CLI call site in the app.
 *
 * Two shapes:
 *   - runBuffered  : one-shot command, buffer stdout/stderr, return once done.
 *                    Used for version probes, single-output utilities.
 *   - spawnStreaming : long-running spawn with an on-data handler. The caller
 *                      keeps the subprocess reference and may kill, pipe, or
 *                      read streams at will. Returns the subprocess so the
 *                      existing StreamParser integration stays simple.
 *
 * Both wrappers merge in the enhanced PATH from shellPath so macOS
 * .app-launched processes find `claude`, `npm`, `bun`, etc.
 */

import { execa, type ResultPromise, type Subprocess } from 'execa';
import { getSpawnEnv } from './shellPath';

export interface RunBufferedOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Piped to stdin as-is. */
  input?: string;
  /** Hard kill after this many ms. Default: no timeout. */
  timeoutMs?: number;
  /** After `killSignal`, wait this many ms and send SIGKILL. Default 3000. */
  forceKillAfterMs?: number;
}

export interface RunBufferedResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** Present when the subprocess failed to launch (ENOENT, EACCES, ...). */
  spawnErrorCode?: string;
  /** Human-readable error message when launch failed or the process errored. */
  error?: string;
}

/**
 * Run a command to completion and buffer its output. Never throws on non-zero
 * exit: the result object carries exitCode/stdout/stderr instead.
 */
export async function runBuffered(
  command: string,
  args: readonly string[],
  options: RunBufferedOptions = {},
): Promise<RunBufferedResult> {
  const env = { ...getSpawnEnv(), ...(options.env ?? {}) };
  try {
    const result = await execa(command, args, {
      cwd: options.cwd,
      env,
      input: options.input,
      timeout: options.timeoutMs,
      forceKillAfterDelay: options.forceKillAfterMs ?? 3000,
      reject: false,
      all: false,
    });
    return {
      exitCode: result.exitCode ?? null,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  } catch (err) {
    // Only thrown for genuinely broken invocations (invalid option shape etc).
    const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    return {
      exitCode: null,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      spawnErrorCode: e.code,
      error: e.message,
    };
  }
}

export interface SpawnStreamingOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Piped to stdin once on start. stdin is closed afterwards. */
  input?: string;
  /** On POSIX, spawning through a shell. Default false. */
  shell?: boolean;
}

export type StreamingSubprocess = Subprocess;
export type StreamingPromise = ResultPromise;

/**
 * Spawn a command and hand the caller the live subprocess. Callers wire
 * up stdout/stderr listeners themselves (the StreamParser does this). The
 * returned promise resolves when the process exits; the `subprocess`
 * reference is also returned for kill / stdin access.
 */
export function spawnStreaming(
  command: string,
  args: readonly string[],
  options: SpawnStreamingOptions = {},
): StreamingPromise {
  const env = { ...getSpawnEnv(), ...(options.env ?? {}) };
  // forceKillAfterDelay makes `subprocess.kill()` escalate SIGTERM→SIGKILL
  // after 3s automatically, replacing the previous manual setTimeout dance.
  return execa(command, args, {
    cwd: options.cwd,
    env,
    input: options.input,
    reject: false,
    shell: options.shell,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    forceKillAfterDelay: 3000,
  });
}
