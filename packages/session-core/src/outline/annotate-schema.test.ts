/**
 * Tests for the annotator prompt builder. The prompt is the only thing
 * standing between the operator's intent and the model's JSON output,
 * so its shape is contractual — pin the structure with explicit
 * assertions instead of relying on a snapshot file.
 */

import { describe, expect, it } from 'vitest';
import { AnnotateBatchSchema, buildAnnotatePrompt } from './annotate-schema';

describe('buildAnnotatePrompt', () => {
  const sampleBatch = [
    {
      index: 3,
      kind: 'tool-call',
      toolName: 'Bash',
      excerpt: '{"command":"rg -l \\"import\\""}',
    },
    {
      index: 4,
      kind: 'tool-result',
      toolName: 'Bash',
      excerpt: 'src/a.ts\nsrc/b.ts',
    },
    {
      index: 5,
      kind: 'assistant-text',
      excerpt: 'Found 2 files.',
    },
  ];

  it('lists every step index in the closing reminder', () => {
    const out = buildAnnotatePrompt({ batch: sampleBatch });
    expect(out).toContain('"3"');
    expect(out).toContain('"4"');
    expect(out).toContain('"5"');
    expect(out).toMatch(/Return descriptions for exactly these keys/);
  });

  it('includes the kind tag and tool name in each step header', () => {
    const out = buildAnnotatePrompt({ batch: sampleBatch });
    expect(out).toContain('#3 [tool-call:Bash]');
    expect(out).toContain('#4 [tool-result:Bash]');
    expect(out).toContain('#5 [assistant-text]');
  });

  it('omits the tool suffix when toolName is undefined', () => {
    const out = buildAnnotatePrompt({
      batch: [{ index: 0, kind: 'thinking', excerpt: 'plan' }],
    });
    expect(out).toContain('#0 [thinking]');
    expect(out).not.toContain('#0 [thinking:');
  });

  it('forbids tool / MCP / shell calls explicitly', () => {
    const out = buildAnnotatePrompt({ batch: sampleBatch });
    expect(out).toMatch(/Do not call any tool/);
    expect(out).toMatch(/MCP server/);
    expect(out).toMatch(/shell command/);
  });

  it('switches the language clause for ko', () => {
    const en = buildAnnotatePrompt({ batch: sampleBatch, language: 'en' });
    const ko = buildAnnotatePrompt({ batch: sampleBatch, language: 'ko' });
    expect(en).toContain('English');
    expect(ko).toContain('한국어');
  });

  it('renders an ALREADY_TAGGED block when prior descriptions exist', () => {
    const out = buildAnnotatePrompt({
      batch: sampleBatch,
      alreadyDescribed: [
        { index: 1, description: 'system init' },
        { index: 2, description: 'received user query' },
      ],
    });
    expect(out).toContain('ALREADY_TAGGED');
    expect(out).toContain('#1: system init');
    expect(out).toContain('#2: received user query');
  });

  it('omits ALREADY_TAGGED when no prior descriptions', () => {
    const out = buildAnnotatePrompt({ batch: sampleBatch });
    expect(out).not.toContain('ALREADY_TAGGED');
  });

  it('indents multi-line excerpts so the prompt stays scannable', () => {
    const out = buildAnnotatePrompt({
      batch: [
        {
          index: 0,
          kind: 'tool-result',
          excerpt: 'line one\nline two\nline three',
        },
      ],
    });
    // Each excerpt line should be indented by exactly four spaces.
    expect(out).toMatch(/    line one\n    line two\n    line three/);
  });
});

describe('AnnotateBatchSchema', () => {
  it('accepts a typical descriptions map', () => {
    const r = AnnotateBatchSchema.safeParse({
      descriptions: { '0': 'a', '5': 'b' },
    });
    expect(r.success).toBe(true);
  });

  it('rejects when descriptions is missing', () => {
    const r = AnnotateBatchSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it('rejects when a description value is not a string', () => {
    const r = AnnotateBatchSchema.safeParse({
      descriptions: { '0': 123 },
    });
    expect(r.success).toBe(false);
  });

  it('accepts an empty descriptions map', () => {
    const r = AnnotateBatchSchema.safeParse({ descriptions: {} });
    expect(r.success).toBe(true);
  });
});
