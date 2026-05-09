/**
 * Model-output parser.
 *
 * The sidecar CLI is asked for a single JSON object matching
 * `SummaryModelOutputSchema`. Models often wrap the payload in a fenced
 * code block, prepend a courtesy sentence, or emit other small deviations.
 * This helper finds the first plausible JSON object in the text and
 * validates it against the schema, throwing `ModelOutputParseError` with
 * the raw output preserved when validation fails so callers can show it.
 */

import {
  SummaryModelOutputSchema,
  type SummaryModelOutput,
} from '@context-action/session-core/summary';
import { extractJsonBlock } from './jsonBlockExtractor';
import { ModelOutputParseError } from './types';

export function parseModelOutput(raw: string): SummaryModelOutput {
  const block = extractJsonBlock(raw);
  if (!block) {
    throw new ModelOutputParseError(
      'No JSON object found in model output',
      raw,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(block);
  } catch (err) {
    throw new ModelOutputParseError(
      `Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`,
      raw,
    );
  }

  const result = SummaryModelOutputSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    throw new ModelOutputParseError(
      `Schema validation failed: ${issues}`,
      raw,
    );
  }
  return result.data;
}
