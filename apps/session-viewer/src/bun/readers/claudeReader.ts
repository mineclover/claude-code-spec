/**
 * Claude session reader. Walks `~/.claude/projects/<dash-dir>/*.jsonl`
 * and surfaces SessionMetaView entries with full cache metrics computed
 * from the JSONL stream events (input/output/cache_read/cache_creation).
 *
 * We reimplement the minimum surface here instead of importing the main
 * app's claudeSessions.ts because that service couples to Electron's
 * `app` and the project-wide settings store. This bun-side variant is
 * Electrobun-friendly and only depends on node:fs/os/path.
 */

import {
  emptyCacheMetrics,
  extractCwd,
  extractModel,
  extractToolDelta,
  inferProjectPathFromDashDirName,
  updateCacheMetrics,
  type SessionMetaView,
} from '@context-action/session-core';
import { sha256OfCanonicalJson } from '@context-action/session-core/hash';
import type { StreamEvent } from '@context-action/code-api';
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CliSessionReader, ProjectScan } from './types';

const TOOL_ID = 'claude' as const;
const ROOT = join(homedir(), '.claude', 'projects');

async function safeStat(path: string): Promise<{ mtimeMs: number } | null> {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

async function listProjectDirs(): Promise<string[]> {
  try {
    const entries = await readdir(ROOT, { withFileTypes: true });
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

interface ParsedSession {
  view: SessionMetaView;
  projectPath: string | null;
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
    toolId: TOOL_ID,
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
    toolId: TOOL_ID,
    lastModifiedMs: stats.mtimeMs,
  };

  return { view, projectPath };
}

async function scanProject(dirName: string): Promise<ProjectScan | null> {
  const projectDir = join(ROOT, dirName);
  const files = await listJsonlFiles(projectDir);
  if (files.length === 0) return null;

  const parsed: ParsedSession[] = [];
  for (const fileName of files) {
    const session = await parseSessionFile(projectDir, fileName);
    if (session) parsed.push(session);
  }
  if (parsed.length === 0) return null;

  parsed.sort((a, b) => (b.view.lastModifiedMs ?? 0) - (a.view.lastModifiedMs ?? 0));

  const inferredPath = parsed.find((p) => p.projectPath)?.projectPath;
  const fallbackPath = inferProjectPathFromDashDirName(dirName);

  return {
    id: `${TOOL_ID}:${dirName}`,
    toolId: TOOL_ID,
    path: inferredPath ?? fallbackPath ?? dirName,
    sessions: parsed.map((p) => p.view),
    lastSeenAt: parsed[0]?.view.lastModifiedMs ?? 0,
  };
}

export const claudeReader: CliSessionReader = {
  toolId: TOOL_ID,
  async scanAll(): Promise<ProjectScan[]> {
    const dirs = await listProjectDirs();
    const scans: ProjectScan[] = [];
    for (const dir of dirs) {
      const scan = await scanProject(dir);
      if (scan) scans.push(scan);
    }
    return scans;
  },
};
