/**
 * SessionAnalyticsService - analyze a CLI session's JSONL log on the fly.
 *
 * Use case: most sessions in ~/.claude/projects were NOT driven by this app,
 * so they have no sidecar (SessionMeta). We still want prefix-quality insights
 * for them. This service reads the raw JSONL, accumulates observable signals,
 * and produces a DerivedSessionMeta that plays the same role as a sidecar in
 * the Sessions UI.
 *
 * Observable signals in the internal JSONL format (distinct from stream-json):
 *   - assistant.message.model + assistant.message.usage.*  -> model + cache metrics
 *   - attachment.deferred_tools_delta.addedNames           -> tool set
 *   - attachment.deferred_tools_delta.removedNames         -> tool set decrement
 *   - top-level `cwd` on most events                       -> projectPath
 *
 * No system/init event is written to the internal JSONL, which is why we
 * track a hand-assembled grouping key instead of a full observed fingerprint.
 */

import fs from 'node:fs';
import path from 'node:path';
import { emptyCacheMetrics, updateCacheMetrics } from '../lib/cacheMetrics';
import { sha256OfCanonicalJson } from '../lib/prefixHashing';
import { extractCwd, extractModel, extractToolDelta } from '../lib/session/events';
import type { DerivedSessionMeta } from '../types/prefix-fingerprint';
import type { StreamEvent } from '../types/stream-events';
import { errorReporter } from './errorReporter';

export interface AnalyticsProgress {
  phase: 'deriving' | 'done';
  current: number;
  total: number;
  /** Files served from cache; no JSONL parse. */
  cached: number;
  /** Files explicitly skipped (e.g. covered by a sidecar). */
  skipped: number;
  message?: string;
}

export type AnalyticsProgressCallback = (p: AnalyticsProgress) => void;

/** Keep the cache bounded on very large machines. Oldest entries evicted first. */
const CACHE_MAX_ENTRIES = 10_000;

/**
 * Line-oriented JSON reader. Ignores empty lines and parse failures so a
 * partial tail or a mid-write event never fails the whole session.
 */
function* readJsonlLines(filePath: string): Generator<Record<string, unknown>> {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        yield parsed as Record<string, unknown>;
      }
    } catch {
      // skip malformed lines
    }
  }
}

interface CacheEntry {
  /** Composite key: mtime + size. Changes invalidate the entry. */
  signature: string;
  meta: DerivedSessionMeta;
}

export class SessionAnalyticsService {
  /** Keyed by absolute file path. Value carries its own signature. */
  private cache = new Map<string, CacheEntry>();

  /**
   * Compute a derived meta by streaming a session's JSONL file. Cached on
   * (filePath, mtimeMs, size): if the file has not changed, the parse is
   * skipped and the previous result is returned.
   */
  analyzeSessionFile(filePath: string, sessionId: string, toolId = 'claude'): DerivedSessionMeta {
    const stat = this.safeStat(filePath);
    const signature = stat ? `${stat.mtimeMs}:${stat.size}` : '';
    if (stat) {
      const hit = this.cache.get(filePath);
      if (hit && hit.signature === signature) {
        return hit.meta;
      }
    }
    const meta = this.computeFresh(filePath, sessionId, toolId);
    if (stat) {
      this.cache.set(filePath, { signature, meta });
      this.evictIfOversize();
    }
    return meta;
  }

