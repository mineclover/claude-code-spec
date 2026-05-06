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
import { ModelOutputParseError } from './types';

/**
 * Strip surrounding fences and extract the first balanced JSON object. We
 * intentionally don't use `JSON.parse` on the raw text — models often emit
 * extra prose around the JSON, and a top-level parse would fail.
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
