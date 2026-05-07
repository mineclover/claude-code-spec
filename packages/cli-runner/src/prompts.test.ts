/**
 * Pin the prompt template's contract so changes are visible in PR diffs.
 *
 * The CLI's "no MCP / no tools / first response is JSON" guarantee comes
 * partly from CLI flags and partly from this prompt — the model needs to
 * be told explicitly. Regressing the language clauses or operator
 * override layout would silently break ko output or runtime constraints.
 */

import { describe, expect, it } from 'vitest';
import { buildSummarizePrompt, SUMMARIZE_PROMPT_TEMPLATE } from './prompts';

describe('SUMMARIZE_PROMPT_TEMPLATE', () => {
  it('bans tool / mcp / shell calls in the model response', () => {
    expect(SUMMARIZE_PROMPT_TEMPLATE).toMatch(/Do not call any tool/);
    expect(SUMMARIZE_PROMPT_TEMPLATE).toMatch(/Do not invoke MCP servers/);
    expect(SUMMARIZE_PROMPT_TEMPLATE).toMatch(/Do not run shell commands/);
  });

  it('describes the SummaryModelOutput JSON envelope', () => {
    for (const key of [
      'oneLiner',
      'narrative',
      'keyDecisions',
      'references',
      'openItems',
      'nextActions',
    ]) {
      expect(SUMMARIZE_PROMPT_TEMPLATE).toContain(key);
    }
  });

  it('demands a single JSON object as the only response', () => {
    expect(SUMMARIZE_PROMPT_TEMPLATE).toMatch(/single JSON object/);
  });
});

describe('buildSummarizePrompt', () => {
  it('defaults to English when language is omitted', () => {
    const out = buildSummarizePrompt();
    expect(out).toContain('Language:');
    expect(out).toMatch(/in English/);
    expect(out).not.toMatch(/한국어/);
  });

  it('switches the language clause to Korean', () => {
    const out = buildSummarizePrompt({ language: 'ko' });
    expect(out).toContain('한국어');
    // The JSON-key/enum exception is important: keys stay in English.
    expect(out).toContain('JSON 키');
  });

  it('appends the operator override AFTER the canonical template + language clause', () => {
    const out = buildSummarizePrompt({
      language: 'en',
      operatorOverride: 'focus on the auth flow',
    });
    const langIdx = out.indexOf('Language:');
    const overrideIdx = out.indexOf('focus on the auth flow');
    expect(langIdx).toBeGreaterThan(0);
    expect(overrideIdx).toBeGreaterThan(langIdx);
    expect(out).toContain('Additional operator note');
  });

  it('ignores empty / whitespace-only overrides', () => {
    expect(buildSummarizePrompt({ operatorOverride: '   ' })).not.toContain(
      'Additional operator note',
    );
    expect(buildSummarizePrompt({ operatorOverride: '' })).not.toContain(
      'Additional operator note',
    );
  });

  it('keeps the canonical template prefix intact regardless of options', () => {
    const en = buildSummarizePrompt({ language: 'en' });
    const ko = buildSummarizePrompt({ language: 'ko' });
    expect(en.startsWith(SUMMARIZE_PROMPT_TEMPLATE)).toBe(true);
    expect(ko.startsWith(SUMMARIZE_PROMPT_TEMPLATE)).toBe(true);
  });
});
