/**
 * Branched-summary contract.
 *
 * The Session Viewer's signature operation is "fork the active session's
 * prefix into a sidecar thread, run a summary prompt only there, and never
 * touch the live thread." This file describes the structured shape that
 * sidecar should return so the GUI can render it as something richer than
 * a wall of prose.
 *
 * The CLI is asked to emit JSON matching `SummaryResult` (see
 * packages/cli-runner's prompt templates). The host validates the JSON
 * with a Zod schema before handing it to the renderer; partial data is
 * tolerated — every list field is optional and an empty array.
 *
 * The `cacheInvariants` block is populated by the host, NOT the model. It
 * carries the operational measurements that prove the fork preserved the
 * prefix (cache_read_input_tokens > 0 on the first turn of the fork). The
 * model only fills in the narrative parts.
 */

/** Single decision recorded during the source session. */
export interface SummaryDecision {
  /** Headline of the decision (≤ 80 chars). */
  title: string;
  /** Optional one-paragraph rationale; omitted when uninformative. */
  rationale?: string;
  /** Status used by the GUI to color/group decisions. */
  status?: 'adopted' | 'rejected' | 'open';
}

/** A file or symbol the session interacted with. */
export interface SummaryReference {
  /** Repo-relative path or symbol name. */
  target: string;
  /** Why it mattered ("modified", "inspected", "blocked progress" etc.). */
  note?: string;
  /**
   * Coarse role for sidebar grouping: code/config/docs/external.
   * Optional because the model isn't always confident.
   */
  kind?: 'code' | 'config' | 'docs' | 'test' | 'external';
}

/** Outstanding question or unresolved branch the operator should review. */
export interface SummaryOpenItem {
  question: string;
  /** Hint at where in the conversation it surfaced (#N or #N.k addresses). */
  anchor?: string;
}

/** Suggested next-step prompt the operator can copy-run. */
export interface SummaryNextAction {
  prompt: string;
  /** When set, GUI shows it as a copy/run button label. */
  label?: string;
}

/**
 * Operational measurements that confirm the branch shared the source's
 * prefix bytes. Populated host-side after the sidecar's first turn.
 */
export interface SummaryCacheInvariants {
  /** New thread/session id allocated for the fork. */
  forkSessionId: string;
  /** Source session whose prefix was forked from. */
  sourceSessionId: string;
  /** cache_read_input_tokens reported on the first sidecar turn. */
  cacheReadTokens: number;
  /** cache_creation_input_tokens reported on the first sidecar turn. */
  cacheCreationTokens: number;
  /** Plain input tokens (uncached) on the first sidecar turn. */
  inputTokens: number;
  /**
   * cache_read / (cache_read + input). Approaches 1.0 when the prefix is
   * intact; falls toward 0 when something invalidated the cache (e.g. an
   * append into the live thread between snapshot and fork).
   */
  prefixPreservedRatio: number;
  /** Provider ms duration, useful when judging the cost of the eval. */
  durationMs?: number;
  /** Provider's reported total cost USD for the sidecar turn. */
  costUsd?: number;
}

export interface SummaryResult {
  /** Single-line headline. Should fit in a card title. */
  oneLiner: string;
  /** 2–3 sentence narrative aimed at the human operator. */
  narrative: string;
  /** Discrete decisions established or rejected during the source session. */
  keyDecisions: SummaryDecision[];
  /** Files / symbols / external references the session touched. */
  references: SummaryReference[];
  /** Items the operator may want to address before continuing. */
  openItems: SummaryOpenItem[];
  /** Operator-actionable next prompts. */
  nextActions: SummaryNextAction[];
  /**
   * Cache-preservation measurements. Always set for adapters that actually
   * spawned a CLI; absent when the result was synthesized (mock/fixture).
   */
  cacheInvariants?: SummaryCacheInvariants;
  /**
   * Free-form sources the model wants to attribute. Useful when the
   * narrative is grounded in specific turn ranges (e.g. ["#3..#7"]).
   */
  sources?: string[];
  /** ISO timestamp when the host materialised this object. */
  generatedAt: string;
}
