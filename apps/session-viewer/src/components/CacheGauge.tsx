import type { CacheMetrics } from '@context-action/session-core';

interface Props {
  metrics: CacheMetrics;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Visualizes the three cache categories on a single horizontal bar:
 *   cache_read  | cache_creation | input (uncached)
 * Width proportional to token contribution. Hit ratio = read / (read + input).
 */
export function CacheGauge({ metrics }: Props) {
  const read = metrics.cacheReadInputTokens;
  const create = metrics.cacheCreationInputTokens;
  const fresh = Math.max(0, metrics.inputTokens - create); // input not part of cache writes
  const total = read + create + fresh;

  const pct = (n: number): string => (total > 0 ? `${(n / total) * 100}%` : '0%');
  const ratioPct = `${(metrics.cacheHitRatio * 100).toFixed(1)}%`;

  return (
    <div className="cache-gauge">
      <div className="gauge-meta">
        <div className="meta-cell">
          <div className="meta-lbl">cache_read</div>
          <div className="meta-val good">{fmt(read)}</div>
        </div>
        <div className="meta-cell">
          <div className="meta-lbl">cache_creation</div>
          <div className="meta-val">{fmt(create)}</div>
        </div>
        <div className="meta-cell">
          <div className="meta-lbl">input (uncached)</div>
          <div className="meta-val warn">{fmt(fresh)}</div>
        </div>
        <div className="meta-cell">
          <div className="meta-lbl">hit ratio</div>
          <div className="meta-val accent">{ratioPct}</div>
        </div>
      </div>

      <div className="gauge-bar" role="img" aria-label={`cache hit ratio ${ratioPct}`}>
        <div
          className="seg seg-read"
          style={{ width: pct(read) }}
          title={`cache_read · ${fmt(read)}`}
        />
        <div
          className="seg seg-create"
          style={{ width: pct(create) }}
          title={`cache_creation · ${fmt(create)}`}
        />
        <div
          className="seg seg-fresh"
          style={{ width: pct(fresh) }}
          title={`input · ${fmt(fresh)}`}
        />
      </div>
    </div>
  );
}
