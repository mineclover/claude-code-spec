import type { ElectrobunConfig } from 'electrobun/bun';

/**
 * Electrobun build/run config for the session-viewer PoC.
 *
 * Mirrors the official react-tailwind-vite template:
 *   - Vite builds the renderer to ../../dist (relative to its own root)
 *   - Electrobun copies dist/index.html and dist/assets into views/mainview/
 *     so the production build resolves `views://mainview/index.html`
 *   - In dev, src/bun/index.ts probes the Vite dev URL and falls back to
 *     the bundled views if it isn't running
 *
 * Run from this directory:
 *   npm run dev:hmr      # vite + electrobun dev together (HMR)
 *   npm run dev          # electrobun dev only (uses bundled views)
 *   npm run build:electrobun
 */
const config: ElectrobunConfig = {
  app: {
    name: 'Session Viewer',
    identifier: 'com.contextaction.session-viewer',
    version: '0.0.0',
    description: 'Cache-preserving session viewer (PoC).',
  },
  build: {
    bun: {
      // Filename must be `index.ts` — Electrobun's launcher hard-codes
      // `app/bun/index.js` as the Worker entry. Renaming will silently
      // spawn an empty worker.
      entrypoint: 'src/bun/index.ts',
    },
    copy: {
      'dist/index.html': 'views/mainview/index.html',
      'dist/assets': 'views/mainview/assets',
      // TODO(prod-packaging): bundle the cli-runner CLI inside the .app
      // (e.g. tsup --no-splitting --format=esm to produce a single self-
      // contained file under packages/cli-runner/dist/cli-bundle.mjs)
      // and copy it here as `tools/cli-runner.mjs`. Then add an
      // "Install CLI" button to the renderer that RPCs the bun host to
      // symlink that path into ~/.local/bin. For dev today, the same
      // outcome is achieved by `npm run install-cli` from the repo root.
    },
    // HMR drives the renderer via the Vite dev server, so we don't want
    // electrobun's --watch mode to rebuild on dist changes.
    watchIgnore: ['dist/**'],
    mac: { bundleCEF: false },
    linux: { bundleCEF: false },
    win: { bundleCEF: false },
  },
};

export default config;
