import type { SessionMetaView } from '@context-action/session-core';

interface Props {
  session: SessionMetaView;
}

function fmtMs(ms: number | undefined): string {
  if (!ms || ms <= 0) return '—';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmtUsd(v: number | undefined): string {
  if (v == null) return '—';
  return `$${v.toFixed(3)}`;
}

export function SessionDetail({ session }: Props) {
  const m = session.metrics;
  return (
    <dl className="kv-table">
      <div className="kv-row">
        <dt>session_id</dt>
        <dd>{session.sessionId}</dd>
      </div>
      <div className="kv-row">
        <dt>fingerprint</dt>
        <dd className="mono dim">{session.fingerprintHash || '—'}</dd>
      </div>
      <div className="kv-row">
        <dt>source</dt>
        <dd>{session.source}</dd>
      </div>
      <div className="kv-row">
        <dt>turns</dt>
        <dd>{m.turns ?? '—'}</dd>
      </div>
      <div className="kv-row">
        <dt>duration</dt>
        <dd>{fmtMs(m.durationMs)}</dd>
      </div>
      <div className="kv-row">
        <dt>output_tokens</dt>
        <dd>{m.outputTokens.toLocaleString('en-US')}</dd>
      </div>
      <div className="kv-row">
        <dt>cost</dt>
        <dd>{fmtUsd(m.costUsd)}</dd>
      </div>
    </dl>
  );
}
