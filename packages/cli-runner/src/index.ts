/**
 * @context-action/cli-runner
 *
 * Cache-preserving fork-and-summarize runners for the Claude / Codex /
 * Gemini CLIs. Each runner produces a `SummaryResult` with verified
 * cache-invariant metrics so the GUI can show the operator both the model
 * narrative and the proof that the fork shared its source's prefix.
 */

export { claudeRunner } from './agents/claude/runner';
export { codexRunner } from './agents/codex/runner';
export { geminiRunner } from './agents/gemini/runner';
export { buildSummarizePrompt, SUMMARIZE_PROMPT_TEMPLATE } from './prompts';
export { parseModelOutput } from './parseModelOutput';
export { parseAnnotateBatch } from './parseAnnotateBatch';
export { annotateOutline } from './annotateRunner';
export type { AnnotateOutlineOptions } from './annotateRunner';
export { ANNOTATE_BATCH_JSON_SCHEMA } from './agents/types';
export type {
  AnnotatorPrimitive,
  AnnotateBatchInput,
  AnnotateBatchResult,
} from './agents/types';
// Agent registry — single dispatch table for runner + annotator
// per agent. `getRunner` and `makeAnnotatorPrimitive` are kept as
// the canonical public API; both delegate to this registry.
export {
  RUNNER_AGENTS,
  getRunnerAgent,
  getSummarizeRunner,
  makeAnnotatorPrimitive,
} from './agents/registry';
export type {
  RunnerAgentDefinition,
  AnnotatorFactory,
} from './agents/registry';
export { CodexAppServerClient } from './agents/codex/appServer';
export type {
  CodexAppServerOptions,
  CodexThreadItem,
  CodexTokenUsage,
  RunTurnOptions,
  RunTurnResult,
} from './agents/codex/appServer';
export type {
  CliRunner,
  ForkContext,
  ForkProgress,
  ForkProgressPhase,
  RunnerCapability,
  SummaryLanguage,
} from './types';
export {
  ForkPrerequisiteError,
  ModelOutputParseError,
  RunnerUnavailableError,
} from './types';

import type { CliRunner, ForkContext } from './types';
import { getSummarizeRunner } from './agents/registry';

/**
 * Resolve a runner for the given CLI. Returns `null` (rather than
 * throwing) when no runner is registered, so the GUI can surface a
 * "branch unsupported for {toolId}" hint without an exception.
 *
 * Thin alias around the agent registry — keeps the legacy public
 * API stable while the registry holds the actual table.
 */
export function getRunner(toolId: ForkContext['toolId']): CliRunner | null {
  return getSummarizeRunner(toolId);
}
