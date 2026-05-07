/**
 * Pin the host-side Zod validation that gates everything coming back
 * from the model. The parser in cli-runner relies on this schema being
 * strict in the right places (required fields) and tolerant in the
 * right places (optional metadata, default-empty arrays).
 */

import { describe, expect, it } from 'vitest';
import {
  SummaryCacheInvariantsSchema,
  SummaryModelOutputSchema,
  SummaryResultSchema,
} from './schema';

describe('SummaryModelOutputSchema', () => {
  it('accepts a minimal payload with only the required fields', () => {
    const result = SummaryModelOutputSchema.safeParse({
      oneLiner: 'x',
      narrative: 'y',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // Default-empty arrays so the renderer never has to null-check.
      expect(result.data.keyDecisions).toEqual([]);
      expect(result.data.references).toEqual([]);
      expect(result.data.openItems).toEqual([]);
      expect(result.data.nextActions).toEqual([]);
    }
  });

  it('rejects missing oneLiner', () => {
    const result = SummaryModelOutputSchema.safeParse({ narrative: 'y' });
    expect(result.success).toBe(false);
  });

  it('rejects missing narrative', () => {
    const result = SummaryModelOutputSchema.safeParse({ oneLiner: 'x' });
    expect(result.success).toBe(false);
  });

  it('validates decision status enum', () => {
    const ok = SummaryModelOutputSchema.safeParse({
      oneLiner: 'x',
      narrative: 'y',
      keyDecisions: [{ title: 't', status: 'adopted' }],
    });
    expect(ok.success).toBe(true);
    const bad = SummaryModelOutputSchema.safeParse({
      oneLiner: 'x',
      narrative: 'y',
      keyDecisions: [{ title: 't', status: 'maybe' }],
    });
    expect(bad.success).toBe(false);
  });

  it('validates reference kind enum', () => {
    const ok = SummaryModelOutputSchema.safeParse({
      oneLiner: 'x',
      narrative: 'y',
      references: [{ target: 'src/foo.ts', kind: 'code' }],
    });
    expect(ok.success).toBe(true);
    const bad = SummaryModelOutputSchema.safeParse({
      oneLiner: 'x',
      narrative: 'y',
      references: [{ target: 'src/foo.ts', kind: 'unknown-kind' }],
    });
    expect(bad.success).toBe(false);
  });

  it('rejects keyDecisions item missing required title', () => {
    const result = SummaryModelOutputSchema.safeParse({
      oneLiner: 'x',
      narrative: 'y',
      keyDecisions: [{ rationale: 'why' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts an empty optional sources array', () => {
    const result = SummaryModelOutputSchema.safeParse({
      oneLiner: 'x',
      narrative: 'y',
      sources: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects sources items that aren\'t strings', () => {
    const result = SummaryModelOutputSchema.safeParse({
      oneLiner: 'x',
      narrative: 'y',
      sources: [123],
    });
    expect(result.success).toBe(false);
  });
});

describe('SummaryCacheInvariantsSchema', () => {
  it('requires every numeric field', () => {
    const required = {
      forkSessionId: 'fork',
      sourceSessionId: 'src',
      inputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      prefixPreservedRatio: 0,
    };
    expect(SummaryCacheInvariantsSchema.safeParse(required).success).toBe(true);
    for (const k of Object.keys(required) as Array<keyof typeof required>) {
      const partial = { ...required };
      delete (partial as Record<string, unknown>)[k];
      expect(
        SummaryCacheInvariantsSchema.safeParse(partial).success,
        `missing ${k} should fail`,
      ).toBe(false);
    }
  });

  it('accepts optional durationMs / costUsd', () => {
    const result = SummaryCacheInvariantsSchema.safeParse({
      forkSessionId: 'fork',
      sourceSessionId: 'src',
      inputTokens: 1,
      cacheReadTokens: 2,
      cacheCreationTokens: 3,
      prefixPreservedRatio: 0.5,
      durationMs: 1234,
      costUsd: 0.01,
    });
    expect(result.success).toBe(true);
  });
});

describe('SummaryResultSchema', () => {
  it('requires generatedAt and accepts the full nested invariants block', () => {
    const ok = SummaryResultSchema.safeParse({
      oneLiner: 'x',
      narrative: 'y',
      keyDecisions: [],
      references: [],
      openItems: [],
      nextActions: [],
      generatedAt: '2026-05-08T00:00:00.000Z',
      cacheInvariants: {
        forkSessionId: 'fork',
        sourceSessionId: 'src',
        inputTokens: 1,
        cacheReadTokens: 2,
        cacheCreationTokens: 3,
        prefixPreservedRatio: 0.4,
      },
    });
    expect(ok.success).toBe(true);
  });

  it('still validates without cacheInvariants (mock adapter case)', () => {
    const ok = SummaryResultSchema.safeParse({
      oneLiner: 'x',
      narrative: 'y',
      keyDecisions: [],
      references: [],
      openItems: [],
      nextActions: [],
      generatedAt: '2026-05-08T00:00:00.000Z',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects when generatedAt is missing', () => {
    const bad = SummaryResultSchema.safeParse({
      oneLiner: 'x',
      narrative: 'y',
    });
    expect(bad.success).toBe(false);
  });
});
