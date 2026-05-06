/**
 * Shared shapes for per-CLI session readers.
 *
 * Each reader walks its CLI's on-disk session storage and returns a
 * `ProjectScan[]` — one entry per project (cwd grouping) with a `toolId`
 * stamp. The orchestrator (../sessionReader.ts) merges scans across all
 * readers and exposes the result through the data-source RPC handlers.
 */

import type { SessionMetaView } from '@context-action/session-core';

export interface ProjectScan {
  /** Stable, globally-unique id of the form `${toolId}:${nativeId}`. */
  id: string;
  toolId: 'claude' | 'codex' | 'gemini';
  /** Display path (resolved cwd, falls back to native dir name). */
  path: string;
  sessions: SessionMetaView[];
  lastSeenAt: number;
}

export interface CliSessionReader {
  toolId: ProjectScan['toolId'];
  scanAll(): Promise<ProjectScan[]>;
}
