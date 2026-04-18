import { describe, expect, it } from 'vitest';
import { extractCwd, extractModel, extractToolDelta } from './events';

describe('extractToolDelta', () => {
  it('returns the delta for a deferred_tools_delta attachment', () => {
    expect(
      extractToolDelta({
        type: 'attachment',
        attachment: {
          type: 'deferred_tools_delta',
          addedNames: ['Read', 'Edit'],
          removedNames: ['Ls'],
        },
      }),
    ).toEqual({ added: ['Read', 'Edit'], removed: ['Ls'] });
  });

  it('filters non-string entries out of added/removed lists', () => {
    expect(
      extractToolDelta({
        type: 'attachment',
        attachment: {
          type: 'deferred_tools_delta',
          addedNames: ['Read', 42, null],
          removedNames: [{}],
        },
      }),
    ).toEqual({ added: ['Read'], removed: [] });
  });

  it('returns null for non-delta attachments', () => {
    expect(
      extractToolDelta({
        type: 'attachment',
        attachment: { type: 'hook_success' },
      }),
    ).toBeNull();
  });

  it('returns null when both added and removed are empty', () => {
    expect(
      extractToolDelta({
        type: 'attachment',
        attachment: { type: 'deferred_tools_delta', addedNames: [], removedNames: [] },
      }),
    ).toBeNull();
  });

  it('returns null for events without an attachment', () => {
    expect(extractToolDelta({ type: 'user' })).toBeNull();
  });
});

describe('extractModel', () => {
  it('returns the model for an assistant event', () => {
    expect(
      extractModel({
        type: 'assistant',
        message: { model: 'claude-opus-4-7' },
      }),
    ).toBe('claude-opus-4-7');
  });

  it('returns null for non-assistant events', () => {
    expect(extractModel({ type: 'user', message: { model: 'x' } })).toBeNull();
  });

  it('returns null when message is missing or malformed', () => {
    expect(extractModel({ type: 'assistant' })).toBeNull();
    expect(extractModel({ type: 'assistant', message: null })).toBeNull();
    expect(extractModel({ type: 'assistant', message: { model: 42 } })).toBeNull();
  });
});

describe('extractCwd', () => {
  it('returns the cwd when present and non-empty', () => {
    expect(extractCwd({ cwd: '/a/b', type: 'user' })).toBe('/a/b');
  });

  it('returns null for empty/whitespace strings', () => {
    expect(extractCwd({ cwd: '' })).toBeNull();
    expect(extractCwd({ cwd: '   ' })).toBeNull();
  });

  it('returns null when cwd is absent or non-string', () => {
    expect(extractCwd({})).toBeNull();
    expect(extractCwd({ cwd: 42 })).toBeNull();
  });
});
