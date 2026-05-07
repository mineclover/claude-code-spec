/**
 * Gemini session reader. Walks `~/.gemini/tmp/<id>/chats/session-*.json`,
 * resolving the project cwd via `~/.gemini/projects.json` (a path → name map)
 * by hashing each known path with sha256 and matching the directory name.
 *
 * Gemini's session JSON does not record token usage, so the cache gauge will
 * render as zero for these sessions. The reader still surfaces sessionId,
 * project, message count (turns), and last-modified timestamp.
 */

import { emptyCacheMetrics } from '../../cacheMetrics';
import type { SessionMetaView } from '../../types/prefix-fingerprint';
import { sha256Hex, sha256OfCanonicalJson } from '../../prefixHashing';
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CliSessionReader, ProjectScan } from './types';

const TOOL_ID = 'gemini' as const;
const TMP_ROOT = join(homedir(), '.gemini', 'tmp');
const PROJECTS_JSON = join(homedir(), '.gemini', 'projects.json');

async function safeStat(path: string): Promise<{ mtimeMs: number } | null> {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Build a `dirName → cwd` map. The `~/.gemini/projects.json` file stores
 * `{ "/path/to/project": "label", ... }`; tmp dirs are named either with
 * sha256(path) or with the bare label, so we index both.
 */
async function loadProjectMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let raw: string;
  try {
    raw = await readFile(PROJECTS_JSON, 'utf8');
  } catch {
    return map;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return map;
  }

  if (!parsed || typeof parsed !== 'object') return map;
  const projects =
    'projects' in (parsed as object) &&
    typeof (parsed as Record<string, unknown>).projects === 'object'
      ? ((parsed as Record<string, unknown>).projects as Record<string, unknown>)
      : (parsed as Record<string, unknown>);

  for (const [cwd, label] of Object.entries(projects)) {
    if (typeof cwd !== 'string') continue;
    map.set(sha256Hex(cwd), cwd);
    if (typeof label === 'string' && label) {
      map.set(label, cwd);
    }
  }
  return map;
}

interface GeminiTokenSnapshot {
  input?: number;
  output?: number;
  cached?: number;
  thoughts?: number;
  tool?: number;
  total?: number;
}

interface GeminiMessage {
  type?: string;
  model?: string;
  tokens?: GeminiTokenSnapshot;
}

interface GeminiSessionJson {
  sessionId?: string;
  startTime?: string;
  lastUpdated?: string;
  messages?: GeminiMessage[];
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function parseGeminiSession(
  dirName: string,
  cwd: string,
  fileName: string,
): Promise<SessionMetaView | null> {
  const filePath = join(TMP_ROOT, dirName, 'chats', fileName);
  const stats = await safeStat(filePath);
  if (!stats) return null;

  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    return null;
  }

  let parsed: GeminiSessionJson;
  try {
    parsed = JSON.parse(raw) as GeminiSessionJson;
  } catch {
    return null;
  }

  const sessionId = parsed.sessionId ?? fileName.replace(/\.json$/, '');
  const messages = Array.isArray(parsed.messages) ? parsed.messages : [];

  // Token usage lives on assistant turns (`type: 'gemini'`) as a per-turn
  // snapshot of `{input, output, cached, thoughts, tool, total}`. Each
  // snapshot represents what was billed for that single API call, so summing
  // across turns matches the same "tokens billed across the session" the
  // Claude reader computes off the running CacheMetrics reducer.
  const metrics = emptyCacheMetrics();
  let model: string | undefined;
  let assistantTurns = 0;
  for (const m of messages) {
    if (m && m.type === 'gemini' && m.tokens) {
      assistantTurns += 1;
      metrics.inputTokens += num(m.tokens.input);
      metrics.outputTokens += num(m.tokens.output);
      metrics.cacheReadInputTokens += num(m.tokens.cached);
      if (!model && typeof m.model === 'string' && m.model) model = m.model;
    }
  }

  const denom = metrics.inputTokens + metrics.cacheReadInputTokens;
  metrics.cacheHitRatio = denom > 0 ? metrics.cacheReadInputTokens / denom : 0;
  metrics.turns = assistantTurns || messages.length;

  const fingerprintHash = sha256OfCanonicalJson({
    toolId: TOOL_ID,
    cwd,
    model: model ?? '',
  });

