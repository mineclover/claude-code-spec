/**
 * ErrorToaster
 *
 * Subscribes to `window.appAPI.onError` and displays each ErrorReport as a
 * react-hot-toast error toast. The component renders nothing — it exists so
 * the subscription's lifecycle ties to the React tree.
 *
 * Multiple identical errors fired in quick succession are de-duplicated by
 * `${source}:${message}` for a short window so a tight retry loop doesn't
 * spam the screen.
 */

import { useEffect } from 'react';
import toast from 'react-hot-toast';

const RECENT_TOAST_TTL_MS = 1500;

export function ErrorToaster(): null {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.appAPI) return;

    const recent = new Map<string, number>();

    const dispose = window.appAPI.onError((report) => {
      const key = `${report.source}:${report.message}`;
      const now = Date.now();
      const last = recent.get(key);
      if (last !== undefined && now - last < RECENT_TOAST_TTL_MS) return;
      recent.set(key, now);

      // Garbage-collect stale entries opportunistically so the map stays small.
      if (recent.size > 32) {
        for (const [k, t] of recent) {
          if (now - t >= RECENT_TOAST_TTL_MS) recent.delete(k);
        }
      }

      toast.error(`${report.source}: ${report.message}`, {
        duration: 6000,
      });
    });
    return dispose;
  }, []);

  return null;
}
