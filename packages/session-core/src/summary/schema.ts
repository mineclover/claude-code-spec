/**
 * Zod schema for `SummaryResult`.
 *
 * Lives next to types.ts so the host process can `safeParse` whatever JSON
 * the CLI sidecar emitted before forwarding it to the renderer. Tolerant of
 * missing optional sections — the model is expected to fill them but the
 * GUI handles empty arrays gracefully.
 */

import { z } from 'zod';

export const SummaryDecisionSchema = z.object({
  title: z.string(),
  rationale: z.string().optional(),
  status: z.enum(['adopted', 'rejected', 'open']).optional(),
});

export const SummaryReferenceSchema = z.object({
  target: z.string(),
  note: z.string().optional(),
  kind: z.enum(['code', 'config', 'docs', 'test', 'external']).optional(),
});

export const SummaryOpenItemSchema = z.object({
  question: z.string(),
  anchor: z.string().optional(),
});

export const SummaryNextActionSchema = z.object({
  prompt: z.string(),
  label: z.string().optional(),
});

export const SummaryCacheInvariantsSchema = z.object({
  forkSessionId: z.string(),
  sourceSessionId: z.string(),
  cacheReadTokens: z.number(),
  cacheCreationTokens: z.number(),
  inputTokens: z.number(),
  prefixPreservedRatio: z.number(),
  durationMs: z.number().optional(),
  costUsd: z.number().optional(),
});

/**
 * Schema for the model-emitted portion of the summary. The host fills in
 * `cacheInvariants` and `generatedAt` separately so we don't burden the
 * prompt with details only the bun process can compute.
 */
export const SummaryModelOutputSchema = z.object({
  oneLiner: z.string(),
  narrative: z.string(),
  keyDecisions: z.array(SummaryDecisionSchema).default([]),
  references: z.array(SummaryReferenceSchema).default([]),
  openItems: z.array(SummaryOpenItemSchema).default([]),
  nextActions: z.array(SummaryNextActionSchema).default([]),
  sources: z.array(z.string()).optional(),
});

export const SummaryResultSchema = SummaryModelOutputSchema.extend({
  cacheInvariants: SummaryCacheInvariantsSchema.optional(),
  generatedAt: z.string(),
});

export type SummaryModelOutput = z.infer<typeof SummaryModelOutputSchema>;
