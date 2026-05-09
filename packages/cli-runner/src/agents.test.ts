/**
 * Tests for the cli-runner agent registry.
 *
 * Pins the dispatch contract: every AgentId has an entry, gemini
 * explicitly returns `null` from its annotator factory (so callers
 * can short-circuit instead of running a fork that won't preserve
 * cache prefix), and `makeAnnotatorPrimitive` translates the null
 * into a useful error rather than a NPE.
 */

import { describe, expect, it } from 'vitest';
import {
  RUNNER_AGENTS,
  getRunnerAgent,
  getSummarizeRunner,
  makeAnnotatorPrimitive,
} from './agents';
import { ClaudePrimitive, CodexPrimitive } from './annotatorPrimitive';
import { AGENT_IDS } from '@context-action/session-core/agents';

describe('cli-runner agent registry', () => {
  it('has an entry for every AgentId', () => {
    for (const id of AGENT_IDS) {
      const agent = RUNNER_AGENTS[id];
      expect(agent).toBeDefined();
      expect(agent.id).toBe(id);
      expect(agent.summarizeRunner.toolId === id || agent.summarizeRunner).toBeTruthy();
      expect(typeof agent.annotator.create).toBe('function');
    }
  });

  it('getRunnerAgent and getSummarizeRunner agree', () => {
    for (const id of AGENT_IDS) {
      const a = getRunnerAgent(id);
      const r = getSummarizeRunner(id);
      expect(r).toBe(a.summarizeRunner);
    }
  });
});

describe('makeAnnotatorPrimitive', () => {
  it('returns a ClaudePrimitive for claude', () => {
    const p = makeAnnotatorPrimitive({
      toolId: 'claude',
      sourceSessionId: 's',
      cwd: '/tmp',
    });
    expect(p).toBeInstanceOf(ClaudePrimitive);
    expect(p.toolId).toBe('claude');
  });

  it('returns a CodexPrimitive for codex', () => {
    const p = makeAnnotatorPrimitive({
      toolId: 'codex',
      sourceSessionId: 's',
      cwd: '/tmp',
    });
    expect(p).toBeInstanceOf(CodexPrimitive);
    expect(p.toolId).toBe('codex');
  });

  it('throws a descriptive error for gemini', () => {
    expect(() =>
      makeAnnotatorPrimitive({
        toolId: 'gemini',
        sourceSessionId: 's',
        cwd: '/tmp',
      }),
    ).toThrow(/not viable.*gemini.*prompt-serialize/i);
  });
});

describe('agent annotator factory contract', () => {
  it('claude.annotator.create returns a non-null primitive', () => {
    const inst = RUNNER_AGENTS.claude.annotator.create({
      sourceSessionId: 's',
      cwd: '/tmp',
    });
    expect(inst).not.toBeNull();
    expect(inst!.toolId).toBe('claude');
  });

  it('gemini.annotator.create returns null (explicit "not viable" signal)', () => {
    const inst = RUNNER_AGENTS.gemini.annotator.create({
      sourceSessionId: 's',
      cwd: '/tmp',
    });
    expect(inst).toBeNull();
  });
});
