#!/usr/bin/env node
/**
 * Install / uninstall the `cli-runner` symlink so it can be invoked from
 * any shell.
 *
 * Default target: `~/.local/bin/cli-runner` — that directory is on PATH
 * for most reasonable shell setups and is user-writable, so no sudo.
 * Override with the `--prefix <dir>` flag (e.g. `/usr/local/bin` for a
 * system-wide install — note that path usually needs sudo).
 *
 * The symlink points at this package's built `dist/cli.mjs`. As long as
 * the package stays in place (or gets bundled into a desktop app's
 * Resources/), the symlink keeps resolving to the right binary.
 *
 * Usage
 *   node scripts/install-bin.mjs [--prefix DIR] [--name NAME]
 *   node scripts/install-bin.mjs --uninstall [--prefix DIR] [--name NAME]
 */

import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, '..');
const TARGET = resolve(PACKAGE_ROOT, 'dist', 'cli.mjs');

function parseFlag(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const uninstall = process.argv.includes('--uninstall');
const prefix = parseFlag('--prefix', join(homedir(), '.local', 'bin'));
const name = parseFlag('--name', 'cli-runner');
const linkPath = join(prefix, name);

if (uninstall) {
  if (!existsSync(linkPath)) {
    console.error(`[install-bin] nothing at ${linkPath}; nothing to remove`);
    process.exit(0);
  }
  let stat;
  try {
    stat = lstatSync(linkPath);
  } catch (err) {
    console.error(`[install-bin] failed to stat ${linkPath}:`, err.message);
    process.exit(1);
  }
  if (!stat.isSymbolicLink()) {
    console.error(
      `[install-bin] refusing to remove ${linkPath}: not a symlink (would clobber a real file)`,
    );
    process.exit(1);
  }
  try {
    unlinkSync(linkPath);
    console.log(`[install-bin] removed ${linkPath}`);
  } catch (err) {
    console.error(`[install-bin] unlink failed:`, err.message);
    process.exit(1);
  }
  process.exit(0);
}

if (!existsSync(TARGET)) {
  console.error(
    `[install-bin] cli binary not found at ${TARGET} — run \`npm run build\` in this package first`,
  );
  process.exit(1);
}

try {
  chmodSync(TARGET, 0o755);
} catch {
  /* not fatal */
}

mkdirSync(prefix, { recursive: true });

if (existsSync(linkPath)) {
  let stat;
  try {
    stat = lstatSync(linkPath);
  } catch (err) {
    console.error(`[install-bin] failed to stat existing ${linkPath}:`, err.message);
    process.exit(1);
  }
  if (!stat.isSymbolicLink()) {
    console.error(
      `[install-bin] refusing to overwrite ${linkPath}: not a symlink (real file)`,
    );
    process.exit(1);
  }
  // If it already points at our target we're idempotent; else replace.
  try {
    const current = readlinkSync(linkPath);
    if (resolve(prefix, current) === TARGET) {
      console.log(`[install-bin] ${linkPath} already points at ${TARGET}`);
      process.exit(0);
    }
  } catch {
    /* fall through to replace */
  }
  unlinkSync(linkPath);
}

symlinkSync(TARGET, linkPath);
console.log(`[install-bin] linked ${linkPath} → ${TARGET}`);

// Friendly hint when the chosen prefix isn't on PATH.
const path = (process.env.PATH ?? '').split(':').map((p) => p.replace(/\/$/, ''));
if (!path.includes(prefix.replace(/\/$/, ''))) {
  console.log(
    `[install-bin] note: ${prefix} is not on your PATH — add it to your shell profile to call \`${name}\` directly:`,
  );
  console.log(`    export PATH="${prefix}:$PATH"`);
}
