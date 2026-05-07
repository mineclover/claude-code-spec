import type { SummaryResult } from '@context-action/session-core';
import { useTranslation } from 'react-i18next';

interface Props {
  summary: SummaryResult | null;
  loading: boolean;
  error: string | null;
  /** Coarse phase of the in-flight fork (e.g. 'system-init'). */
  progressPhase?: string | null;
  /** Operator-facing one-liner for the current phase. */
  progressMessage?: string | null;
  /** Accumulated streaming text from the model's in-flight turn. */
  streamingText?: string;
  onCopyPrompt: (prompt: string) => void;
}


function fmtPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * Renders the structured `SummaryResult` returned by a branch evaluation.
 * Splits the model narrative (oneLiner, narrative, decisions…) from the
 * host-supplied cacheInvariants so the operator sees both the answer and
 * the proof that the fork preserved cache.
 */
export function SummaryPanel({
  summary,
  loading,
  error,
  progressPhase,
  progressMessage,
  streamingText,
  onCopyPrompt,
}: Props) {
  const { t } = useTranslation();
  if (loading) {
    const label = progressPhase
      ? t(`branch.phases.${progressPhase}`, { defaultValue: progressPhase })
      : (progressMessage ?? t('summary.running'));
    return (
      <div className="summary-panel">
        <header className="summary-header">
          <h3 className="summary-title dim mono">{label}</h3>
          {progressMessage && progressPhase !== 'assistant-streaming' && (
            <span className="dim mono">{progressMessage}</span>
          )}
        </header>
        {streamingText && (
          <pre className="summary-streaming">{streamingText}</pre>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="summary-panel">
        <h3 className="pane-subhead">{t('branch.failed')}</h3>
        <pre className="summary-error">{error}</pre>
      </div>
    );
  }

  if (!summary) return null;

  const ci = summary.cacheInvariants;

  return (
    <div className="summary-panel">
      <header className="summary-header">
        <h3 className="summary-title">{summary.oneLiner}</h3>
        {ci && (
          <span
            className={`pill cache ${
              ci.prefixPreservedRatio >= 0.5
                ? 'good'
                : ci.prefixPreservedRatio > 0
                  ? 'warn'
                  : 'bad'
            }`}
            title={`fork ${ci.forkSessionId.slice(0, 8)}… · cache_read=${ci.cacheReadTokens} · cache_creation=${ci.cacheCreationTokens} · input=${ci.inputTokens}`}
          >
            {t('summary.prefixPreserved')} {fmtPct(ci.prefixPreservedRatio)}
          </span>
        )}
      </header>

      <p className="summary-narrative">{summary.narrative}</p>

      {ci && (
        <dl className="summary-invariants">
          <div className="kv-row">
            <dt>{t('fields.cacheRead')}</dt>
            <dd>{fmtTokens(ci.cacheReadTokens)}</dd>
          </div>
          <div className="kv-row">
            <dt>{t('fields.cacheCreation')}</dt>
            <dd>{fmtTokens(ci.cacheCreationTokens)}</dd>
          </div>
          <div className="kv-row">
            <dt>{t('fields.inputUncached')}</dt>
            <dd>{fmtTokens(ci.inputTokens)}</dd>
          </div>
          {ci.costUsd != null && (
            <div className="kv-row">
              <dt>{t('fields.forkCost')}</dt>
              <dd>${ci.costUsd.toFixed(4)}</dd>
            </div>
          )}
        </dl>
      )}

      {summary.keyDecisions.length > 0 && (
        <section className="summary-section">
          <h4 className="pane-subhead">{t('fields.keyDecisions')}</h4>
          <ul className="summary-list">
            {summary.keyDecisions.map((d, i) => (
              <li key={i} className={`summary-item status-${d.status ?? 'open'}`}>
                <div className="summary-item-title">{d.title}</div>
                {d.rationale && (
                  <div className="summary-item-body">{d.rationale}</div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary.references.length > 0 && (
        <section className="summary-section">
          <h4 className="pane-subhead">{t('fields.references')}</h4>
          <ul className="summary-list">
            {summary.references.map((r, i) => (
              <li key={i} className="summary-item">
                <div className="summary-item-title mono">
                  {r.kind && <span className="ref-kind">{r.kind}</span>}
                  {r.target}
                </div>
                {r.note && <div className="summary-item-body">{r.note}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary.openItems.length > 0 && (
        <section className="summary-section">
          <h4 className="pane-subhead">{t('fields.openItems')}</h4>
          <ul className="summary-list">
            {summary.openItems.map((o, i) => (
              <li key={i} className="summary-item">
                <div className="summary-item-title">{o.question}</div>
                {o.anchor && (
                  <div className="summary-item-body mono dim">{o.anchor}</div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary.nextActions.length > 0 && (
        <section className="summary-section">
          <h4 className="pane-subhead">{t('fields.nextActions')}</h4>
          <ul className="summary-list">
            {summary.nextActions.map((n, i) => (
              <li key={i} className="summary-item next-action">
                <div className="summary-item-title">{n.label ?? 'prompt'}</div>
                <pre className="summary-item-body next-prompt">{n.prompt}</pre>
                <button
                  type="button"
                  className="copy-button"
                  onClick={() => onCopyPrompt(n.prompt)}
                >
                  {t('summary.copy')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="summary-footer dim mono">
        {t('fields.generated')} {new Date(summary.generatedAt).toLocaleString()}
      </footer>
    </div>
  );
}
