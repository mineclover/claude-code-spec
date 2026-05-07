/**
 * On-disk store for past Branch & Summarize results.
 *
 * Each persisted summary is a single JSON file under
 * `~/.session-viewer/summaries/<id>.json`. We deliberately avoid SQLite or
 * other heavyweight backends — the volume is low (one file per fork) and
 * users can browse / back up / delete the records by hand if they want.
 *
 * The store is a thin facade so the bun-side RPC handlers can stay terse:
 *   - `saveSummary(record)` writes one file
 *   - `listSummaries(filter)` reads the dir, parses everything, sorts newest-first
 *   - `getSummary(id)` reads one file
 *   - `deleteSummary(id)` removes it
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
import type {
  ListSummariesFilter,
  SummaryRecord,
} from '../types/portable';

const STORE_DIR = join(homedir(), '.session-viewer', 'summaries');

async function ensureDir(): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
}

function fileFor(id: string): string {
  // Sanitize defensively: ids come from the CLI so they should already be
  // UUIDs, but a hostile JSONL or a malformed adapter could produce slashes.
  const safe = id.replace(/[^A-Za-z0-9._-]/g, '_');
  return join(STORE_DIR, `${safe}.json`);
}

export async function saveSummary(record: SummaryRecord): Promise<void> {
  await ensureDir();
  await writeFile(fileFor(record.id), JSON.stringify(record, null, 2), 'utf8');
}

async function readRecord(path: string): Promise<SummaryRecord | null> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as SummaryRecord;
    if (!parsed.id || !parsed.summary) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function listSummaries(
  filter?: ListSummariesFilter,
): Promise<SummaryRecord[]> {
  await ensureDir();
  let entries: string[];
  try {
    entries = await readdir(STORE_DIR);
  } catch {
    return [];
  }
  const records: SummaryRecord[] = [];
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const rec = await readRecord(join(STORE_DIR, name));
    if (!rec) continue;
    if (
      filter?.sourceSessionId &&
      rec.sourceSessionId !== filter.sourceSessionId
    ) {
      continue;
    }
    records.push(rec);
  }
  records.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return records;
}

export async function getSummary(id: string): Promise<SummaryRecord | null> {
  return readRecord(fileFor(id));
}

export async function deleteSummary(id: string): Promise<void> {
  await rm(fileFor(id), { force: true });
}
