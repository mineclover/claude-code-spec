/**
 * Pin the Claude outline extractor against the JSONL shapes the CLI
 * actually emits.
 *
 * Each fixture is a hand-rolled JSONL string that mimics the relevant
 * lines from a real `~/.claude/projects/<dir>/<id>.jsonl`. We don't
 * point at real session files because they change behind our backs —
 * fixtures pin the parser to specific event shapes.
 */

import { describe, expect, it } from 'vitest';
import { extractClaudeOutline } from './outline';

function lines(...rows: object[]): string {
  return rows.map((r) => JSON.stringify(r)).join('\n');
}

describe('extractClaudeOutline — flat steps', () => {
  it('classifies a typical user → assistant text round-trip', () => {
    const raw = lines(
      {
        type: 'user',
        message: { role: 'user', content: 'list files in src' },
        timestamp: '2026-05-08T00:00:01.000Z',
      },
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-6',
          content: [{ type: 'text', text: 'Here are the files…' }],
        },
        timestamp: '2026-05-08T00:00:02.000Z',
      },
    );
    const o = extractClaudeOutline({
      raw,
      sourceSessionId: 'src-1',
      cwd: '/Users/jun/foo',
    });
    expect(o.toolId).toBe('claude');
    expect(o.model).toBe('claude-sonnet-4-6');
    expect(o.steps.map((s) => s.kind)).toEqual([
      'user-instruction',
      'assistant-text',
    ]);
    expect(o.steps[0]!.excerpt).toBe('list files in src');
    expect(o.steps[1]!.excerpt).toBe('Here are the files…');
  });

  it('captures thinking → tool-call → tool-result → text in order', () => {
    const raw = lines(
      { type: 'user', message: { role: 'user', content: 'find imports' } },
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'plan: rg for "import"' },
            {
              type: 'tool_use',
              id: 'tu_1',
              name: 'Bash',
              input: { command: 'rg -l "import"' },
            },
          ],
        },
      },
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'tu_1', content: 'src/a.ts\nsrc/b.ts' },
          ],
        },
      },
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Found 2 files.' }],
        },
      },
    );
    const o = extractClaudeOutline({
      raw,
      sourceSessionId: 'src-2',
      cwd: '/Users/jun/foo',
    });
    expect(o.steps.map((s) => s.kind)).toEqual([
      'user-instruction',
      'thinking',
      'tool-call',
      'tool-result',
      'assistant-text',
    ]);
    const toolCall = o.steps.find((s) => s.kind === 'tool-call')!;
    expect(toolCall.toolName).toBe('Bash');
    expect(toolCall.excerpt).toContain('"command":"rg -l \\"import\\""');
  });

  it('treats a user message containing only tool_result blocks as tool-result, not a new user instruction', () => {
    const raw = lines(
      { type: 'user', message: { role: 'user', content: 'pwd' } },
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'tu_1', name: 'Bash', input: { command: 'pwd' } }],
        },
      },
      {
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: '/Users/jun' }],
        },
      },
    );
    const o = extractClaudeOutline({
      raw,
      sourceSessionId: 's',
      cwd: '/Users/jun',
    });
    const userInstructions = o.steps.filter((s) => s.kind === 'user-instruction');
    expect(userInstructions).toHaveLength(1);
    expect(userInstructions[0]!.excerpt).toBe('pwd');
    expect(o.steps.filter((s) => s.kind === 'tool-result')).toHaveLength(1);
  });

  it('drops sidechain (sub-agent) entries', () => {
    const raw = lines(
      { type: 'user', message: { role: 'user', content: 'plan it' } },
      {
        type: 'assistant',
        isSidechain: true,
        message: { role: 'assistant', content: [{ type: 'text', text: 'sub-agent noise' }] },
      },
      {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'main reply' }] },
      },
    );
    const o = extractClaudeOutline({ raw, sourceSessionId: 's', cwd: '/' });
    const texts = o.steps.filter((s) => s.kind === 'assistant-text');
    expect(texts).toHaveLength(1);
    expect(texts[0]!.excerpt).toBe('main reply');
  });

  it('truncates excerpt past MAX_EXCERPT_CHARS with a sentinel', () => {
    const long = 'x'.repeat(2000);
    const raw = lines({
      type: 'user',
      message: { role: 'user', content: long },
    });
    const o = extractClaudeOutline({ raw, sourceSessionId: 's', cwd: '/' });
    expect(o.steps[0]!.excerpt.length).toBeLessThan(2000);
    expect(o.steps[0]!.excerpt).toMatch(/…\(\+\d+ more\)$/);
  });

  it('skips malformed JSON lines without throwing', () => {
    const raw = `not json\n${JSON.stringify({
      type: 'user',
      message: { role: 'user', content: 'ok' },
    })}\n{broken\n`;
    const o = extractClaudeOutline({ raw, sourceSessionId: 's', cwd: '/' });
    expect(o.steps).toHaveLength(1);
    expect(o.steps[0]!.kind).toBe('user-instruction');
  });

  it('assigns turnIndex per user→assistant cycle and blockIndex per turn', () => {
    const raw = lines(
      { type: 'user', message: { role: 'user', content: 'a' } },
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 't1' },
            { type: 'text', text: 'r1' },
          ],
        },
      },
      { type: 'user', message: { role: 'user', content: 'b' } },
      {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'r2' }] },
      },
    );
    const o = extractClaudeOutline({ raw, sourceSessionId: 's', cwd: '/' });
    const turns = o.steps.map((s) => s.turnIndex);
    expect(turns).toEqual([0, 0, 0, 1, 1]);
    // Each assistant block gets its own blockIndex within the turn.
    const turn0 = o.steps.filter((s) => s.turnIndex === 0);
    expect(turn0.map((s) => s.blockIndex)).toEqual([0, 1, 2]);
  });
});

// `groupIntoSegments` is now agent-agnostic and tested in
// `outline/grouping.test.ts`. Claude-specific outline tests stay
// here.
