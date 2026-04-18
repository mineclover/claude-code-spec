/**
 * Process-wide error reporter.
 *
 * Services that previously swallowed errors with `console.error` should also
 * push them through this reporter so the renderer can surface them via toast.
 * The reporter itself is electron-free — it just multiplexes reports to any
 * registered subscriber. The main-process IPC handler subscribes to broadcast
 * over `app:error`; the renderer never imports this module.
 */

import { formatError } from '../lib/errorChannel';
import type { ErrorReport } from '../lib/errorChannel';

export type ErrorReportSubscriber = (report: ErrorReport) => void;

class ErrorReporter {
  private subscribers = new Set<ErrorReportSubscriber>();

  /** Push a report to every subscriber. */
  report(source: string, err: unknown): ErrorReport {
    const { message, detail } = formatError(err);
    const report: ErrorReport = { source, message, detail, at: Date.now() };
    for (const sub of this.subscribers) {
      try {
        sub(report);
      } catch {
        // A subscriber that throws must never break the reporter or other
        // subscribers; swallow defensively.
      }
    }
    return report;
  }

  /** Add a subscriber. Returns a disposer. */
  subscribe(sub: ErrorReportSubscriber): () => void {
    this.subscribers.add(sub);
    return () => {
      this.subscribers.delete(sub);
    };
  }

  /** Test seam — drop all subscribers. */
  reset(): void {
    this.subscribers.clear();
  }

  /** Test seam — observable subscriber count. */
  get subscriberCount(): number {
    return this.subscribers.size;
  }
}

export const errorReporter = new ErrorReporter();
