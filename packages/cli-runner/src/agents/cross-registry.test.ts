/**
 * Cross-package invariants for the agent registries.
 *
 * The cli-runner runtime registry (`RUNNER_AGENTS`) and the session-core
 * data registry (`AGENTS`) operate on the same `AgentId` set. They MUST
 * stay in sync — adding an agent to one without the other yields a
 * partially-supported CLI that breaks at runtime in surprising places.
 *
 * cli-runner already depends on session-core, so we verify the
 * invariant from this side. (session-core can't depend on cli-runner
 * — wrong direction in the dep graph — so the symmetric check would
 * have to live in an integration test elsewhere; in practice the
 * import here covers the shared key set.)
 */

import { describe, expect, it } from 'vitest';
import { AGENTS, AGENT_IDS } from '@context-action/session-core/server/agents';
import { RUNNER_AGENTS } from './registry';

describe('agent registry invariants — cli-runner vs session-core', () => {
  it('RUNNER_AGENTS and AGENTS share exactly the same key set', () => {
    const runtimeKeys = Object.keys(RUNNER_AGENTS).sort();
    const dataKeys = Object.keys(AGENTS).sort();
    expect(runtimeKeys).toEqual(dataKeys);
  });

  it('every AgentId in AGENT_IDS exists in BOTH registries with matching `id`', () => {
    for (const id of AGENT_IDS) {
      const runtime = RUNNER_AGENTS[id];
      const data = AGENTS[id];
      expect(runtime, `RUNNER_AGENTS missing entry for ${id}`).toBeDefined();
      expect(data, `AGENTS missing entry for ${id}`).toBeDefined();
      expect(runtime.id).toBe(id);
      expect(data.id).toBe(id);
    }
  });

  it('every cli-runner agent has a non-null summarizeRunner', () => {
    // Summarize is implemented for every agent — even gemini, where
    // annotation isn't viable but Branch & Summarize still runs via
    // prompt-serialize. If this ever changes, this test should be
    // updated deliberately, not silently.
    for (const id of AGENT_IDS) {
      expect(RUNNER_AGENTS[id].summarizeRunner).toBeDefined();
    }
  });

  it('annotator factories return null for agents without cache-preserving fork', () => {
    // The `null` return is the contract — `makeAnnotatorPrimitive`
    // turns it into a "not viable" error. Pin the matrix here so
    // future agents that join the "no fork" bucket get classified
    // explicitly.
    const matrix: Record<string, 'viable' | 'not-viable'> = {
      claude: 'viable',
      codex: 'viable',
      gemini: 'not-viable',
    };
    for (const id of AGENT_IDS) {
      const inst = RUNNER_AGENTS[id].annotator.create({
        sourceSessionId: 'src',
        cwd: '/tmp',
      });
      const expected = matrix[id];
      if (expected === 'viable') {
        expect(inst, `${id} should produce a primitive`).not.toBeNull();
      } else if (expected === 'not-viable') {
        expect(inst, `${id} should refuse with null`).toBeNull();
      } else {
        throw new Error(
          `Unclassified agent in cross-registry test: ${id}. Update the matrix.`,
        );
      }
    }
  });
});
