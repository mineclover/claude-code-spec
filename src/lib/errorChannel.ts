/**
 * Shared error report shape carried over the `app:error` IPC channel and
 * displayed by the renderer's ErrorToaster.
 *
 * Pure: no electron, no IO. Both the main-side reporter and the renderer-side
 * subscriber import from here so the message and detail conventions stay in
 * agreement.
 */

export interface ErrorReport {
  /** Module / subsystem that originated the failure (e.g. "claudeSessions"). */
  source: string;
  /** Short human-readable summary. */
  message: string;
  /** Optional longer text — typically a stack trace or the raw error string. */
  detail?: string;
  /** Wall-clock time the report was created (Date.now()). */
  at: number;
}

/**
 * Coerce an arbitrary thrown value into a (message, detail) pair suitable for
 * an ErrorReport. Handles Errors, strings, and objects with a `message`
 * property; falls back to JSON.stringify for everything else.
 */
export function formatError(err: unknown): { message: string; detail?: string } {
  if (err instanceof Error) {
    return {
      message: err.message || err.name || 'Unknown error',
      detail: err.stack,
    };
  }
  if (typeof err === 'string') {
    return { message: err };
  }
  if (err === null || err === undefined) {
    return { message: 'Unknown error' };
  }
  if (typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === 'string' && msg.length > 0) {
      return { message: msg, detail: safeStringify(err) };
    }
  }
  return { message: 'Unknown error', detail: safeStringify(err) };
}

function safeStringify(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}
