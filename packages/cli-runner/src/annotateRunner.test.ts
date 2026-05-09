/**
 * annotateOutline tests with an injected stub primitive.
 *
 * The cache-preserving fork mechanic is exercised by the per-CLI
 * primitive tests (claudeRunner integration would need a real CLI;
 * codexAppServer test uses the fixture). Here we focus on the outer
 * loop: batching, accumulating prior descriptions, retrying when a
 * batch fails to parse, persisting the right `annotation` metadata.
 */

import { describe, expect, it } from 'vitest';
import { annotateOutline } from './annotateRunner';
import type { AnnotatorPrimitive } from './annotatorPrimitive';
import type {
  SessionOutline,
  SessionStep,
} from '@context-action/session-core/outline';

function step(
  index: number,
  kind: SessionStep['kind'],
  excerpt = '',
): SessionStep {
  return { index, kind, turnIndex: 0, blockIndex: index, excerpt };
}

function makeOutline(steps: SessionStep[]): SessionOutline {
  return {
    toolId: 'claude',
    sourceSessionId: 'src-1',
    cwd: '/tmp/x',
    steps,
    segments: [
      { openedByStep: null, closedByStep: null, userInstructionExcerpt: '', steps },
    ],
    generatedAt: '2026-05-09T00:00:00.000Z',
  };
}

interface StubResponse {
  rawText: string;
  cacheReadTokens?: number;
  inputTokens?: number;
  forkSessionId?: string | null;
}

function stubPrimitive(responses: StubResponse[]): AnnotatorPrimitive & {
  callCount(): number;
  prompts(): string[];
} {
  let i = 0;
  const prompts: string[] = [];
  return {
    toolId: 'claude',
    async prepare() {
      /* noop */
    },
    async forkAndAnnotate(input) {
      prompts.push(input.prompt);
      const r = responses[i++];
      if (!r) {
        throw new Error(`stubPrimitive: ran out of canned responses (call ${i})`);
      }
      return {
        rawText: r.rawText,
        forkSessionId: r.forkSessionId ?? `fork-${i}`,
        cacheReadTokens: r.cacheReadTokens ?? 100,
        cacheCreationTokens: 0,
        inputTokens: r.inputTokens ?? 50,
      };
    },
    async shutdown() {
      /* noop */
    },
    callCount: () => i,
    prompts: () => prompts,
  };
}

