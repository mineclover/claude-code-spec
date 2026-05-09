/**
 * cli-runner agent registry — pairs each agent's summarize runner
 * with its annotator-primitive factory.
 *
 * Mirrors the shape of `@context-action/session-core`'s server-side
 * agent registry. Keeping the cli-runner layer's table separate
 * from the session-core layer's table lets each evolve at its own
 * cadence:
 *
 *   - session-core agents: reader + outline extractor (pure data)
 *   - cli-runner agents:   summarize runner + annotator primitive
 *                          (live CLI interaction, fork mechanics)
 *
 * Public consumers go through `getRunner(id)` and
 * `makeAnnotatorPrimitive({toolId, ...})`. Both delegate here. Adding
 * an agent is a single edit to `RUNNER_AGENTS` once the per-agent
 * runner / primitive types exist.
 */

import type { AgentId } from '@context-action/session-core/agents';
import { claudeRunner } from './claude/runner';
import { codexRunner } from './codex/runner';
import { geminiRunner } from './gemini/runner';
import { ClaudePrimitive } from './claude/annotator';
import { CodexPrimitive } from './codex/annotator';
import type { AnnotatorPrimitive } from './types';
import type { CliRunner } from '../types';

/**
 * Creates a per-batch annotator primitive for one source session.
 * Returns `null` when this agent doesn't support cache-preserving
 * fork annotation — gemini falls into that bucket because its
 * prompt-serialize approach loses prefix bytes by construction.
 *
 * The annotator outer loop in `annotateRunner.ts` handles `null`
 * by surfacing a "not viable" error, so the consumer doesn't have
 * to special-case gemini at the call site.
 */
export interface AnnotatorFactory {
  create(opts: { sourceSessionId: string; cwd: string }): AnnotatorPrimitive | null;
}

export interface RunnerAgentDefinition {
  id: AgentId;
  /** Branch & Summarize runner — produces a `SummaryResult`. */
  summarizeRunner: CliRunner;
  /** Annotator primitive factory. `null` when annotation isn't viable. */
  annotator: AnnotatorFactory;
}

const claudeRunnerAgent: RunnerAgentDefinition = {
  id: 'claude',
  summarizeRunner: claudeRunner,
  annotator: {
    create: ({ sourceSessionId, cwd }) =>
      new ClaudePrimitive(sourceSessionId, cwd),
  },
};

const codexRunnerAgent: RunnerAgentDefinition = {
  id: 'codex',
  summarizeRunner: codexRunner,
  annotator: {
    create: ({ sourceSessionId, cwd }) =>
      new CodexPrimitive(sourceSessionId, cwd),
  },
};

const geminiRunnerAgent: RunnerAgentDefinition = {
  id: 'gemini',
  summarizeRunner: geminiRunner,
  annotator: {
    // Explicit null — calling code surfaces this as a "gemini fork
    // loses prefix" error rather than silently misbehaving.
    create: () => null,
  },
};

export const RUNNER_AGENTS: Readonly<Record<AgentId, RunnerAgentDefinition>> = {
  claude: claudeRunnerAgent,
  codex: codexRunnerAgent,
  gemini: geminiRunnerAgent,
} as const;

export function getRunnerAgent(id: AgentId): RunnerAgentDefinition {
  return RUNNER_AGENTS[id];
}

/**
 * Resolve a `getRunner`-style summarize runner for an agent. Wraps
 * the registry lookup so consumers don't have to know the registry
 * shape. Returns null when the runner doesn't exist (currently
 * never — every agent has a summarize runner — but kept signature-
 * compatible with the legacy `getRunner` for downstream callers).
 */
export function getSummarizeRunner(id: AgentId): CliRunner | null {
  return RUNNER_AGENTS[id]?.summarizeRunner ?? null;
}

/**
 * Construct an annotator primitive for one source session. Throws a
 * descriptive error when the agent doesn't support cache-preserving
 * fork annotation (gemini's prompt-serialize loses prefix bytes).
 */
export function makeAnnotatorPrimitive(opts: {
  toolId: AgentId;
  sourceSessionId: string;
  cwd: string;
}): AnnotatorPrimitive {
  const agent = getRunnerAgent(opts.toolId);
  const instance = agent.annotator.create({
    sourceSessionId: opts.sourceSessionId,
    cwd: opts.cwd,
  });
  if (!instance) {
    throw new Error(
      `Annotator not viable for ${opts.toolId}: no cache-preserving fork mechanism (gemini's prompt-serialize loses prefix bytes by construction)`,
    );
  }
  return instance;
}
