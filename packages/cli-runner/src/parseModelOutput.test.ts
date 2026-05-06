/**
 * Unit tests for the model-output parser.
 *
 * The CLI emits the model's final assistant message as the `result` field
 * of the terminal stream-json `result` event. Models in the wild deviate
 * from "JSON only" in three predictable ways:
 *   1. They wrap output in a fenced ```json block
 *   2. They prepend a courtesy sentence
 *   3. They get the schema slightly wrong
 *
 * These tests pin the parser's tolerance + strictness on each.
 */

import { describe, expect, it } from 'vitest';
import { parseModelOutput } from './parseModelOutput';
import { ModelOutputParseError } from './types';

const VALID = {
  oneLiner: 'Refactored the auth flow.',
  narrative: 'Replaced the password hash with bcrypt and tightened CSRF.',
  keyDecisions: [],
  references: [],
  openItems: [],
  nextActions: [],
};

describe('parseModelOutput', () => {
  it('accepts a bare JSON object', () => {
    const out = parseModelOutput(JSON.stringify(VALID));
    expect(out.oneLiner).toBe(VALID.oneLiner);
    expect(out.narrative).toBe(VALID.narrative);
    expect(out.keyDecisions).toEqual([]);
  });

  it('accepts a fenced ```json block', () => {
    const fenced = `\`\`\`json\n${JSON.stringify(VALID, null, 2)}\n\`\`\``;
    const out = parseModelOutput(fenced);
    expect(out.oneLiner).toBe(VALID.oneLiner);
  });

  it('accepts JSON wrapped in courtesy prose', () => {
    const wrapped = `Sure, here's the summary:\n\n${JSON.stringify(VALID)}\n\nLet me know if you need anything else.`;
    const out = parseModelOutput(wrapped);
    expect(out.oneLiner).toBe(VALID.oneLiner);
  });

  it('fills missing array sections with empty defaults', () => {
    const partial = {
      oneLiner: 'x',
      narrative: 'y',
      // keyDecisions / references / openItems / nextActions omitted
    };
    const out = parseModelOutput(JSON.stringify(partial));
    expect(out.keyDecisions).toEqual([]);
    expect(out.references).toEqual([]);
    expect(out.openItems).toEqual([]);
    expect(out.nextActions).toEqual([]);
  });

  it('extracts the first balanced object even when followed by trailing text', () => {
    const trailing = `${JSON.stringify(VALID)} this is junk after the json`;
    const out = parseModelOutput(trailing);
    expect(out.oneLiner).toBe(VALID.oneLiner);
  });

  it('handles braces inside string values without misclosing the object', () => {
    const tricky = {
      ...VALID,
      narrative: 'use the {x} placeholder, like { count: 3 }',
    };
    const out = parseModelOutput(JSON.stringify(tricky));
    expect(out.narrative).toBe(tricky.narrative);
  });

  it('throws ModelOutputParseError when no JSON object is present', () => {
    expect(() => parseModelOutput('hello, no json here')).toThrowError(
      ModelOutputParseError,
    );
  });

  it('throws ModelOutputParseError on malformed JSON', () => {
    const broken = '{ "oneLiner": "x", "narrative": "y", '; // truncated
    try {
      parseModelOutput(broken);
      throw new Error('expected ModelOutputParseError');
    } catch (err) {
      expect(err).toBeInstanceOf(ModelOutputParseError);
      const e = err as ModelOutputParseError;
      // The raw text is preserved on the error so the GUI can show what
      // the model actually said.
      expect(e.rawOutput).toContain('oneLiner');
    }
  });

  it('throws ModelOutputParseError on schema mismatch (missing required fields)', () => {
    const bad = JSON.stringify({ oneLiner: 'x' /* narrative missing */ });
    try {
      parseModelOutput(bad);
      throw new Error('expected ModelOutputParseError');
    } catch (err) {
      expect(err).toBeInstanceOf(ModelOutputParseError);
      const e = err as ModelOutputParseError;
      expect(e.message).toMatch(/Schema validation failed/);
    }
  });

  it('rejects when keyDecisions has the wrong shape', () => {
    const bad = JSON.stringify({
      ...VALID,
      keyDecisions: [{ rationale: 'no title field' }],
    });
    expect(() => parseModelOutput(bad)).toThrowError(ModelOutputParseError);
  });
});
