/**
 * Session-outline domain types.
 *
 * The outline is a structured decomposition of a CLI session — every
 * recorded turn split into discrete steps, classified by kind, and
 * grouped into segments bounded by user instructions. It's the
 * substrate the annotator (Phase 2) attaches one-line description
 * tags to.
 *
 * The shape is the same regardless of which CLI produced the source
 * (claude / codex / gemini). Each per-CLI extractor in
 * `packages/session-core/src/outline/extract*.ts` is responsible for
 * normalising the wire format into these structs.
 */

/**
 * Coarse classification of one step in the conversation. Stable
 * because the GUI uses these as a discriminator for icons / colors,
 * and the annotator prompt enumerates them.
 */
export type SessionStepKind =
  | 'user-instruction' // human turn — segment boundary
  | 'thinking' // assistant reasoning before producing text or tool calls
  | 'tool-call' // assistant invoking a tool (Bash / Edit / MCP / etc.)
  | 'tool-result' // tool execution output sent back as user-role content
  | 'assistant-text' // assistant final user-visible response
  | 'meta'; // system_init, permissions, file-history snapshots, …

export interface SessionStep {
  /** 0-based ordinal across the entire outline. Stable for cross-references. */
  index: number;
  kind: SessionStepKind;
  /**
   * Turn cycle this step belongs to. A "turn" is one user→assistant
   * cycle; assistant content (text + tool calls + thinking) shares
   * the same turnIndex. Useful for `#turnIndex.blockIndex` addresses.
   */
  turnIndex: number;
  /** Sub-block index within a turn, 0-based. */
  blockIndex: number;
  /** Tool name when kind is `tool-call` or `tool-result`; otherwise undefined. */
  toolName?: string;
  /**
   * Up-to-`MAX_EXCERPT_CHARS` first chars of the step's textual
   * content. Used by the annotator to anchor descriptions. Truncation
   * sentinel `…(+N more)` is appended when content is longer.
   */
  excerpt: string;
  /**
   * 1-line description tag, populated by the annotator. Empty when
   * the outline is read straight off disk.
   */
  description?: string;
  /**
   * Original event timestamp from the JSONL when present. ISO string.
   */
  timestamp?: string;
}

export const MAX_EXCERPT_CHARS = 600;

export interface SessionSegment {
  /**
   * Index of the user instruction that opens this segment (inclusive).
   * `null` for an opening segment that precedes any user instruction
   * (e.g. system inits before the first user turn).
   */
  openedByStep: number | null;
  /**
   * Index of the user instruction that closes this segment (exclusive).
   * `null` for the trailing segment that runs to the end of the session.
   */
  closedByStep: number | null;
  /**
   * The user-instruction step that opens the segment, surfaced as a
   * convenience for renderers. Empty for the opening segment.
   */
  userInstructionExcerpt: string;
  /** Steps inside the segment (excludes the bounding user-instruction itself). */
  steps: SessionStep[];
}

export interface SessionOutline {
  toolId: 'claude' | 'codex' | 'gemini';
  sourceSessionId: string;
  cwd: string;
  /** Every step in source order, including user-instruction boundaries. */
  steps: SessionStep[];
  /** Steps grouped between user-instruction boundaries. */
  segments: SessionSegment[];
  /** Top-level model id from system_init when available. */
  model?: string;
  /** ISO timestamp of when the host materialised the outline. */
  generatedAt: string;
  /** Operator-supplied or default annotator language, surfaced for UI. */
  language?: 'en' | 'ko';
  /**
   * Set when the annotator has populated `description` on (most) steps.
   * Carries a trail of forks so the UI can show how many cache-preserving
   * fork attempts were stitched together to fill descriptions.
   */
  annotation?: SessionOutlineAnnotation;
}

export interface AnnotationFork {
  forkSessionId: string | null;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  inputTokens: number;
  durationMs?: number;
  costUsd?: number;
  /** Step indexes that received a description from this fork. */
  describedStepIndexes: number[];
}

export interface SessionOutlineAnnotation {
  forks: AnnotationFork[];
  /** Number of describable steps that still lack a description. */
  remainingUntagged: number;
  /** ISO timestamp of when annotation finished. */
  annotatedAt: string;
}
