/**
 * File-I/O round-trip tests for the persisted summary store.
 *
 * Each test runs against an isolated temp directory via the
 * `SESSION_VIEWER_STORE_DIR` env override, so the user's real
 * `~/.session-viewer/summaries/` is never touched.
 */

import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteSummary,
  getSummary,
  listSummaries,
  saveSummary,
} from './summary-store';
import type { SummaryRecord } from '../types/portable';

let tmp: string;
let prevEnv: string | undefined;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'sv-store-test-'));
  prevEnv = process.env.SESSION_VIEWER_STORE_DIR;
  process.env.SESSION_VIEWER_STORE_DIR = tmp;
});

afterEach(async () => {
  if (prevEnv === undefined) delete process.env.SESSION_VIEWER_STORE_DIR;
  else process.env.SESSION_VIEWER_STORE_DIR = prevEnv;
  await rm(tmp, { recursive: true, force: true });
});

function record(overrides: Partial<SummaryRecord> = {}): SummaryRecord {
  return {
    id: overrides.id ?? 'rec-1',
    sourceSessionId: overrides.sourceSessionId ?? 'src-1',
    toolId: overrides.toolId ?? 'claude',
    cwd: overrides.cwd ?? '/Users/jun/work',
    createdAt: overrides.createdAt ?? '2026-05-08T00:00:00.000Z',
    language: overrides.language,
    promptOverride: overrides.promptOverride,
    summary: overrides.summary ?? {
      oneLiner: 'one',
      narrative: 'two',
      keyDecisions: [],
      references: [],
      openItems: [],
      nextActions: [],
      generatedAt: '2026-05-08T00:00:00.000Z',
    },
  };
}

describe('summary-store round-trip', () => {
  it('saves a record and retrieves it by id', async () => {
    const r = record({ id: 'abc-1' });
    await saveSummary(r);
    const got = await getSummary('abc-1');
    expect(got).not.toBeNull();
    expect(got!.id).toBe('abc-1');
    expect(got!.summary.oneLiner).toBe('one');
  });

  it('listSummaries returns newest-first', async () => {
    await saveSummary(record({ id: 'old', createdAt: '2026-04-01T00:00:00.000Z' }));
    await saveSummary(record({ id: 'mid', createdAt: '2026-05-01T00:00:00.000Z' }));
    await saveSummary(record({ id: 'new', createdAt: '2026-05-08T00:00:00.000Z' }));
    const got = await listSummaries();
    expect(got.map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });

  it('listSummaries filters by sourceSessionId', async () => {
    await saveSummary(record({ id: 'a', sourceSessionId: 'X' }));
    await saveSummary(record({ id: 'b', sourceSessionId: 'Y' }));
    await saveSummary(record({ id: 'c', sourceSessionId: 'X' }));
    const got = await listSummaries({ sourceSessionId: 'X' });
    expect(got.map((r) => r.id).sort()).toEqual(['a', 'c']);
  });

  it('saveSummary overwrites a prior record with the same id', async () => {
    await saveSummary(record({ id: 'k', summary: undefined }));
    const updated = record({
      id: 'k',
      summary: {
        oneLiner: 'updated',
        narrative: 'changed',
        keyDecisions: [],
        references: [],
        openItems: [],
        nextActions: [],
        generatedAt: '2026-05-08T01:00:00.000Z',
      },
    });
    await saveSummary(updated);
    const got = await getSummary('k');
    expect(got?.summary.oneLiner).toBe('updated');
  });

  it('deleteSummary removes the file; subsequent get returns null', async () => {
    await saveSummary(record({ id: 'gone' }));
    expect(await getSummary('gone')).not.toBeNull();
    await deleteSummary('gone');
    expect(await getSummary('gone')).toBeNull();
  });

  it('deleteSummary on a missing id is a no-op (no throw)', async () => {
    await expect(deleteSummary('nonexistent-id')).resolves.toBeUndefined();
  });

  it('getSummary returns null when the file is missing', async () => {
    expect(await getSummary('never-saved')).toBeNull();
  });

  it('listSummaries skips files with malformed JSON without throwing', async () => {
    await saveSummary(record({ id: 'good' }));
    await writeFile(join(tmp, 'broken.json'), '{not json', 'utf8');
    const got = await listSummaries();
    expect(got.map((r) => r.id)).toEqual(['good']);
  });

  it('saveSummary sanitises ids that contain path separators', async () => {
    // The store uses `${id}.json` directly, so a malicious id like
    // "../escape" must be sanitised before joining. After save, every
    // file in the directory must be a single segment with no path
    // separator and no leading "..".
    await saveSummary(record({ id: '../escape' }));
    const entries = await readdir(tmp);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e).not.toContain('/');
      // The sanitisation is allowed to keep dots (we want to keep
      // file extensions readable), but the leading "../" is what
      // matters for path traversal — that has to be neutralised.
      expect(e).not.toMatch(/^\.\.\//);
    }
    // The original id is still recoverable by the same id we passed in.
    const got = await getSummary('../escape');
    expect(got).not.toBeNull();
  });

  it('listSummaries on empty dir returns empty array', async () => {
    expect(await listSummaries()).toEqual([]);
  });
});
