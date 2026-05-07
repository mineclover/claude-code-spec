/**
 * Sub-path entry for the session-outline domain.
 *
 * Exports both the types (browser-safe — useable from the renderer
 * to display an outline) and the Claude extractor (server-only — uses
 * pure string parsing, no node:fs, but it's still grouped here as
 * "outline" machinery rather than spread across the main barrel).
 */

export type {
  SessionOutline,
  SessionSegment,
  SessionStep,
  SessionStepKind,
} from './outline/types';
export { MAX_EXCERPT_CHARS } from './outline/types';
export {
  extractClaudeOutline,
  groupIntoSegments,
} from './outline/extract';
