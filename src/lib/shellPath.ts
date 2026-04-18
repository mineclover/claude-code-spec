/**
 * Augment the PATH used when spawning external CLIs.
 *
 * Electron apps launched from Finder / a `.app` bundle do not inherit the
 * user's login-shell PATH (~/.zshrc, ~/.bash_profile etc.), so commands like
 * `claude`, `npm`, `bun`, `npx` are not found even when installed. This
 * module computes an enhanced PATH by prepending well-known global-bin
 * directories that are missing from the inherited PATH, and caches the
 * result for the lifetime of the process.
 *
 * Strategy:
 *   additions first (highest priority) → then the original PATH.
 */

import os from 'node:os';

function computeEnhancedPath(): string {
  const home = os.homedir();
  const existing = new Set((process.env.PATH ?? '').split(':').filter(Boolean));
  const candidates = [
    `${home}/.local/bin`, // pipx, claude code
    `${home}/.bun/bin`, // bun global
    `${home}/.deno/bin`, // deno
    '/opt/homebrew/bin', // Apple-Silicon Homebrew
    '/opt/homebrew/sbin',
    '/usr/local/bin', // Intel Homebrew / traditional npm global
    '/usr/local/sbin',
  ];
  const additions = candidates.filter((p) => !existing.has(p));
  return [...additions, ...existing].join(':');
}

let cachedPath: string | null = null;

/** Get the enhanced PATH string. Cached on first call. */
export function getEnhancedPath(): string {
  if (cachedPath === null) {
    cachedPath = computeEnhancedPath();
  }
  return cachedPath;
}

/** Return process.env with the enhanced PATH applied. Cached. */
export function getSpawnEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: getEnhancedPath() };
}

/** For tests / corner cases: force recomputation on next access. */
export function resetEnhancedPathCache(): void {
  cachedPath = null;
}
