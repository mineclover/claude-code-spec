/**
 * Sub-path entry for the session-outline domain.
 *
 * Exports both the types (browser-safe — useable from the renderer
 * to display an outline) and the Claude extractor (server-only — uses
 * pure string parsing, no node:fs, but it's still grouped here as
 * "outline" machinery rather than spread across the main barrel).
 */

export type {
  AnnotationFork,
  SessionOutline,
  SessionOutlineAnnotation,
  SessionSegment,
  SessionStep,
  SessionStepKind,
} from './outline/types';
export { MAX_EXCERPT_CHARS } from './outline/types';
export { groupIntoSegments } from './outline/grouping';
export { extractClaudeOutline } from './agents/claude/outline';
export { extractCodexOutline } from './agents/codex/outline';
export { extractGeminiOutline } from './agents/gemini/outline';
export {
  AnnotateBatchSchema,
  ANNOTATE_PROMPT_HEADER,
  buildAnnotatePrompt,
} from './outline/annotate-schema';
export type {
  AnnotateBatchOutput,
  BuildAnnotatePromptOptions,
} from './outline/annotate-schema';