describe('annotateOutline — outer loop', () => {
  it('fills every describable step in a single fork when the model returns all of them', async () => {
    const outline = makeOutline([
      step(0, 'meta', 'init'),
      step(1, 'user-instruction', 'list files'),
      step(2, 'thinking', 'plan'),
      step(3, 'tool-call', '{"command":"ls"}'),
      step(4, 'tool-result', 'a.ts\nb.ts'),
      step(5, 'assistant-text', 'two files'),
    ]);
    const primitive = stubPrimitive([
      {
        rawText:
          '{"descriptions":{"2":"plans the listing","3":"runs ls","4":"reports two files","5":"replies with the count"}}',
      },
    ]);
    const { outline: out, annotation } = await annotateOutline(outline, '/tmp/x', {
      primitive,
    });
    expect(primitive.callCount()).toBe(1);
    expect(annotation.remainingUntagged).toBe(0);
    expect(annotation.forks).toHaveLength(1);
    expect(out.steps.find((s) => s.index === 2)?.description).toBe(
      'plans the listing',
    );
    expect(out.steps.find((s) => s.index === 5)?.description).toBe(
      'replies with the count',
    );
    // meta and user-instruction must remain undecribed.
    expect(out.steps.find((s) => s.index === 0)?.description).toBeUndefined();
    expect(out.steps.find((s) => s.index === 1)?.description).toBeUndefined();
  });

  it('retries on partial responses, including prior descriptions as context', async () => {
    const outline = makeOutline([
      step(0, 'thinking', 'a'),
      step(1, 'thinking', 'b'),
      step(2, 'thinking', 'c'),
      step(3, 'thinking', 'd'),
    ]);
    const primitive = stubPrimitive([
      // Batch 1: only fills 0 and 1.
      { rawText: '{"descriptions":{"0":"first","1":"second"}}' },
      // Batch 2: fills 2 and 3.
      { rawText: '{"descriptions":{"2":"third","3":"fourth"}}' },
    ]);
    const { outline: out, annotation } = await annotateOutline(outline, '/tmp', {
      batchSize: 2,
      primitive,
    });
    expect(primitive.callCount()).toBe(2);
    expect(annotation.forks).toHaveLength(2);
    expect(annotation.forks[0]!.describedStepIndexes).toEqual([0, 1]);
    expect(annotation.forks[1]!.describedStepIndexes).toEqual([2, 3]);
    expect(annotation.remainingUntagged).toBe(0);
    // The second prompt must mention the first batch's descriptions
    // under ALREADY_TAGGED so the model stays consistent in tone.
    expect(primitive.prompts()[1]).toContain('ALREADY_TAGGED');
    expect(primitive.prompts()[1]).toContain('first');
    expect(primitive.prompts()[1]).toContain('second');
    expect(out.steps.every((s) => !!s.description)).toBe(true);
  });

  it('bails out after a batch returns zero descriptions to avoid burning forks', async () => {
    const outline = makeOutline([
      step(0, 'thinking', 'x'),
      step(1, 'thinking', 'y'),
    ]);
    const primitive = stubPrimitive([
      { rawText: '{"descriptions":{}}' },
      // This response should NEVER be consumed — bail-out kicks in first.
      { rawText: '{"descriptions":{"0":"a","1":"b"}}' },
    ]);
    const { annotation } = await annotateOutline(outline, '/tmp', {
      maxAttempts: 5,
      primitive,
    });
    expect(primitive.callCount()).toBe(1);
    expect(annotation.remainingUntagged).toBe(2);
  });

  it('survives an unparseable batch and continues to the next attempt', async () => {
    const outline = makeOutline([
      step(0, 'thinking', 'x'),
      step(1, 'thinking', 'y'),
    ]);
    const primitive = stubPrimitive([
      // Junk: no JSON at all.
      { rawText: 'I cannot help with that.' },
      // Junk again; the bail-out triggers because attempt 1 had 0
      // descriptions, so attempt 2 isn't even tried.
      { rawText: '{"descriptions":{"0":"one","1":"two"}}' },
    ]);
    const { annotation } = await annotateOutline(outline, '/tmp', {
      maxAttempts: 5,
      primitive,
    });
    // Same as above: 0 described in the first attempt → bail out.
    expect(primitive.callCount()).toBe(1);
    expect(annotation.remainingUntagged).toBe(2);
  });

  it('caps at maxAttempts even if forward progress continues', async () => {
    const outline = makeOutline([
      step(0, 'thinking', 'a'),
      step(1, 'thinking', 'b'),
      step(2, 'thinking', 'c'),
      step(3, 'thinking', 'd'),
    ]);
    const primitive = stubPrimitive([
      { rawText: '{"descriptions":{"0":"first"}}' },
      { rawText: '{"descriptions":{"1":"second"}}' },
    ]);
    const { annotation } = await annotateOutline(outline, '/tmp', {
      batchSize: 1,
      maxAttempts: 2,
      primitive,
    });
    expect(primitive.callCount()).toBe(2);
    expect(annotation.forks).toHaveLength(2);
    expect(annotation.remainingUntagged).toBe(2);
  });

  it('forwards progress events for each phase', async () => {
    const outline = makeOutline([step(0, 'thinking', 'a')]);
    const primitive = stubPrimitive([
      { rawText: '{"descriptions":{"0":"only"}}' },
    ]);
    const phases: string[] = [];
    await annotateOutline(outline, '/tmp', {
      primitive,
      onProgress: (e) => {
        phases.push(e.phase);
      },
    });
    // Outer loop emits started → cli-spawned → parsed → assistant-complete.
    // (Inner primitive emits more, but our stub doesn't.)
    expect(phases).toContain('started');
    expect(phases).toContain('cli-spawned');
    expect(phases).toContain('parsed');
    expect(phases).toContain('assistant-complete');
  });

  it('always calls primitive.shutdown() — even when forkAndAnnotate throws', async () => {
    const outline = makeOutline([step(0, 'thinking', 'x')]);
    let shutdownCalled = false;
    const primitive: AnnotatorPrimitive = {
      toolId: 'claude',
      async prepare() {},
      async forkAndAnnotate() {
        throw new Error('simulated fork failure');
      },
      async shutdown() {
        shutdownCalled = true;
      },
    };
    await expect(
      annotateOutline(outline, '/tmp', { primitive }),
    ).rejects.toThrow(/simulated fork failure/);
    expect(shutdownCalled).toBe(true);
  });

  it('rebuilds segments so descriptions land inside segments[].steps[]', async () => {
    const outline: SessionOutline = {
      toolId: 'claude',
      sourceSessionId: 'src-2',
      cwd: '/tmp',
      steps: [
        step(0, 'user-instruction', 'q'),
        step(1, 'thinking', 'plan'),
        step(2, 'assistant-text', 'reply'),
      ],
      segments: [
        {
          openedByStep: null,
          closedByStep: 0,
          userInstructionExcerpt: '',
          steps: [],
        },
        {
          openedByStep: 0,
          closedByStep: null,
          userInstructionExcerpt: 'q',
          steps: [step(1, 'thinking', 'plan'), step(2, 'assistant-text', 'reply')],
        },
      ],
      generatedAt: '2026-05-09T00:00:00.000Z',
    };
    const primitive = stubPrimitive([
      { rawText: '{"descriptions":{"1":"plans","2":"replies"}}' },
    ]);
    const { outline: out } = await annotateOutline(outline, '/tmp', { primitive });
    const trailingSegment = out.segments[1]!;
    expect(trailingSegment.steps[0]!.description).toBe('plans');
    expect(trailingSegment.steps[1]!.description).toBe('replies');
  });
});
