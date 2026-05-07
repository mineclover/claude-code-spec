/**
 * Codex session reader. Walks `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`
 * and groups by the cwd recorded in the leading `session_meta` event.
 *
 * Performance notes
 *   The full Codex archive can run into the high tens of thousands of files
 *   (87K+ on this machine). Reading each one to extract cwd would block the
 *   RPC for 30s+. We therefore:
 *     - Limit the scan window to the last `WINDOW_DAYS` of date partitions
 *     - Open each file with a 16KB partial read instead of `readFile`, since
 *       the `session_meta` event always sits at the top of the rollout
 *     - Skip per-turn token aggregation (metrics fall back to zeroes); the
 *       Phase A goal is just to surface sessions and their cwd grouping
 */

import { emptyCacheMetrics } from '../../cacheMetrics';
import type { SessionMetaView } from '../../types/prefix-fingerprint';
import { sha256OfCanonicalJson } from '../../prefixHashing';
import { open, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CliSessionReader, ProjectScan } from './types';

const TOOL_ID = 'codex' as const;
const ROOT = join(homedir(), '.codex', 'sessions');
const WINDOW_DAYS = Number.parseInt(process.env.SESSION_VIEWER_CODEX_DAYS ?? '30', 10);
const HEAD_READ_BYTES = 16 * 1024;
const TAIL_READ_BYTES = 64 * 1024;

async function safeStat(
  path: string,
): Promise<{ mtimeMs: number; size: number } | null> {
  try {
    const s = await stat(path);
    return { mtimeMs: s.mtimeMs, size: s.size };
  } catch {
    return null;
  }
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function listJsonlFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.jsonl'))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Generate the [YYYY, MM, DD] tuples for the last `days` days, newest first.
 * We use a literal calendar walk (not stat-based discovery) because the
 * folder layout is strict and skipping non-existent days is cheap.
 */
function recentDayPartitions(days: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    out.push(join(ROOT, yyyy, mm, dd));
  }
  return out;
}

const CWD_REGEX = /"cwd"\s*:\s*"((?:[^"\\]|\\.)*)"/;
const SESSION_ID_REGEX = /"id"\s*:\s*"([0-9a-f-]{8,})"/i;

interface HeadMeta {
  cwd: string | null;
  sessionId: string | null;
}

async function readBytes(
  filePath: string,
  offset: number,
  length: number,
): Promise<string | null> {
  let fh: Awaited<ReturnType<typeof open>> | null = null;
  try {
    fh = await open(filePath, 'r');
    const buf = Buffer.alloc(length);
    const { bytesRead } = await fh.read(buf, 0, length, offset);
    return buf.toString('utf8', 0, bytesRead);
  } catch {
    return null;
  } finally {
    if (fh) await fh.close().catch(() => undefined);
  }
}

async function extractHead(filePath: string): Promise<HeadMeta> {
  const chunk = await readBytes(filePath, 0, HEAD_READ_BYTES);
  if (!chunk) return { cwd: null, sessionId: null };
  const cwdMatch = chunk.match(CWD_REGEX);
  const idMatch = chunk.match(SESSION_ID_REGEX);
  const cwdRaw = cwdMatch?.[1];
  const idRaw = idMatch?.[1];
  return {
    cwd: cwdRaw ? cwdRaw.replace(/\\(.)/g, '$1') : null,
    sessionId: idRaw ?? null,
  };
}

interface CodexTokenInfo {
  inputTokens: number;
  cacheReadInputTokens: number;
  outputTokens: number;
  contextWindow: number;
}

/**
 * Tail-read the rollout to find the most recent `event_msg` with
 * `payload.type === 'token_count'` and a non-null `info`. The Codex CLI
 * emits these per-turn with cumulative `total_token_usage`, so the latest
 * one is the session's authoritative usage snapshot.
 */
