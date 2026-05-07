/**
 * On-disk store for annotated session outlines.
 *
 * Each outline is persisted to a single JSON file at
 * `~/.session-viewer/outlines/<sourceSessionId>.json`. We key by
 * `sourceSessionId` (not a record id) so re-running annotation against
 * the same session overwrites in place — there is exactly one annotated
 * outline per source session.
 *
 * Mirrors `summary-store.ts` in shape (lazy directory resolution via
 * `SESSION_VIEWER_STORE_DIR`, defensive id sanitisation, malformed-JSON
 * tolerance) so the test patterns transfer.
 */

import {
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { SessionOutline } from '../outline/types';

function storeDir(): string {
  const base =
    process.env.SESSION_VIEWER_STORE_DIR ??
    join(homedir(), '.session-viewer');
  // When the env override is set we drop straight into it (test isolation).
  // Otherwise we use the dedicated `outlines/` subdir.
  return process.env.SESSION_VIEWER_STORE_DIR
    ? base
    : join(base, 'outlines');
}

async function ensureDir(): Promise<void> {
  await mkdir(storeDir(), { recursive: true });
}

function fileFor(id: string): string {
  const safe = id.replace(/[^A-Za-z0-9._-]/g, '_');
  return join(storeDir(), `${safe}.json`);
}

export async function saveOutline(outline: SessionOutline): Promise<void> {
  await ensureDir();
  await writeFile(
    fileFor(outline.sourceSessionId),
    JSON.stringify(outline, null, 2),
    'utf8',
  );
}

async function readRecord(path: string): Promise<SessionOutline | null> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as SessionOutline;
    if (!parsed.sourceSessionId || !Array.isArray(parsed.steps)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface ListOutlinesFilter {
  toolId?: SessionOutline['toolId'];
  sourceSessionId?: string;
  /** Only outlines that have been annotated. */
  annotatedOnly?: boolean;
}

export async function listOutlines(
  filter?: ListOutlinesFilter,
): Promise<SessionOutline[]> {
  await ensureDir();
  let entries: string[];
  try {
    entries = await readdir(storeDir());
  } catch {
    return [];
  }
  const out: SessionOutline[] = [];
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const rec = await readRecord(join(storeDir(), name));
    if (!rec) continue;
    if (filter?.toolId && rec.toolId !== filter.toolId) continue;
    if (
      filter?.sourceSessionId &&
      rec.sourceSessionId !== filter.sourceSessionId
    )
      continue;
    if (filter?.annotatedOnly && !rec.annotation) continue;
    out.push(rec);
  }
  out.sort(
    (a, b) =>
      new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime(),
  );
  return out;
}

export async function getOutline(
  sourceSessionId: string,
): Promise<SessionOutline | null> {
  return readRecord(fileFor(sourceSessionId));
}

export async function deleteOutline(sourceSessionId: string): Promise<void> {
  await rm(fileFor(sourceSessionId), { force: true });
}
