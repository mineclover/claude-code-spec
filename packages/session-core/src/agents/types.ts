/**
 * Common agent abstractions.
 *
 * "Agent" in this codebase means one of the supported CLI assistants
 * — Claude, Codex, or Gemini — abstracted enough that callers can
 * dispatch by id without baking a switch statement at every consumer.
 *
 * Two responsibilities live behind every agent:
 *
 *   1. Read raw session bytes off disk (per-CLI storage layout).
 *   2. Translate those bytes into a `SessionOutline`.
 *
 * Both are pure-ish (the reader hits node:fs, the extractor is pure
 * string manipulation), so they're paired in a single `AgentDefinition`
 * and surfaced through `AGENTS[id]`. Higher-level surfaces (cli-runner
 * annotator, session-viewer GUI) compose these two pieces with their
 * own per-CLI fork primitives.
 *
 * Adding a new agent: implement an `AgentReader` + `AgentOutlineExtractor`
 * pair in `server/readers/<name>Reader.ts` + `outline/extract-<name>.ts`,
 * then register the pair in `agents/registry.ts`. Every dispatch site
 * picks up the new agent automatically.
 */

import type { SessionOutline } from '../outline/types';
import type { SessionMetaView } from '../types/prefix-fingerprint';

/**
 * Stable id of a supported CLI agent. Brand-new style would use a
 * branded string type, but `AgentId` flows through enough Zod / RPC /
 * persisted JSON boundaries that a plain union is more pragmatic.
 */
export type AgentId = 'claude' | 'codex' | 'gemini';

export const AGENT_IDS: readonly AgentId[] = ['claude', 'codex', 'gemini'] as const;

export function isAgentId(value: unknown): value is AgentId {
  return (
    typeof value === 'string' &&
    (value === 'claude' || value === 'codex' || value === 'gemini')
  );
}

/**
 * Minimal raw-bytes reader for one agent. Returns the session's
 * on-disk content as a string (JSONL for claude/codex, single JSON
 * doc for gemini), or `null` when the session can't be located.
 *
 * `cwd` is part of the key for claude (drives the dash-encoded
 * project dir) and gemini (sha256 of cwd → tmp subdir). Codex
 * doesn't need it (the rollout filename carries the session id),
 * but it's accepted for shape uniformity.
 */
export interface AgentReader {
  readSessionRaw(sessionId: string, cwd: string): Promise<string | null>;
}

/**
 * Outline extractor for one agent. Pure transformation from raw bytes
 * to `SessionOutline` — no disk I/O, no model calls.
 */
export interface AgentOutlineExtractor {
  extract(args: {
    raw: string;
    sourceSessionId: string;
    cwd: string;
    language?: 'en' | 'ko';
  }): SessionOutline;
}

export interface AgentDefinition {
  id: AgentId;
  reader: AgentReader;
  outline: AgentOutlineExtractor;
}

/**
 * Per-project rollup an agent's `scanAll()` produces. The multi-agent
 * project aggregator in `server/session-reader.ts` merges these from
 * every registered agent into the unified project list the data
 * source surfaces over RPC.
 */
export interface ProjectScan {
  /** Stable, globally-unique id of the form `${toolId}:${nativeId}`. */
  id: string;
  toolId: AgentId;
  /** Display path (resolved cwd, falls back to native dir name). */
  path: string;
  sessions: SessionMetaView[];
  lastSeenAt: number;
}

/**
 * Project-list-side reader contract — every agent implements this in
 * its `agents/<id>/reader.ts`, alongside `readSessionRaw`. The split
 * between `CliSessionReader.scanAll()` (project enumeration) and
 * `AgentReader.readSessionRaw()` (individual session bytes) reflects
 * the two consumers: the aggregator wants a fast survey of all
 * sessions, the outline composer wants exact bytes for one.
 */
export interface CliSessionReader {
  toolId: AgentId;
  scanAll(): Promise<ProjectScan[]>;
}
