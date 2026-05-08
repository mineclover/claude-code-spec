/**
 * File-I/O round-trip tests for the persisted outline store. Same
 * isolation pattern as `summary-store.test.ts` — every test runs
 * against a temp dir via `SESSION_VIEWER_STORE_DIR`, so the user's
 * real `~/.session-viewer/outlines/` is never touched.
 */

import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteOutline,
  getOutline,
  listOutlines,
  saveOutline,
} from './outline-store';
import type { SessionOutline } from '../outline/types';

let tmp: string;
let prevEnv: string | undefined;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'sv-outline-test-'));
  prevEnv = process.env.SESSION_VIEWER_STORE_DIR;
  process.env.SESSION_VIEWER_STORE_DIR = tmp;
});

afterEach(async () => {
  if (prevEnv === undefined) delete process.env.SESSION_VIEWER_STORE_DIR;
  else process.env.SESSION_VIEWER_STORE_DIR = prevEnv;
  await rm(tmp, { recursive: true, force: true });
});

function outline(overrides: Partial<SessionOutline> = {}): SessionOutline {
  return {
    toolId: overrides.toolId ?? 'claude',
    sourceSessionId: overrides.sourceSessionId ?? 'src-1',
    cwd: overrides.cwd ?? '/Users/jun/work',
    steps: overrides.steps ?? [
      {
        index: 0,
        kind: 'user-instruction',
        turnIndex: 0,
        blockIndex: 0,
        excerpt: 'list files',
      },
    ],
    segments: overrides.segments ?? [
      {
        openedByStep: null,
        closedByStep: 0,
        userInstructionExcerpt: '',
        steps: [],
      },
    ],
    model: overrides.model,
    generatedAt: overrides.generatedAt ?? '2026-05-08T00:00:00.000Z',
    language: overrides.language,
    annotation: overrides.annotation,
  };
}

describe('outline-store round-trip', () => {
  it('saves and retrieves by sourceSessionId', async () => {
    const o = outline({ sourceSessionId: 'abc' });
    await saveOutline(o);
    const got = await getOutline('abc');
    expect(got).not.toBeNull();
    expect(got!.sourceSessionId).toBe('abc');
    expect(got!.steps).toHaveLength(1);
  });

  it('listOutlines returns newest-first by generatedAt', async () => {
    await saveOutline(
      outline({ sourceSessionId: 'old', generatedAt: '2026-04-01T00:00:00.000Z' }),
    );
    await saveOutline(
      outline({ sourceSessionId: 'mid', generatedAt: '2026-05-01T00:00:00.000Z' }),
    );
    await saveOutline(
      outline({ sourceSessionId: 'new', generatedAt: '2026-05-08T00:00:00.000Z' }),
    );
    const got = await listOutlines();
    expect(got.map((r) => r.sourceSessionId)).toEqual(['new', 'mid', 'old']);
  });

  it('listOutlines filters by toolId', async () => {
    await saveOutline(outline({ sourceSessionId: 'a', toolId: 'claude' }));
    await saveOutline(outline({ sourceSessionId: 'b', toolId: 'codex' }));
    const got = await listOutlines({ toolId: 'codex' });
    expect(got.map((r) => r.sourceSessionId)).toEqual(['b']);
  });

  it('listOutlines filters by annotatedOnly', async () => {
    await saveOutline(outline({ sourceSessionId: 'plain' }));
    await saveOutline(
      outline({
        sourceSessionId: 'tagged',
        annotation: {
          forks: [],
          remainingUntagged: 0,
          annotatedAt: '2026-05-08T00:00:00.000Z',
        },
      }),
    );
    const got = await listOutlines({ annotatedOnly: true });
    expect(got.map((r) => r.sourceSessionId)).toEqual(['tagged']);
  });

  it('saveOutline overwrites a prior outline with the same sourceSessionId', async () => {
    await saveOutline(outline({ sourceSessionId: 'x' }));
    await saveOutline(
      outline({
        sourceSessionId: 'x',
        steps: [
          { index: 0, kind: 'thinking', turnIndex: 0, blockIndex: 0, excerpt: 'reflect' },
          { index: 1, kind: 'assistant-text', turnIndex: 0, blockIndex: 1, excerpt: 'reply' },
        ],
      }),
    );
    const got = await getOutline('x');
    expect(got!.steps).toHaveLength(2);
    expect(got!.steps[0]!.kind).toBe('thinking');
  });

  it('deleteOutline removes the file; subsequent get returns null', async () => {
    await saveOutline(outline({ sourceSessionId: 'gone' }));
    expect(await getOutline('gone')).not.toBeNull();
    await deleteOutline('gone');
    expect(await getOutline('gone')).toBeNull();
  });

  it('deleteOutline on a missing id is a no-op', async () => {
    await expect(deleteOutline('never-saved')).resolves.toBeUndefined();
  });

  it('getOutline returns null when the file is missing', async () => {
    expect(await getOutline('never-saved')).toBeNull();
  });

  it('listOutlines skips malformed JSON without throwing', async () => {
    await saveOutline(outline({ sourceSessionId: 'good' }));
    await writeFile(join(tmp, 'broken.json'), '{not json', 'utf8');
    const got = await listOutlines();
    expect(got.map((r) => r.sourceSessionId)).toEqual(['good']);
  });

  it('saveOutline sanitises ids that contain path separators', async () => {
    await saveOutline(outline({ sourceSessionId: '../escape' }));
    const entries = await readdir(tmp);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e).not.toContain('/');
      expect(e).not.toMatch(/^\.\.\//);
    }
    expect(await getOutline('../escape')).not.toBeNull();
  });

  it('listOutlines on empty dir returns []', async () => {
    expect(await listOutlines()).toEqual([]);
  });
});