  return {
    source: 'derived',
    sessionId,
    fingerprintHash,
    metrics,
    model: model ?? 'gemini',
    toolId: TOOL_ID,
    lastModifiedMs: stats.mtimeMs,
  };
}

/**
 * Load the raw JSON document for one Gemini session. Gemini stores
 * each session as a single JSON file under
 * `~/.gemini/tmp/<projectHash>/chats/session-*.json`. The internal
 * `sessionId` field on the JSON is the canonical id; the filename
 * contains a partial id and a timestamp prefix.
 *
 * Strategy: hash the supplied `cwd` to find the matching tmp dir
 * (avoiding a global scan), list its `chats/` files, and search by
 * filename hint first. If none match, parse each file's `sessionId`
 * field. Falls back to scanning every tmp dir when cwd doesn't map.
 */
export async function readGeminiSessionRaw(
  sourceSessionId: string,
  cwd: string,
): Promise<string | null> {
  // Search a single tmp dir's chats for a file whose internal
  // sessionId matches. Returns the raw JSON string when found.
  const searchDir = async (dirName: string): Promise<string | null> => {
    const chatsDir = join(TMP_ROOT, dirName, 'chats');
    const files = await listJsonFiles(chatsDir);
    if (files.length === 0) return null;

    // Filename heuristic: Gemini files end in `-<8-hex>.json`. The
    // internal sessionId is a UUID — its tail commonly correlates
    // with that suffix, so we try those first to avoid parsing every
    // file in the directory.
    const tail = sourceSessionId.split('-').pop() ?? '';
    const ranked = [...files].sort((a, b) => {
      const aHit = tail && a.includes(tail) ? 1 : 0;
      const bHit = tail && b.includes(tail) ? 1 : 0;
      return bHit - aHit;
    });

    for (const f of ranked) {
      const fp = join(chatsDir, f);
      try {
        const raw = await readFile(fp, 'utf8');
        // Cheap pre-check before JSON.parse — only parse files
        // that mention the id at all.
        if (!raw.includes(sourceSessionId)) continue;
        let parsed: { sessionId?: string };
        try {
          parsed = JSON.parse(raw) as { sessionId?: string };
        } catch {
          continue;
        }
        if (parsed.sessionId === sourceSessionId) return raw;
      } catch {
        continue;
      }
    }
    return null;
  };

  // 1) Direct cwd → tmp dir lookup via sha256.
  const direct = sha256Hex(cwd);
  const directHit = await searchDir(direct);
  if (directHit) return directHit;

  // 2) Try the projects.json label form (some installs name tmp dirs
  // by the project label rather than the hash).
  const projectMap = await loadProjectMap();
  for (const [dirName, knownCwd] of projectMap.entries()) {
    if (knownCwd === cwd) {
      const hit = await searchDir(dirName);
      if (hit) return hit;
    }
  }

  // 3) Last resort: scan every tmp dir. Safe but slow on large installs.
  const tmpDirs = await listDirs(TMP_ROOT);
  for (const dirName of tmpDirs) {
    const hit = await searchDir(dirName);
    if (hit) return hit;
  }
  return null;
}

export const geminiReader: CliSessionReader = {
  toolId: TOOL_ID,
  async scanAll(): Promise<ProjectScan[]> {
    const projectMap = await loadProjectMap();
    const tmpDirs = await listDirs(TMP_ROOT);
    const scans: ProjectScan[] = [];

    for (const dirName of tmpDirs) {
      const chatsDir = join(TMP_ROOT, dirName, 'chats');
      const files = await listJsonFiles(chatsDir);
      if (files.length === 0) continue;

      const cwd = projectMap.get(dirName) ?? dirName;
      const sessions: SessionMetaView[] = [];
      let lastSeenAt = 0;
      for (const file of files) {
        const view = await parseGeminiSession(dirName, cwd, file);
        if (!view) continue;
        sessions.push(view);
        const mtime = view.lastModifiedMs ?? 0;
        if (mtime > lastSeenAt) lastSeenAt = mtime;
      }
      if (sessions.length === 0) continue;

      sessions.sort((a, b) => (b.lastModifiedMs ?? 0) - (a.lastModifiedMs ?? 0));
      scans.push({
        id: `${TOOL_ID}:${dirName}`,
        toolId: TOOL_ID,
        path: cwd,
        sessions,
        lastSeenAt,
      });
    }

    return scans;
  },
};
