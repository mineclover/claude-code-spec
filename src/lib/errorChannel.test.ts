import { describe, expect, it } from 'vitest';
import { formatError } from './errorChannel';

describe('formatError', () => {
  it('extracts message and stack from Error instances', () => {
    const err = new Error('boom');
    const out = formatError(err);
    expect(out.message).toBe('boom');
    expect(out.detail).toContain('Error: boom');
  });

  it('falls back to the Error name when message is empty', () => {
    const err = new RangeError('');
    expect(formatError(err).message).toBe('RangeError');
  });

  it('treats strings as the message directly', () => {
    expect(formatError('something bad')).toEqual({ message: 'something bad' });
  });

  it('returns "Unknown error" for null and undefined', () => {
    expect(formatError(null).message).toBe('Unknown error');
    expect(formatError(undefined).message).toBe('Unknown error');
  });

  it('reads message from plain objects with a string message', () => {
    const out = formatError({ message: 'oops', code: 42 });
    expect(out.message).toBe('oops');
    expect(out.detail).toContain('"code":42');
  });

  it('falls back to JSON for objects without a usable message', () => {
    const out = formatError({ foo: 'bar' });
    expect(out.message).toBe('Unknown error');
    expect(out.detail).toContain('"foo":"bar"');
  });

  it('omits detail when JSON.stringify would throw', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const out = formatError(cyclic);
    expect(out.message).toBe('Unknown error');
    expect(out.detail).toBeUndefined();
  });
});
