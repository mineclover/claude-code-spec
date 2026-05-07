/**
 * Codex outline extractor tests.
 *
 * Fixtures mimic the JSONL envelope shapes Codex actually emits:
 * `session_meta`, `response_item.message{role}`, `response_item.reasoning`,
 * `response_item.function_call`, `response_item.function_call_output`,
 * and a few `event_msg` flavors. We pin behavior against these because
 * Codex's wire format isn't documented stably.
 */

import { describe, expect, it } from 'vitest';
import { extractCodexOutline } from './extract-codex';

function jsonl(...rows: object[]): string {
  return rows.map((r) => JSON.stringify(r)).join('\n');
}

describe('extractCodexOutline', () => {
  it('classifies a typical user→assistant turn', () => {
    const raw = jsonl(
      { type: 'session_meta', payload: { id: 'sess-1', cwd: '/tmp' } },
      // Pre-task developer/system messages should land as meta.
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'developer',
          content: [{ type: 'input_text', text: 'permissions' }],
        },
      },
      // task_started flips the boundary.
      { type: 'event_msg', payload: { type: 'task_started' } },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'list files' }],
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'reasoning',
          summary: [{ type: 'summary_text', text: 'plan' }],
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'exec_command',
          arguments: '{"cmd":"ls"}',
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'function_call_output',
          output: 'a.ts\nb.ts',
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Found 2 files.' }],
        },
      },
    );
    const o = extractCodexOutline({
      raw,
      sourceSessionId: 'sess-1',
      cwd: '/tmp',
    });
    expect(o.toolId).toBe('codex');
    expect(o.steps.map((s) => s.kind)).toEqual([
      'meta', // session_meta
      'meta', // pre-task developer message
      'user-instruction',
      'thinking',
      'tool-call',
      'tool-result',
      'assistant-text',
    ]);
    expect(o.steps.find((s) => s.kind === 'tool-call')!.toolName).toBe(
      'exec_command',
    );
    expect(o.steps.find((s) => s.kind === 'thinking')!.excerpt).toBe('plan');
  });

  it('treats a user message before task_started as boilerplate (meta)', () => {
    const raw = jsonl(
      { type: 'session_meta', payload: { id: 's' } },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'AGENTS.md…' }],
        },
      },
    );
    const o = extractCodexOutline({
      raw,
      sourceSessionId: 's',
      cwd: '/',
    });
    // Without task_started, the user message is boilerplate, not an
    // operator turn. So no user-instruction step exists.
    expect(o.steps.filter((s) => s.kind === 'user-instruction')).toHaveLength(
      0,
    );
    expect(o.steps.filter((s) => s.kind === 'meta').length).toBeGreaterThan(0);
  });

  it('skips event_msg events except for task_started', () => {
    const raw = jsonl(
      { type: 'event_msg', payload: { type: 'token_count' } },
      { type: 'event_msg', payload: { type: 'agent_message' } },
      { type: 'event_msg', payload: { type: 'task_started' } },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'hello' }],
        },
      },
    );
    const o = extractCodexOutline({
      raw,
      sourceSessionId: 's',
      cwd: '/',
    });
    expect(o.steps.map((s) => s.kind)).toEqual(['user-instruction']);
  });

  it('skips turn_context envelopes', () => {
    const raw = jsonl({ type: 'turn_context', payload: {} });
    const o = extractCodexOutline({ raw, sourceSessionId: 's', cwd: '/' });
    expect(o.steps).toEqual([]);
  });

  it('reads multi-part assistant content as concatenated text', () => {
    const raw = jsonl(
      { type: 'event_msg', payload: { type: 'task_started' } },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'output_text', text: 'first' },
            { type: 'output_text', text: 'second' },
          ],
        },
      },
    );
    const o = extractCodexOutline({ raw, sourceSessionId: 's', cwd: '/' });
    const text = o.steps.find((s) => s.kind === 'assistant-text');
    expect(text!.excerpt).toBe('first\nsecond');
  });

  it('tolerates malformed JSON lines without throwing', () => {
    const raw = `not json\n${JSON.stringify({
      type: 'event_msg',
      payload: { type: 'task_started' },
    })}\n${JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'hi' }],
      },
    })}\n{broken`;
    const o = extractCodexOutline({ raw, sourceSessionId: 's', cwd: '/' });
    expect(o.steps.map((s) => s.kind)).toEqual(['user-instruction']);
  });

  it('captures session_meta.model when present', () => {
    const raw = jsonl({
      type: 'session_meta',
      payload: { id: 'x', model: 'gpt-5' },
    });
    const o = extractCodexOutline({ raw, sourceSessionId: 'x', cwd: '/' });
    expect(o.model).toBe('gpt-5');
  });

  it('groups segments using user-instruction boundaries', () => {
    const raw = jsonl(
      { type: 'event_msg', payload: { type: 'task_started' } },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'q1' }],
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'a1' }],
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'q2' }],
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'a2' }],
        },
      },
    );
    const o = extractCodexOutline({ raw, sourceSessionId: 's', cwd: '/' });
    // 2 user-instructions ⇒ at least 2 segments past the opener.
    const userTurns = o.steps.filter((s) => s.kind === 'user-instruction');
    expect(userTurns).toHaveLength(2);
    expect(o.segments.length).toBeGreaterThanOrEqual(3);
  });
});
