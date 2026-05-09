/**
 * JSON-block extractor shared by every model-output parser.
 *
 * Models often emit a JSON object wrapped in courtesy prose or a fenced
 * code block (`\`\`\`json … \`\`\``). A bare `JSON.parse` on the raw
 * response would fail; instead we locate the first balanced top-level
 * `{ … }` and hand it back as a string for the caller's downstream
 * schema validation.
 *
 * The returned string is guaranteed to be a syntactically-balanced
 * object literal, but we don't validate semantics — the caller is
 * expected to run a Zod (or equivalent) check next.
 */

/**
 * Find the first balanced top-level `{ … }` object in `raw` and return
 * its substring. Strips a surrounding ```json … ``` fence if present.
 * Returns `null` when no JSON-shaped fragment is found.
 *
 * Implementation note: we walk the candidate character by character
 * tracking string-vs-code state so brace counters don't get confused
 * by braces inside string literals (e.g. `"hello { world }"`).
 */
export function extractJsonBlock(raw: string): string | null {
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
