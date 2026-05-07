/**
 * Tests for the annotator's batch-output parser. We pin against the
 * exact JSON shape the prompt asks the model for, plus the realistic
 * ways models tend to wrap that JSON (fenced code, leading prose,
 * trailing commentary).
 */

import { describe, expect, it } from 'vitest';
import { parseAnnotateBatch } from './parseAnnotateBatch';
import { ModelOutputParseError } from './types';

describe('parseAnnotateBatch', () => {
  it('parses a bare JSON object', () => {
    const out = parseAnnotateBatch(
      '{"descriptions":{"3":"ran rg -l import","4":"summarized 2 files"}}',
    );
    expect(out.descriptions['3']).toBe('ran rg -l import');
    expect(out.descriptions['4']).toBe('summarized 2 files');
  });

  it('parses a fenced ```json block', () => {
    const raw = [
      'Sure, here are the descriptions:',
      '```json',
      '{"descriptions":{"7":"opened README.md"}}',
      '```',
      '',
    ].join('\n');
    const out = parseAnnotateBatch(raw);
    expect(out.descriptions['7']).toBe('opened README.md');
  });

  it('parses an unfenced object after prose', () => {
    const raw = 'Done. {"descriptions":{"0":"system init"}}';
    const out = parseAnnotateBatch(raw);
    expect(out.descriptions['0']).toBe('system init');
  });

  it('throws ModelOutputParseError when no JSON object is present', () => {
    expect(() => parseAnnotateBatch('I cannot describe these.')).toThrow(
      ModelOutputParseError,
    );
  });

  it('throws ModelOutputParseError when JSON is malformed', () => {
    expect(() =>
      parseAnnotateBatch('{"descriptions": {oops not valid}}'),
    ).toThrow(ModelOutputParseError);
  });

  it('throws when the schema does not match', () => {
    // Missing the `descriptions` key altogether.
    expect(() => parseAnnotateBatch('{"other": {"1": "x"}}')).toThrow(
      ModelOutputParseError,
    );
  });

  it('preserves the raw output on failure', () => {
    const raw = 'this is not json at all';
    try {
      parseAnnotateBatch(raw);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ModelOutputParseError);
      if (err instanceof ModelOutputParseError) {
        expect(err.rawOutput).toBe(raw);
      }
    }
  });

  it('accepts an empty descriptions object', () => {
    // The annotator treats this as "no progress this round" — the
    // outer loop then bails out. The parser itself should accept it.
    const out = parseAnnotateBatch('{"descriptions":{}}');
    expect(out.descriptions).toEqual({});
  });

  it('accepts string indexes with non-numeric content (parser is permissive)', () => {
    // The parser doesn't validate that keys are stringified ints; the
    // annotator does that downstream when merging into the outline.
    // Keep the parser permissive so we can iterate on the prompt.
    const out = parseAnnotateBatch('{"descriptions":{"foo":"bar"}}');
    expect(out.descriptions.foo).toBe('bar');
  });
});
