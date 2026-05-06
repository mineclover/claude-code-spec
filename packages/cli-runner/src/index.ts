/**
 * @context-action/cli-runner
 *
 * Cache-preserving fork-and-summarize runners for the Claude / Codex /
 * Gemini CLIs. Each runner produces a `SummaryResult` with verified
 * cache-invariant metrics so the GUI can show the operator both the model
 * narrative and the proof that the fork shared its source's prefix.
 */

export { claudeRunner } from './claudeRunner';
export { buildSummarizePrompt, SUMMARIZE_PROMPT_TEMPLATE } from './prompts';
export { parseModelOutput } from './parseModelOutput';
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
import { claudeRunner } from './claudeRunner';

const REGISTRY: Record<ForkContext['toolId'], CliRunner | null> = {
  claude: claudeRunner,
  codex: null, // upcoming
  gemini: null, // upcoming
};

/**
 * Resolve a runner for the given CLI. Returns `null` (rather than
 * throwing) when no runner is registered, so the GUI can surface a
 * "branch unsupported for {toolId}" hint without an exception.
 */
export function getRunner(toolId: ForkContext['toolId']): CliRunner | null {
  return REGISTRY[toolId];
}
