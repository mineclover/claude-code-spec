/**
 * Agent-agnostic helpers used by every per-CLI outline extractor.
 *
 * Lives outside `agents/<id>/` because the same algorithm runs for
 * Claude, Codex, and Gemini outputs — segment boundaries are a
 * function of the universal `SessionStep[]` shape, not the source
 * CLI's wire format.
 */

import type { SessionSegment, SessionStep } from './types';

/**
 * Walk the flat step list and split it into segments bounded by
 * user-instruction steps.
 *
 * Layout:
 *   - First segment (`openedByStep === null`) holds anything before
 *     the first user instruction (typically `meta` rows). Empty
 *     segments are kept so the outline still reflects original order.
 *   - Each subsequent segment opens at the user-instruction it's named
 *     after and ends at the next one (or the end of the session for
 *     the trailing segment).
 *   - The user-instruction step itself is NOT inside `segment.steps`
 *     — it bounds the segment, not lives inside it. This makes
 *     rendering "user said X, then 4 things happened" trivial.
 */
export function groupIntoSegments(
  steps: readonly SessionStep[],
): SessionSegment[] {
  const segments: SessionSegment[] = [];
  let current: SessionSegment = {
    openedByStep: null,
    closedByStep: null,
    userInstructionExcerpt: '',
    steps: [],
  };
  for (const s of steps) {
    if (s.kind === 'user-instruction') {
      current.closedByStep = s.index;
      segments.push(current);
      current = {
        openedByStep: s.index,
        closedByStep: null,
        userInstructionExcerpt: s.excerpt,
        steps: [],
      };
      continue;
    }
    current.steps.push(s);
  }
  segments.push(current);
  return segments;
}
