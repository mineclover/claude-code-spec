import { describe, expect, it } from 'vitest';
import { entryDomId, formatAddress, parseAddress } from './address';

describe('parseAddress', () => {
  it('parses #N', () => {
    expect(parseAddress('#3')).toEqual({ entryIndex: 3 });
  });

  it('parses N without leading hash', () => {
    expect(parseAddress('3')).toEqual({ entryIndex: 3 });
  });

  it('parses #N.k', () => {
    expect(parseAddress('#3.2')).toEqual({ entryIndex: 3, blockIndex: 2 });
  });

  it('parses N.k without leading hash', () => {
    expect(parseAddress('3.2')).toEqual({ entryIndex: 3, blockIndex: 2 });
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseAddress('  #12.4  ')).toEqual({ entryIndex: 12, blockIndex: 4 });
  });

  it('returns null for empty string', () => {
    expect(parseAddress('')).toBeNull();
  });

  it('returns null for non-string input', () => {
    // @ts-expect-error — explicit hostile type to validate the runtime guard.
    expect(parseAddress(undefined)).toBeNull();
    // @ts-expect-error
    expect(parseAddress(null)).toBeNull();
    // @ts-expect-error
    expect(parseAddress(42)).toBeNull();
  });

  it('returns null for zero entry', () => {
    expect(parseAddress('0')).toBeNull();
    expect(parseAddress('#0')).toBeNull();
  });

  it('returns null for zero block', () => {
    expect(parseAddress('3.0')).toBeNull();
  });

  it('returns null for negative numbers', () => {
    expect(parseAddress('-3')).toBeNull();
    expect(parseAddress('3.-1')).toBeNull();
  });

  it('returns null for trailing garbage', () => {
    expect(parseAddress('3.2x')).toBeNull();
    expect(parseAddress('#3.2.1')).toBeNull();
    expect(parseAddress('abc')).toBeNull();
  });

  it('returns null for hash-only', () => {
    expect(parseAddress('#')).toBeNull();
  });
});

describe('formatAddress', () => {
  it('formats top-level entry', () => {
    expect(formatAddress(3)).toBe('#3');
  });

  it('formats entry with block', () => {
    expect(formatAddress(3, 2)).toBe('#3.2');
  });

  it('round-trips through parseAddress', () => {
    const cases = [
      { entryIndex: 1 },
      { entryIndex: 7 },
      { entryIndex: 12, blockIndex: 4 },
    ];
    for (const c of cases) {
      const out = parseAddress(formatAddress(c.entryIndex, c.blockIndex));
      expect(out).toEqual(c);
    }
  });

  it('throws for non-positive entry', () => {
    expect(() => formatAddress(0)).toThrow(RangeError);
    expect(() => formatAddress(-1)).toThrow(RangeError);
  });

  it('throws for non-positive block', () => {
    expect(() => formatAddress(3, 0)).toThrow(RangeError);
    expect(() => formatAddress(3, -1)).toThrow(RangeError);
  });
});

describe('entryDomId', () => {
  it('produces a top-level id', () => {
    expect(entryDomId(3)).toBe('session-entry-3');
  });

  it('produces a sub-block id', () => {
    expect(entryDomId(3, 2)).toBe('session-entry-3-2');
  });
});
