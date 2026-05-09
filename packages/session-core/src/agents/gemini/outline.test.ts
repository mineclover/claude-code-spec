/**
 * Gemini outline extractor tests. Fixtures are JSON documents in the
 * shape Gemini writes to ~/.gemini/tmp/<projectHash>/chats/session-*.json
 * — `{ sessionId, projectHash, startTime, lastUpdated, messages: [...]
 * }` with per-message `thoughts` and `toolCalls` arrays.
 */

import { describe, expect, it } from 'vitest';
import { extractGeminiOutline } from './outline';

function geminiSession(messages: object[]): string {
  return JSON.stringify({
    sessionId: 's',
    projectHash: 'hash',
    startTime: '2026-05-08T00:00:00Z',
    lastUpdated: '2026-05-08T00:01:00Z',
    messages,
  });
}

describe('extractGeminiOutline', () => {
  it('classifies a typical user→gemini text round-trip', () => {
    const raw = geminiSession([
      { id: 'm1', timestamp: '2026-05-08T00:00:01Z', type: 'user', content: 'list files' },
      { id: 'm2', timestamp: '2026-05-08T00:00:02Z', type: 'gemini', content: 'Here are the files.' },
    ]);
    const o = extractGeminiOutline({
      raw,
      sourceSessionId: 's',
      cwd: '/',
    });
    expect(o.toolId).toBe('gemini');
    expect(o.steps.map((s) => s.kind)).toEqual([
      'user-instruction',
      'assistant-text',
    ]);
  });

  it('emits thinking → tool-call → tool-result → assistant-text in order', () => {
    const raw = geminiSession([
      { id: 'm1', type: 'user', content: 'find imports' },
      {
        id: 'm2',
        type: 'gemini',
        content: 'Found 2 files.',
        thoughts: [{ subject: 'plan', description: 'rg -l import', timestamp: 'x' }],
        toolCalls: [
          {
            id: 'c1',
            name: 'shell',
            args: { cmd: 'rg -l import' },
            result: 'src/a.ts\nsrc/b.ts',
            status: 'success',
            displayName: 'Run shell',
          },
        ],
      },
    ]);
    const o = extractGeminiOutline({
      raw,
      sourceSessionId: 's',
      cwd: '/',
    });
    expect(o.steps.map((s) => s.kind)).toEqual([
      'user-instruction',
      'thinking',
      'tool-call',
      'tool-result',
      'assistant-text',
    ]);
    expect(o.steps.find((s) => s.kind === 'tool-call')!.toolName).toBe('shell');
    expect(o.steps.find((s) => s.kind === 'tool-result')!.excerpt).toContain(
      'src/a.ts',
    );
  });

  it('reads complex tool result via functionResponse.output', () => {
    const raw = geminiSession([
      { id: 'm1', type: 'user', content: 'q' },
      {
        id: 'm2',
        type: 'gemini',
        content: '',
        toolCalls: [
          {
            id: 'c',
            name: 'list_directory',
            args: { dir_path: 'docs' },
            result: [
              {
                functionResponse: {
                  id: 'c',
                  name: 'list_directory',
                  response: { output: 'README.md\narchitecture.md' },
                },
              },
            ],
            status: 'success',
          },
        ],
      },
    ]);
    const o = extractGeminiOutline({
      raw,
      sourceSessionId: 's',
      cwd: '/',
    });
    const result = o.steps.find((s) => s.kind === 'tool-result');
    expect(result).toBeDefined();
    expect(result!.excerpt).toContain('README.md');
    expect(result!.excerpt).toContain('architecture.md');
  });

  it('falls back to resultDisplay when result is structured but a friendly string exists', () => {
    const raw = geminiSession([
      { id: 'm1', type: 'user', content: 'q' },
      {
        id: 'm2',
        type: 'gemini',
        content: '',
        toolCalls: [
          {
            name: 'tool',
            args: {},
            result: { weird: 'shape' },
            resultDisplay: 'Listed 14 items',
          },
        ],
      },
    ]);
    const o = extractGeminiOutline({
      raw,
      sourceSessionId: 's',
      cwd: '/',
    });
    expect(o.steps.find((s) => s.kind === 'tool-result')!.excerpt).toBe(
      'Listed 14 items',
    );
  });

  it('skips empty content gemini messages without emitting an empty assistant-text step', () => {
    const raw = geminiSession([
      { id: 'm1', type: 'user', content: 'q' },
      { id: 'm2', type: 'gemini', content: '' },
    ]);
    const o = extractGeminiOutline({ raw, sourceSessionId: 's', cwd: '/' });
    const texts = o.steps.filter((s) => s.kind === 'assistant-text');
    expect(texts).toHaveLength(0);
  });

  it('returns an empty outline for malformed JSON', () => {
    const o = extractGeminiOutline({
      raw: '{not json',
      sourceSessionId: 's',
      cwd: '/',
    });
    expect(o.steps).toEqual([]);
    expect(o.toolId).toBe('gemini');
  });

  it('classifies unknown message types as meta', () => {
    const raw = geminiSession([
      { id: 'm1', type: 'system', content: 'startup notice' },
    ]);
    const o = extractGeminiOutline({ raw, sourceSessionId: 's', cwd: '/' });
    expect(o.steps.map((s) => s.kind)).toEqual(['meta']);
  });

  it('groups segments using user-instruction boundaries', () => {
    const raw = geminiSession([
      { id: 'a', type: 'user', content: 'q1' },
      { id: 'b', type: 'gemini', content: 'a1' },
      { id: 'c', type: 'user', content: 'q2' },
      { id: 'd', type: 'gemini', content: 'a2' },
    ]);
    const o = extractGeminiOutline({ raw, sourceSessionId: 's', cwd: '/' });
    const userTurns = o.steps.filter((s) => s.kind === 'user-instruction');
    expect(userTurns).toHaveLength(2);
    expect(o.segments.length).toBeGreaterThanOrEqual(3);
  });
});