async function extractTokensTail(
  filePath: string,
  fileSize: number,
): Promise<CodexTokenInfo | null> {
  const offset = Math.max(0, fileSize - TAIL_READ_BYTES);
  const chunk = await readBytes(filePath, offset, TAIL_READ_BYTES);
  if (!chunk) return null;

  // Discard the first (potentially truncated) line when we didn't start at 0.
  const lines = chunk.split('\n');
  const startIdx = offset === 0 ? 0 : 1;

  let latest: CodexTokenInfo | null = null;
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (!line.includes('"token_count"')) continue;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type !== 'event_msg') continue;
    const payload = event.payload as Record<string, unknown> | undefined;
    if (!payload || payload.type !== 'token_count') continue;
    const info = payload.info as Record<string, unknown> | null | undefined;
    if (!info || typeof info !== 'object') continue;
    const total =
      info.total_token_usage && typeof info.total_token_usage === 'object'
        ? (info.total_token_usage as Record<string, unknown>)
        : null;
    if (!total) continue;
    latest = {
      inputTokens: num(total.input_tokens),
      cacheReadInputTokens: num(total.cached_input_tokens),
      outputTokens: num(total.output_tokens),
      contextWindow: num(info.model_context_window),
    };
  }

  return latest;
}

interface ParsedSession {
  view: SessionMetaView;
  cwd: string | null;
}

async function parseRolloutFast(filePath: string): Promise<ParsedSession | null> {
  const stats = await safeStat(filePath);
  if (!stats) return null;

  const head = await extractHead(filePath);
  const tail = await extractTokensTail(filePath, stats.size);

  const fileBase = filePath.split('/').pop() ?? filePath;
  const sessionId =
    head.sessionId ?? fileBase.replace(/^rollout-/, '').replace(/\.jsonl$/, '');

  const metrics = emptyCacheMetrics();
  if (tail) {
    metrics.inputTokens = tail.inputTokens;
    metrics.cacheReadInputTokens = tail.cacheReadInputTokens;
    metrics.outputTokens = tail.outputTokens;
    if (tail.contextWindow > 0) metrics.contextWindow = tail.contextWindow;
    const denom = metrics.inputTokens + metrics.cacheReadInputTokens;
    metrics.cacheHitRatio = denom > 0 ? metrics.cacheReadInputTokens / denom : 0;
  }

  const fingerprintHash = sha256OfCanonicalJson({
    toolId: TOOL_ID,
    cwd: head.cwd ?? '',
  });

  return {
    cwd: head.cwd,
    view: {
      source: 'derived',
      sessionId,
      fingerprintHash,
      metrics,
      toolId: TOOL_ID,
      lastModifiedMs: stats.mtimeMs,
    },
  };
}

export const codexReader: CliSessionReader = {
  toolId: TOOL_ID,
  async scanAll(): Promise<ProjectScan[]> {
    const days = Number.isFinite(WINDOW_DAYS) && WINDOW_DAYS > 0 ? WINDOW_DAYS : 30;
    const dayDirs = recentDayPartitions(days);

    // Collect file paths first so we can fan out parsing in parallel.
    const filePaths: string[] = [];
    for (const dir of dayDirs) {
      const files = await listJsonlFiles(dir);
      for (const f of files) {
        if (f.startsWith('rollout-')) filePaths.push(join(dir, f));
      }
    }

    const parsed = (
      await Promise.all(filePaths.map((p) => parseRolloutFast(p)))
    ).filter((p): p is ParsedSession => p !== null);

    const byCwd = new Map<string, { sessions: SessionMetaView[]; lastSeenAt: number }>();
    for (const p of parsed) {
      const key = p.cwd ?? '<unknown cwd>';
      const bucket = byCwd.get(key) ?? { sessions: [], lastSeenAt: 0 };
      bucket.sessions.push(p.view);
      const mtime = p.view.lastModifiedMs ?? 0;
      if (mtime > bucket.lastSeenAt) bucket.lastSeenAt = mtime;
      byCwd.set(key, bucket);
    }

    const scans: ProjectScan[] = [];
    for (const [path, bucket] of byCwd.entries()) {
      bucket.sessions.sort(
        (a, b) => (b.lastModifiedMs ?? 0) - (a.lastModifiedMs ?? 0),
      );
      scans.push({
        id: `${TOOL_ID}:${path}`,
        toolId: TOOL_ID,
        path,
        sessions: bucket.sessions,
        lastSeenAt: bucket.lastSeenAt,
      });
    }
    return scans;
  },
};
