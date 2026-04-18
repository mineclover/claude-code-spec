/**
 * App-wide IPC API exposed on `window.appAPI`.
 *
 * Today this is just the error subscription. Lives separately from per-domain
 * APIs because errors are cross-cutting — anything in main can call
 * errorReporter.report and the renderer toast surface should pick it up.
 */

import type { ErrorReport } from '../../lib/errorChannel';

export interface AppAPI {
  /**
   * Subscribe to error reports broadcast by the main process. Returns a
   * disposer that removes the listener. The renderer's ErrorToaster mounts
   * exactly one subscription on app startup.
   */
  onError: (callback: (report: ErrorReport) => void) => () => void;
}
