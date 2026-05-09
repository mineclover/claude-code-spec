/**
 * Tests for the agent-agnostic segment grouper.
 *
 * `groupIntoSegments` lives outside any per-agent directory because
 * the algorithm is universal — it operates on the abstract
 * `SessionStep[]` shape, not on any CLI's wire format. Pinning the
 * boundary semantics here keeps each per-agent extractor's test file
 * focused on that CLI's parsing quirks.
 */

import { describe, expect, it } from 'vitest';
import { groupIntoSegments } from './grouping';
import type { SessionStep } from './types';

function step(
  kind: SessionStep['kind'],
  index: number,
  excerpt = '',
): SessionStep {
  return { index, kind, turnIndex: 0, blockIndex: 0, excerpt };
}

describe('groupIntoSegments', () => {
  it('splits the flat list at every user-instruction boundary', () => {
    const steps: SessionStep[] = [
      step('meta', 0),
      step('user-instruction', 1, 'first'),
      step('thinking', 2),
      step('tool-call', 3),
      step('user-instruction', 4, 'second'),
      step('assistant-text', 5),
    ];
    const segments = groupIntoSegments(steps);
    expect(segments).toHaveLength(3);
    expect(segments[0]!.openedByStep).toBeNull();
    expect(segments[0]!.closedByStep).toBe(1);
    expect(segments[0]!.steps.map((s) => s.index)).toEqual([0]);
    expect(segments[1]!.openedByStep).toBe(1);
    expect(segments[1]!.closedByStep).toBe(4);
    expect(segments[1]!.userInstructionExcerpt).toBe('first');
    expect(segments[1]!.steps.map((s) => s.index)).toEqual([2, 3]);
    expect(segments[2]!.openedByStep).toBe(4);
    expect(segments[2]!.closedByStep).toBeNull();
    expect(segments[2]!.steps.map((s) => s.index)).toEqual([5]);
  });

  it('produces a single empty segment when no user-instruction is present', () => {
    const steps = [step('meta', 0)];
    const segments = groupIntoSegments(steps);
    expect(segments).toHaveLength(1);
    expect(segments[0]!.openedByStep).toBeNull();
    expect(segments[0]!.closedByStep).toBeNull();
    expect(segments[0]!.steps).toHaveLength(1);
  });

  it('produces an empty trailing segment when the last step is a user-instruction', () => {
    const steps: SessionStep[] = [step('user-instruction', 0, 'q')];
    const segments = groupIntoSegments(steps);
    // Opening segment (0 steps), trailing segment opened by index 0 with no steps.
    expect(segments).toHaveLength(2);
    expect(segments[1]!.openedByStep).toBe(0);
    expect(segments[1]!.closedByStep).toBeNull();
    expect(segments[1]!.steps).toEqual([]);
  });

  it('returns a single empty segment for an empty step array', () => {
    expect(groupIntoSegments([])).toEqual([
      {
        openedByStep: null,
        closedByStep: null,
        userInstructionExcerpt: '',
        steps: [],
      },
    ]);
  });

  it('emits one segment per user instruction even with no inner steps', () => {
    const steps: SessionStep[] = [
      step('user-instruction', 0, 'q1'),
      step('user-instruction', 1, 'q2'),
      step('user-instruction', 2, 'q3'),
    ];
    const segments = groupIntoSegments(steps);
    // Opening segment + one per user-instruction = 4 total.
    expect(segments).toHaveLength(4);
    expect(segments.map((s) => s.openedByStep)).toEqual([null, 0, 1, 2]);
    for (const seg of segments) {
      expect(seg.steps).toEqual([]);
    }
  });

  it('does not include the bounding user-instruction inside its own segment.steps', () => {
    const steps: SessionStep[] = [
      step('user-instruction', 0, 'q'),
      step('thinking', 1),
    ];
    const segments = groupIntoSegments(steps);
    // The user instruction itself is NOT in steps[]; only the
    // 'thinking' step is.
    expect(segments[1]!.steps.map((s) => s.kind)).toEqual(['thinking']);
    // But its excerpt is on the segment itself for header rendering.
    expect(segments[1]!.userInstructionExcerpt).toBe('q');
  });
});
