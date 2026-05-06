/**
 * Canonical prompt templates that ask the sidecar CLI to emit a JSON object
 * matching `SummaryModelOutputSchema`.
 *
 * The contract: the model MUST output a single JSON object as its final
 * message, with no surrounding prose. We accept a plain `{ ... }` payload
 * or a fenced ```json``` block; `parseModelOutput` peels both.
 */

export const SUMMARIZE_PROMPT_TEMPLATE = `\
You are summarizing the conversation that just happened on this thread for a \
human operator who wants to decide whether to continue, branch, or hand off.

OUTPUT REQUIREMENTS — read carefully:
- Reply with a single JSON object and nothing else, in your VERY FIRST \
response. Do not call any tool. Do not search the filesystem. Do not invoke \
MCP servers. Do not run shell commands.
- Do not wrap the output in prose, markdown, or explanations. A bare JSON \
object is fine; a fenced \\\`\\\`\\\`json block is also accepted.
- Do not invent facts. If a section has nothing to put in it, return an empty \
array (e.g. \`"openItems": []\`).
- Stay grounded in this conversation; don't speculate about turns that didn't \
happen. The conversation history above this prompt is the only source of truth.
- Be concise. The whole JSON should fit comfortably under 1500 tokens; trim \
prose before omitting structure.

The JSON object must match this shape:

{
  "oneLiner": "string — a single-line headline (≤ 80 chars).",
  "narrative": "string — 2 to 3 sentences of operator-facing summary.",
  "keyDecisions": [
    {
      "title": "string — short headline of the decision",
      "rationale": "string — optional one-paragraph why",
      "status": "adopted | rejected | open  — optional"
    }
  ],
  "references": [
    {
      "target": "string — repo-relative file path or symbol name",
      "note": "string — optional, why it mattered",
      "kind": "code | config | docs | test | external — optional"
    }
  ],
  "openItems": [
    {
      "question": "string — outstanding question or unresolved branch",
      "anchor": "string — optional turn address like '#3.2'"
    }
  ],
  "nextActions": [
    {
      "prompt": "string — copy/run-ready prompt for the operator's next step",
      "label": "string — optional short button label"
    }
  ],
  "sources": ["string — optional, e.g. '#3..#7' to attribute"]
}

If the conversation has not made any concrete decision, leave keyDecisions \
empty rather than fabricating one.`;

import type { SummaryLanguage } from './types';

const LANGUAGE_CLAUSE: Record<SummaryLanguage, string> = {
  en: 'Write all human-readable strings (oneLiner, narrative, decision titles, rationale, references, open questions, action labels) in English.',
  ko: '사람이 읽는 모든 문자열(oneLiner, narrative, 의사결정 제목/근거, 참조, 미해결 질문, 액션 라벨)은 한국어로 작성하세요. JSON 키 이름과 enum 값(예: "adopted", "rejected", "open", "code", "config")은 영어 그대로 두세요.',
};

export interface BuildSummarizePromptOptions {
  /** Optional operator text appended after the canonical template. */
  operatorOverride?: string;
  /** Output language for the human-readable strings. Defaults to 'en'. */
  language?: SummaryLanguage;
}

export function buildSummarizePrompt(opts: BuildSummarizePromptOptions = {}): string {
  const lang = opts.language ?? 'en';
  const langClause = LANGUAGE_CLAUSE[lang];
  const sections = [SUMMARIZE_PROMPT_TEMPLATE];
  sections.push(`\nLanguage: ${langClause}`);
  if (opts.operatorOverride?.trim()) {
    sections.push(
      `\nAdditional operator note (treat as an extra constraint, not a replacement of the schema above):\n${opts.operatorOverride.trim()}`,
    );
  }
  return sections.join('\n');
}
