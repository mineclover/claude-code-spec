import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SessionAnalyticsService } from './SessionAnalyticsService';

/**
 * Build a minimal JSONL log shape that the service's reducers know how to
 * read: an assistant event with `message.usage` populated, plus an attachment
 * event carrying a deferred_tools_delta. Those two flavors exercise the cache
 * metrics reducer, model extraction, tool-set tracking, and cwd extraction.
 */
function assistantEvent(opts: {
  cwd?: string;
  model?: string;
  inputTokens?: number;
  cacheReadInputTokens?: number;
}): string {
  return JSON.stringify({
    type: 'assistant',
    cwd: opts.cwd,
    message: {
      model: opts.model,
      usage: {
        input_tokens: opts.inputTokens ?? 0,
        cache_read_input_tokens: opts.cacheReadInputTokens ?? 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    },
  });
}

function toolDeltaEvent(added: string[], removed: string[] = []): string {
  return JSON.stringify({
    type: 'attachment',
    attachment: {
      type: 'deferred_tools_delta',
      addedNames: added,
      removedNames: removed,
    },
  });
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-'));
const projectDir = path.join(tmpRoot, 'proj');

beforeAll(() => {
  fs.mkdirSync(projectDir, { recursive: true });
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('SessionAnalyticsService.analyzeSessionFile', () => {
  it('extracts model, tools, cwd, and cache metrics from a JSONL log', () => {
    const sessionId = 'sess-extract';
    const file = path.join(projectDir, `${sessionId}.jsonl`);
    fs.writeFileSync(
      file,
      [
        assistantEvent({
          cwd: '/repo/foo',
          model: 'claude-sonnet-4-6',
          inputTokens: 100,
          cacheReadInputTokens: 400,
        }),
        toolDeltaEvent(['Read', 'Edit'], []),
        assistantEvent({
          inputTokens: 50,
          cacheReadInputTokens: 150,
        }),
      ].join('\n'),
    );

    const svc = new SessionAnalyticsService();
    const meta = svc.analyzeSessionFile(file, sessionId);

    expect(meta.source).toBe('derived');
    expect(meta.sessionId).toBe(sessionId);
    expect(meta.projectPath).toBe('/repo/foo');
    expect(meta.details.model).toBe('claude-sonnet-4-6');
    expect(meta.details.tools).toEqual(['Edit', 'Read']);
    expect(meta.details.eventCount).toBe(3);
    expect(meta.metrics.inputTokens).toBe(150);
    expect(meta.metrics.cacheReadInputTokens).toBe(550);
    expect(meta.fingerprintHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the cached meta when the file signature is unchanged', () => {
    const sessionId = 'sess-cache';
    const file = path.join(projectDir, `${sessionId}.jsonl`);
    fs.writeFileSync(file, assistantEvent({ inputTokens: 1, model: 'm' }));

    const svc = new SessionAnalyticsService();
    expect(svc.cacheSize).toBe(0);
    const first = svc.analyzeSessionFile(file, sessionId);
    expect(svc.cacheSize).toBe(1);
    const second = svc.analyzeSessionFile(file, sessionId);
    expect(second).toBe(first);
    expect(svc.cacheSize).toBe(1);
  });

  it('recomputes when the file changes (signature mismatch)', () => {
    const sessionId = 'sess-recompute';
    const file = path.join(projectDir, `${sessionId}.jsonl`);
    fs.writeFileSync(file, assistantEvent({ inputTokens: 10, model: 'm1' }));

    const svc = new SessionAnalyticsService();
    const first = svc.analyzeSessionFile(file, sessionId);

    // Force a new mtime + larger size by appending another event.
    fs.appendFileSync(file, `\n${assistantEvent({ inputTokens: 20, model: 'm1' })}`);
    // Bump mtime explicitly in case the append landed on the same ms tick.
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(file, future, future);

    const second = svc.analyzeSessionFile(file, sessionId);
    expect(second).not.toBe(first);
    expect(second.metrics.inputTokens).toBe(30);
  });

  it('tolerates malformed JSON lines', () => {
    const sessionId = 'sess-malformed';
    const file = path.join(projectDir, `${sessionId}.jsonl`);
    fs.writeFileSync(
      file,
      [
        assistantEvent({ inputTokens: 5, model: 'mx' }),
        '{this is not json',
        '',
        assistantEvent({ inputTokens: 10 }),
      ].join('\n'),
    );

    const svc = new SessionAnalyticsService();
    const meta = svc.analyzeSessionFile(file, sessionId);
    expect(meta.metrics.inputTokens).toBe(15);
    // Two valid events plus one parse-failed line that's skipped.
    expect(meta.details.eventCount).toBe(2);
  });
});

describe('SessionAnalyticsService.analyzeProjectDir', () => {
  it('skips ids in skipSessionIds and emits a final progress callback', () => {
    const dir = fs.mkdtempSync(path.join(tmpRoot, 'projdir-'));
    fs.writeFileSync(path.join(dir, 'sA.jsonl'), assistantEvent({ inputTokens: 1, model: 'a' }));
    fs.writeFileSync(path.join(dir, 'sB.jsonl'), assistantEvent({ inputTokens: 1, model: 'b' }));
    fs.writeFileSync(path.join(dir, 'sC.jsonl'), assistantEvent({ inputTokens: 1, model: 'c' }));

    const svc = new SessionAnalyticsService();
    const seen: Array<{ phase: string; current: number; total: number; skipped: number }> = [];
    const result = svc.analyzeProjectDir(dir, {
      skipSessionIds: new Set(['sB']),
      onProgress: (p) => seen.push(p),
    });

    expect(result.size).toBe(2);
    expect(result.has('sA')).toBe(true);
    expect(result.has('sC')).toBe(true);
    expect(result.has('sB')).toBe(false);
    const last = seen.at(-1);
    expect(last?.phase).toBe('done');
    expect(last?.total).toBe(3);
    expect(last?.skipped).toBe(1);
  });

  it('returns an empty map and a done progress when the directory is missing', () => {
    const svc = new SessionAnalyticsService();
    const seen: Array<{ phase: string }> = [];
    const result = svc.analyzeProjectDir(path.join(tmpRoot, 'no-such-dir'), {
      onProgress: (p) => seen.push(p),
    });
    expect(result.size).toBe(0);
    expect(seen.at(-1)?.phase).toBe('done');
  });

  it('serves a second pass from cache when files have not changed', () => {
    const dir = fs.mkdtempSync(path.join(tmpRoot, 'cachedir-'));
    fs.writeFileSync(path.join(dir, 's1.jsonl'), assistantEvent({ inputTokens: 1, model: 'm' }));

    const svc = new SessionAnalyticsService();
    svc.analyzeProjectDir(dir);

    let cachedCount = 0;
    svc.analyzeProjectDir(dir, {
      onProgress: (p) => {
        if (p.phase === 'done') cachedCount = p.cached;
      },
    });
    expect(cachedCount).toBe(1);
  });
});
