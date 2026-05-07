/**
 * Zod schemas + prompt template for the outline annotator.
 *
 * The annotator's job is to attach a 1-line description tag to each
 * step in a SessionOutline. The model sees a batch of steps + their
 * excerpts and is asked to return a `{ descriptions: { '<index>':
 * '<tag>' } }` object. Iteration accumulates descriptions across
 * multiple cache-preserving forks, so each individual prompt stays
 * small and predictable.
 */

import { z } from 'zod';
import type { SummaryLanguage } from '../summary/types';

export const AnnotateBatchSchema = z.object({
  descriptions: z.record(z.string(), z.string()),
});

export type AnnotateBatchOutput = z.infer<typeof AnnotateBatchSchema>;

export const ANNOTATE_PROMPT_HEADER = `\
You are tagging a recorded session. For each numbered step listed below, \
return a SINGLE one-line description in the requested language that captures \
what happened in that step (max 12 words; no trailing period).

OUTPUT REQUIREMENTS — read carefully:
- Reply with a single JSON object and NOTHING else, in your VERY FIRST \
response. Do not call any tool, MCP server, or shell command. Do not search \
the filesystem. The transcript already loaded into this thread is the only \
source of truth.
- Do not wrap the output in prose, markdown, or explanations. A bare JSON \
object is fine; a fenced \\\`\\\`\\\`json block is also accepted.
- The JSON object MUST match exactly:
    { "descriptions": { "<stepIndex>": "<one-line description>", ... } }
  where every <stepIndex> is one of the integers listed in "STEPS_TO_TAG".
- Do not invent steps. Do not reuse a description verbatim across steps.
- Be concrete: name the file, command, error, or decision when one is \
present in the excerpt. Avoid generic phrases like "did some work" or \
"performed an action".`;

export interface BuildAnnotatePromptOptions {
  language?: SummaryLanguage;
  /** Steps to describe in this batch — model sees their excerpts + index. */
  batch: ReadonlyArray<{
    index: number;
    kind: string;
    toolName?: string;
    excerpt: string;
  }>;
  /**
   * Steps already described in earlier batches. Provided as context
   * (not asked to re-describe) so the model can stay consistent in tone.
   * Optional — empty array is fine.
   */
  alreadyDescribed?: ReadonlyArray<{
    index: number;
    description: string;
  }>;
}

const LANGUAGE_CLAUSE: Record<SummaryLanguage, string> = {
  en: 'Write each description in English.',
  ko: '각 설명은 한국어로 작성하세요. JSON 키와 키워드는 영어 그대로 두세요.',
};

export function buildAnnotatePrompt(opts: BuildAnnotatePromptOptions): string {
  const { batch, alreadyDescribed = [], language = 'en' } = opts;
  const sections: string[] = [ANNOTATE_PROMPT_HEADER];
  sections.push(`\nLanguage: ${LANGUAGE_CLAUSE[language]}`);

  if (alreadyDescribed.length > 0) {
    const ctx = alreadyDescribed
      .map((s) => `  #${s.index}: ${s.description}`)
      .join('\n');
    sections.push(
      `\nALREADY_TAGGED (do not re-describe; provided for tone consistency):\n${ctx}`,
    );
  }

  const stepBlock = batch
    .map((s) => {
      const head = `#${s.index} [${s.kind}${s.toolName ? `:${s.toolName}` : ''}]`;
      // Indent excerpt for readability; keep it raw so the model sees
      // exactly what's in the source.
      const indent = s.excerpt
        .split('\n')
        .map((l) => `    ${l}`)
        .join('\n');
      return `${head}\n${indent}`;
    })
    .join('\n\n');
  sections.push(`\nSTEPS_TO_TAG:\n${stepBlock}`);

  const expectedKeys = batch.map((s) => `"${s.index}"`).join(', ');
  sections.push(
    `\nReturn descriptions for exactly these keys: { ${expectedKeys} }.`,
  );
  return sections.join('\n');
}
