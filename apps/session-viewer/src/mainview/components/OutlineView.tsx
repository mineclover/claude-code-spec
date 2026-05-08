/**
 * Outline view — displays a session's structured decomposition.
 *
 * Layout: a header showing tool/session/cwd metadata, an "Annotate"
 * button that triggers the iterative annotator (claude-only at v1),
 * a live progress strip, and a vertical list of segments. Each
 * segment is a collapsible block headed by the user-instruction that
 * opens it; inside, every step renders as a row with its kind, tool
 * (when applicable), excerpt, and the annotator-supplied description
 * tag (when present).
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  SessionOutline,
  SessionStep,
} from '@context-action/session-core/outline';

interface OutlineViewProps {
  outline: SessionOutline | null;
  loading: boolean;
  error: string | null;
  /** Whether the active session can be annotated (claude only at v1). */
  canAnnotate: boolean;
  annotating: boolean;
  /** Annotator progress, or null when not running. */
  progress?: {
    phase: string;
    message?: string;
    elapsedMs: number;
  } | null;
  onAnnotate: () => void;
  onDelete?: () => void;
}

const KIND_LABEL: Record<SessionStep['kind'], string> = {
  meta: 'meta',
  'user-instruction': 'user',
  thinking: 'thinking',
  'tool-call': 'tool-call',
  'tool-result': 'tool-result',
  'assistant-text': 'assistant',
};

const KIND_ICON: Record<SessionStep['kind'], string> = {
  meta: '·',
  'user-instruction': '▶',
  thinking: '✦',
  'tool-call': '▼',
  'tool-result': '◀',
  'assistant-text': '✓',
};

/**
 * Color hint per kind. Driven by data attribute so themable through CSS.
 */
function stepClassFor(kind: SessionStep['kind']): string {
  return `outline-step kind-${kind}`;
}

export function OutlineView({
  outline,
  loading,
  error,
  canAnnotate,
  annotating,
  progress,
  onAnnotate,
  onDelete,
}: OutlineViewProps) {
  const { t } = useTranslation();
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(
    () => new Set([0, 1]),
  );

  const stats = useMemo(() => {
    if (!outline) return null;
    const total = outline.steps.length;
    const tagged = outline.steps.filter((s) => !!s.description).length;
    const tally: Record<string, number> = {};
    for (const s of outline.steps) tally[s.kind] = (tally[s.kind] ?? 0) + 1;
    return { total, tagged, tally, segments: outline.segments.length };
  }, [outline]);

  if (loading) {
    return (
      <div className="outline-empty">
        <p>{t('outline.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="outline-empty error">
        <p>{error}</p>
      </div>
    );
  }

  if (!outline) {
    return (
      <div className="outline-empty">
        <p>{t('outline.noOutline')}</p>
      </div>
    );
  }

  const toggleSegment = (idx: number) => {
    setExpandedSegments((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSegments(
      new Set(outline.segments.map((_, i) => i)),
    );
  };
  const collapseAll = () => setExpandedSegments(new Set());

  return (
    <div className="outline-view">
      <header className="outline-header">
        <div className="outline-meta">
          <span className="outline-tool">{outline.toolId}</span>
          <span className="outline-id mono">
            {outline.sourceSessionId.slice(0, 12)}…
          </span>
          {outline.model && (
            <span className="outline-model dim">{outline.model}</span>
          )}
          {stats && (
            <span className="outline-stats dim">
              {stats.tagged}/{stats.total} {t('outline.tagged')} ·{' '}
              {stats.segments} {t('outline.segments')}
            </span>
          )}
        </div>
        <div className="outline-actions">
          <button
            type="button"
            className="outline-button secondary"
            onClick={expandAll}
            title={t('outline.expandAll')}
          >
            ⤢
          </button>
          <button
            type="button"
            className="outline-button secondary"
            onClick={collapseAll}
            title={t('outline.collapseAll')}
          >
            ⤡
          </button>
          {onDelete && outline.annotation && (
            <button
              type="button"
              className="outline-button secondary"
              onClick={onDelete}
              title={t('outline.delete')}
            >
              {t('outline.deleteShort')}
            </button>
          )}
          <button
            type="button"
            className="outline-button"
            onClick={onAnnotate}
            disabled={!canAnnotate || annotating}
            title={
              canAnnotate
                ? t('outline.annotateTooltip')
                : t('outline.annotateUnsupported')
            }
          >
            {annotating ? t('outline.annotating') : t('outline.annotate')}
          </button>
        </div>
      </header>

      {progress && (
        <div className="outline-progress">
          <span className="phase">{progress.phase}</span>
          {progress.message && (
            <span className="message dim">{progress.message}</span>
          )}
          <span className="elapsed dim mono">
            {Math.round(progress.elapsedMs / 100) / 10}s
          </span>
        </div>
      )}

      {stats && (
        <div className="outline-tally dim">
          {Object.entries(stats.tally)
            .map(([k, n]) => `${k}=${n}`)
            .join(' · ')}
        </div>
      )}

      <ol className="outline-segments">
        {outline.segments.map((seg, idx) => {
          const isOpening = seg.openedByStep === null;
          const isExpanded = expandedSegments.has(idx);
          const headLabel = isOpening
            ? t('outline.openingSegment')
            : seg.userInstructionExcerpt ||
              t('outline.unnamedSegment');
          return (
            <li key={idx} className="outline-segment">
              <button
                type="button"
                className="segment-header"
                onClick={() => toggleSegment(idx)}
              >
                <span className="segment-toggle mono">
                  {isExpanded ? '▾' : '▸'}
                </span>
                <span className="segment-index dim mono">
                  #{idx}
                </span>
                <span className="segment-title">{headLabel}</span>
                <span className="segment-count dim">
                  {seg.steps.length} {t('outline.stepsShort')}
                </span>
              </button>
              {isExpanded && (
                <ul className="outline-step-list">
                  {seg.steps.length === 0 ? (
                    <li className="outline-step empty">
                      <span className="dim">{t('outline.emptySegment')}</span>
                    </li>
                  ) : (
                    seg.steps.map((step) => (
                      <li
                        key={step.index}
                        className={stepClassFor(step.kind)}
                      >
                        <span className="step-icon mono">
                          {KIND_ICON[step.kind]}
                        </span>
                        <span className="step-index dim mono">
                          #{step.index}
                        </span>
                        <span className="step-kind">
                          {KIND_LABEL[step.kind]}
                          {step.toolName ? `:${step.toolName}` : ''}
                        </span>
                        <span className="step-excerpt mono">
                          {step.excerpt}
                        </span>
                        {step.description && (
                          <span className="step-description">
                            {step.description}
                          </span>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
