/**
 * Types shared between server-side modules (readers, summary store) and
 * renderer-side adapters (data source, RPC schema). Kept here so neither
 * the server-only sub-paths nor the browser-safe main barrel duplicates
 * the shape, and the apps layer just re-exports.
 */

import type { SummaryLanguage, SummaryResult } from '../summary/types';

/**
 * One project = one cwd that contains many sessions. Readers group
 * sessions by their resolved project path and surface a stable `id`
 * for navigation.
 */
export interface ProjectListItem {
  id: string;
  /** Display path (cwd or its abbreviation). */
  path: string;
  sessionCount: number;
  /** Most recent session timestamp, ms. Optional for adapters that don't track. */
  lastSeenAt?: number;
  /** CLI that owns this project, e.g. 'claude' | 'codex' | 'gemini'. */
  toolId?: string;
}

/**
 * Persisted record of a past branch evaluation. The host writes one of
 * these to disk after a successful branch resolves; consumers fetch them
 * back via the summary store.
 */
export interface SummaryRecord {
  /** Stable id — matches `summary.cacheInvariants.forkSessionId` when set. */
  id: string;
  /** Source session this branch was produced from. */
  sourceSessionId: string;
  /** Which CLI ran the fork. */
  toolId: string;
  /** cwd of the source session at fork time. */
  cwd: string;
  /** ISO timestamp of when the host materialised the record. */
  createdAt: string;
  /** Optional operator-supplied prompt override (if any). */
  promptOverride?: string;
  /** Language the model wrote the summary in (best-effort label). */
  language?: SummaryLanguage;
  /** The full structured summary as returned by the runner. */
  summary: SummaryResult;
}

export interface ListSummariesFilter {
  /** Restrict to summaries forked from this source session. */
  sourceSessionId?: string;
}
