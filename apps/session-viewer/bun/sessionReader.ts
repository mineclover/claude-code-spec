/**
 * Bun-side session reader. Walks `~/.claude/projects/*` and surfaces the same
 * SessionMetaView shape the mock adapter returns, so the UI is identical.
 *
 * Why not import @context-action/session-core's claude-sessions service?
 *   - That service depends on Electron's `app` for path resolution and on the
 *     project's settings store. We want this PoC to run under plain Bun with
 *     zero Electron coupling, so we reimplement the minimum we need here:
 *     iterate `~/.claude/projects/<dash-dir>/*.jsonl`, fold the events into
 *     the cache-metrics reducer, derive a fingerprint hash from the model +
 *     observed tool set. Production flow can later swap in the full
 *     SessionAnalyticsService once it's been freed of its Electron deps.
 */

import {
  emptyCacheMetrics,
  extractCwd,
  extractModel,
  extractToolDelta,
  inferProjectPathFromDashDirName,
  sha256OfCanonicalJson,
  updateCacheMetrics,
  type SessionMetaView,
} from '@context-action/session-core';
import type { StreamEvent } from '@context-action/code-api';
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ProjectListItem } from '../src/data/dataSource';

const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

interface ParsedSession {
  sessionId: string;
  projectPath: string | null;
  model: string | null;
  tools: Set<string>;
  metricsView: SessionMetaView;
  lastModifiedMs: number;
}

async function safeStat(path: string): Promise<{ mtimeMs: number } | null> {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

async function listProjectDirs(): Promise<string[]> {
  try {
    const entries = await readdir(CLAUDE_PROJECTS_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function listJsonlFiles(projectDir: string): Promise<string[]> {
  try {
    const entries = await readdir(projectDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.jsonl'))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

async function parseSessionFile(
  projectDir: string,
  fileName: string,
): Promise<ParsedSession | null> {
  const filePath = join(projectDir, fileName);
  const stats = await safeStat(filePath);
  if (!stats) return null;

  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    return null;
  }

  const sessionId = fileName.replace(/\.jsonl$/, '');
  const tools = new Set<string>();
  let model: string | null = null;
  let projectPath: string | null = null;
  const metrics = emptyCacheMetrics();

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }

    // Update cache metrics off the same reducer the mock uses.
    updateCacheMetrics(metrics, event as unknown as StreamEvent);

    if (!model) model = extractModel(event);
    if (!projectPath) projectPath = extractCwd(event);
    const delta = extractToolDelta(event);
    if (delta) {
      for (const t of delta.added) tools.add(t);
      for (const t of delta.removed) tools.delete(t);
    }
  }

  const fingerprintHash = sha256OfCanonicalJson({
    model: model ?? '',
    tools: [...tools].sort(),
  });

  const view: SessionMetaView = {
    source: 'derived',
    sessionId,
    fingerprintHash,
    metrics,
    model: model ?? undefined,
    toolCount: tools.size,
  };

  return {
    sessionId,
    projectPath,
    model,
    tools,
    metricsView: view,
    lastModifiedMs: stats.mtimeMs,
  };
}

interface ProjectScan {
  id: string;
  path: string;
  sessions: ParsedSession[];
  lastSeenAt: number;
}

async function scanProject(dirName: string): Promise<ProjectScan | null> {
  const projectDir = join(CLAUDE_PROJECTS_DIR, dirName);
  const files = await listJsonlFiles(projectDir);
  if (files.length === 0) return null;

  const parsed: ParsedSession[] = [];
  for (const fileName of files) {
    const session = await parseSessionFile(projectDir, fileName);
    if (session) parsed.push(session);
  }
  if (parsed.length === 0) return null;

  parsed.sort((a, b) => b.lastModifiedMs - a.lastModifiedMs);

  const inferred = parsed.find((s) => s.projectPath)?.projectPath;
  const fallback = inferProjectPathFromDashDirName(dirName);

  return {
    id: dirName,
    path: inferred ?? fallback ?? dirName,
    sessions: parsed,
    lastSeenAt: parsed[0]?.lastModifiedMs ?? 0,
  };
}

let cache: ProjectScan[] | null = null;

async function refreshCache(): Promise<ProjectScan[]> {
  const dirs = await listProjectDirs();
  const scans: ProjectScan[] = [];
  for (const dir of dirs) {
    const scan = await scanProject(dir);
    if (scan) scans.push(scan);
  }
  scans.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  cache = scans;
  return scans;
}

export async function listProjects(): Promise<ProjectListItem[]> {
  const scans = cache ?? (await refreshCache());
  return scans.map((s) => ({
    id: s.id,
    path: s.path,
    sessionCount: s.sessions.length,
    lastSeenAt: s.lastSeenAt,
  }));
}

export async function listSessions(projectId: string): Promise<SessionMetaView[]> {
  const scans = cache ?? (await refreshCache());
  const project = scans.find((s) => s.id === projectId);
  return project ? project.sessions.map((s) => s.metricsView) : [];
}

export async function invalidateCache(): Promise<void> {
  cache = null;
}
