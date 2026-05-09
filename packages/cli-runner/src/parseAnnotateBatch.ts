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
import { extractJsonBlock } from './jsonBlockExtractor';
import { ModelOutputParseError } from './types';

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
