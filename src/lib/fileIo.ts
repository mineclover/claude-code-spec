/**
 * Atomic JSON file I/O helpers.
 *
 * Both async and sync variants write to a temporary sibling file and then
 * rename it over the target path, so a concurrent reader never observes a
 * half-written file. The temp name embeds pid + timestamp to avoid collisions
 * between processes.
 *
 * Shared between IPC handlers (async, used in request contexts) and core
 * services like McpResolverService.materialize (sync, invoked during an
 * execution startup where we don't want to promise-chain).
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

function encode(payload: unknown): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function tempNameFor(filePath: string): string {
  return `${filePath}.tmp-${process.pid}-${Date.now()}`;
}

/**
 * Async atomic write. Ensures the parent directory exists, then writes via a
 * temp file and rename. Use from IPC handlers and other async call sites.
 */
export async function writeJsonAtomic(filePath: string, payload: unknown): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const temp = tempNameFor(filePath);
  await fsp.writeFile(temp, encode(payload), 'utf-8');
  await fsp.rename(temp, filePath);
}

/**
 * Sync counterpart. Use from service layers where the surrounding code is
 * synchronous (e.g. when building the CLI spawn config on startup).
 */
export function writeJsonAtomicSync(filePath: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = tempNameFor(filePath);
  fs.writeFileSync(temp, encode(payload), 'utf-8');
  fs.renameSync(temp, filePath);
}

/**
 * Write raw text atomically (already-serialized payload). Lets the caller
 * decide on trailing newlines / canonical JSON without re-stringifying.
 */
export function writeTextAtomicSync(filePath: string, text: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = tempNameFor(filePath);
  fs.writeFileSync(temp, text, 'utf-8');
  fs.renameSync(temp, filePath);
}