  /**
   * Batch-analyze every `.jsonl` in a project directory, with progress.
   * Returns a map keyed by sessionId. `skipSessionIds` lets callers exclude
   * ids already covered by a higher-fidelity source (e.g. sidecar).
   */
  analyzeProjectDir(
    claudeProjectDir: string,
    options: {
      skipSessionIds?: ReadonlySet<string>;
      onProgress?: AnalyticsProgressCallback;
    } = {},
  ): Map<string, DerivedSessionMeta> {
    const { skipSessionIds, onProgress } = options;
    const result = new Map<string, DerivedSessionMeta>();

    let entries: string[];
    try {
      entries = fs.readdirSync(claudeProjectDir);
    } catch {
      onProgress?.({ phase: 'done', current: 0, total: 0, cached: 0, skipped: 0 });
      return result;
    }

    const files = entries.filter((e) => e.endsWith('.jsonl'));
    const total = files.length;
    let current = 0;
    let cached = 0;
    let skipped = 0;

    for (const entry of files) {
      current++;
      const sessionId = entry.slice(0, -'.jsonl'.length);

      if (skipSessionIds?.has(sessionId)) {
        skipped++;
        this.maybeEmitProgress(onProgress, { current, total, cached, skipped });
        continue;
      }

      const filePath = path.join(claudeProjectDir, entry);
      const stat = this.safeStat(filePath);
      const signature = stat ? `${stat.mtimeMs}:${stat.size}` : '';
      const hit = stat ? this.cache.get(filePath) : undefined;
      if (hit && hit.signature === signature) {
        result.set(sessionId, hit.meta);
        cached++;
      } else {
        try {
          const derived = this.computeFresh(filePath, sessionId);
          result.set(sessionId, derived);
          if (stat) {
            this.cache.set(filePath, { signature, meta: derived });
          }
        } catch (err) {
          console.warn(`[SessionAnalyticsService] failed ${filePath}:`, err);
          errorReporter.report('sessionAnalytics.computeFresh', err);
        }
      }

      this.maybeEmitProgress(onProgress, { current, total, cached, skipped });
    }

    this.evictIfOversize();

    onProgress?.({
      phase: 'done',
      current: total,
      total,
      cached,
      skipped,
      message: `Derived ${total - cached - skipped} new, ${cached} cached, ${skipped} skipped`,
    });
    return result;
  }

  /** For tests / maintenance. */
  clearCache(): void {
    this.cache.clear();
  }

  /** Current cache entry count. Exposed for tests. */
  get cacheSize(): number {
    return this.cache.size;
  }

  private maybeEmitProgress(
    onProgress: AnalyticsProgressCallback | undefined,
    state: { current: number; total: number; cached: number; skipped: number },
  ): void {
    if (!onProgress) return;
    // Throttle: every 5 files or on the last one.
    if (state.current % 5 !== 0 && state.current !== state.total) return;
    onProgress({
      phase: 'deriving',
      ...state,
      message: `Analyzing sessions... ${state.current}/${state.total}`,
    });
  }

  private safeStat(filePath: string): fs.Stats | null {
    try {
      return fs.statSync(filePath);
    } catch {
      return null;
    }
  }

  private evictIfOversize(): void {
    while (this.cache.size > CACHE_MAX_ENTRIES) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey === undefined) break;
      this.cache.delete(firstKey);
    }
  }

  private computeFresh(filePath: string, sessionId: string, toolId = 'claude'): DerivedSessionMeta {
    const tools = new Set<string>();
    let model: string | null = null;
    let projectPath: string | null = null;
    let eventCount = 0;
    const metrics = emptyCacheMetrics();

    for (const event of readJsonlLines(filePath)) {
      eventCount++;

      if (!projectPath) {
        projectPath = extractCwd(event);
      }
      if (!model) {
        const m = extractModel(event);
        if (m) model = m;
      }

      const delta = extractToolDelta(event);
      if (delta) {
        for (const name of delta.added) tools.add(name);
        for (const name of delta.removed) tools.delete(name);
      }

      // The existing cache-metrics reducer is shape-compatible: assistant
      // events in JSONL have the same `message.usage` structure as stream-json
      // assistant events. Other event types are no-ops under the reducer.
      updateCacheMetrics(metrics, event as StreamEvent);
    }

    const sortedTools = [...tools].sort();
    const fingerprintHash = sha256OfCanonicalJson({
      model: model ?? '',
      tools: sortedTools,
    });

    return {
      schemaVersion: 1,
      source: 'derived',
      sessionId,
      toolId,
      projectPath,
      fingerprintHash,
      details: { model, tools: sortedTools, eventCount },
      metrics,
      computedAt: Date.now(),
    };
  }
}

export const sessionAnalyticsService = new SessionAnalyticsService();
