/**
 * Multi-CLI session reader orchestrator.
 *
 * Aggregates ProjectScans from each per-CLI reader (claude / codex / gemini),
 * caches the result in memory, and exposes the listProjects/listSessions API
 * that the bun-side RPC handlers call. invalidateCache clears the cache so
 * subsequent calls reload from disk (wired to SIGUSR1 in src/bun/index.ts).
 */

import type { SessionMetaView } from '../types/prefix-fingerprint';
import type { ProjectListItem } from '../types/portable';
import { claudeReader } from '../agents/claude/reader';
import { codexReader } from '../agents/codex/reader';
import { geminiReader } from '../agents/gemini/reader';
import type { CliSessionReader, ProjectScan } from './readers/types';

const READERS: CliSessionReader[] = [claudeReader, codexReader, geminiReader];

let cache: ProjectScan[] | null = null;

async function refreshCache(): Promise<ProjectScan[]> {
  // Run readers in parallel — each one is I/O bound on its own directory tree
  // and they have no overlap, so concurrent walks are strictly faster.
  const start = Date.now();
  const buckets = await Promise.all(
    READERS.map(async (r) => {
      const t0 = Date.now();
      try {
        const scans = await r.scanAll();
        // stderr — keeps stdout clean for `--json` consumers; the GUI
        // host's launcher routes both streams to its log file anyway.
        console.error(
          `[sessionReader] ${r.toolId} → ${scans.length} project(s) in ${Date.now() - t0}ms`,
        );
        return scans;
      } catch (err) {
        console.error(`[sessionReader] ${r.toolId} reader failed`, err);
        return [];
      }
    }),
  );
  const all = buckets.flat();
  all.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  cache = all;
  console.error(
    `[sessionReader] total ${all.length} project(s) in ${Date.now() - start}ms`,
  );
  return all;
}

export async function listProjects(): Promise<ProjectListItem[]> {
  const scans = cache ?? (await refreshCache());
  return scans.map((s) => ({
    id: s.id,
    path: s.path,
    sessionCount: s.sessions.length,
    lastSeenAt: s.lastSeenAt,
    toolId: s.toolId,
  }));
}

export async function listSessions(projectId: string): Promise<SessionMetaView[]> {
  const scans = cache ?? (await refreshCache());
  const project = scans.find((s) => s.id === projectId);
  return project ? project.sessions : [];
}

export interface ResolvedSession {
  toolId: ProjectScan['toolId'];
  cwd: string;
  sessionId: string;
}

/**
 * Find which CLI / cwd a sessionId belongs to. Used by the branch RPC
 * handler to decide which runner to dispatch and which project space the
 * fork should land in.
 */
export async function resolveSession(
  sessionId: string,
): Promise<ResolvedSession | null> {
  const scans = cache ?? (await refreshCache());
  for (const scan of scans) {
    const match = scan.sessions.find((s) => s.sessionId === sessionId);
    if (match) {
      return {
        toolId: scan.toolId,
        cwd: scan.path,
        sessionId,
      };
    }
  }
  return null;
}

export async function invalidateCache(): Promise<void> {
  cache = null;
}
