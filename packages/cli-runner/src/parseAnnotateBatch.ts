/**
 * Parser for the annotator's batch-tagging response.
 *
 * Mirrors `parseModelOutput.ts` but targets `AnnotateBatchSchema`. We
 * keep the two parsers separate because the annotator may run dozens
 * of times per session — wrapping every response with the larger
 * `SummaryModelOutputSchema` would force the model to emit fields it
 * doesn't need, and we'd reject perfectly-valid annotation batches.
 */

import {
  AnnotateBatchSchema,
  type AnnotateBatchOutput,
} from '@context-action/session-core/outline';
import { ModelOutputParseError } from './types';

/**
 * Find the first balanced JSON object in `raw`. Identical strategy to
 * `parseModelOutput.extractJsonBlock` — duplicated rather than shared
 * to keep parseModelOutput's blast radius small while we iterate on
 * the annotator's prompt.
 */
function extractJsonBlock(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? raw;

  const start = candidate.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}

export function parseAnnotateBatch(raw: string): AnnotateBatchOutput {
  const block = extractJsonBlock(raw);
  if (!block) {
    throw new ModelOutputParseError(
      'No JSON object found in annotator output',
      raw,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(block);
  } catch (err) {
    throw new ModelOutputParseError(
      `Failed to parse annotator JSON: ${err instanceof Error ? err.message : String(err)}`,
      raw,
    );
  }
  const result = AnnotateBatchSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    throw new ModelOutputParseError(
      `Annotator schema validation failed: ${issues}`,
      raw,
    );
  }
  return result.data;
}
