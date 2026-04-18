/**
 * ClassifiedLogEntry
 * Renders a session log entry with speaker badge and output type label.
 */

import { useState } from 'react';
import { entryDomId, formatAddress } from '../../lib/session/address';
import type { ClassifiedEntry } from '../../lib/sessionClassifier';
import styles from './ClassifiedLogEntry.module.css';

const SPEAKER_CLASS: Record<string, string> = {
  human: styles.speakerHuman,
  agent: styles.speakerAgent,
  'sub-agent': styles.speakerSubAgent,
  system: styles.speakerSystem,
};

const OUTPUT_CLASS: Record<string, string> = {
  'tool-call': styles.outputToolCall,
  'tool-output': styles.outputToolOutput,
  thinking: styles.outputThinking,
  answer: styles.outputAnswer,
  system: styles.outputSystem,
};

interface Props {
  entry: ClassifiedEntry;
  /**
   * 1-based position of this entry in the originating JSONL file.
   * Rendered as `#N` in the header so users can reference specific messages.
   */
  index: number;
}

export function ClassifiedLogEntry({ entry, index }: Props) {
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [toolOutputExpanded, setToolOutputExpanded] = useState(false);
  const [rawExpanded, setRawExpanded] = useState(false);

  const isSystem = entry.outputType === 'system';
  const address = formatAddress(index);
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // Clipboard API unavailable (e.g. blocked context). Silent — the user
      // can still type the address from the visible label.
    }
  };

  return (
    <div className={styles.entry} id={entryDomId(index)}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.address} title={`Entry ${address} in session log`}>
          {address}
        </span>
        <button
          type="button"
          className={styles.copyAddressBtn}
          onClick={copyAddress}
          aria-label={`Copy address ${address}`}
          title="Copy address"
        >
          ⧉
        </button>
        <span className={`${styles.speakerBadge} ${SPEAKER_CLASS[entry.speaker] || ''}`}>
          {entry.speaker}
        </span>
        <span className={`${styles.outputLabel} ${OUTPUT_CLASS[entry.outputType] || ''}`}>
          {entry.outputType}
        </span>
        {isSystem && (
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={() => setRawExpanded((v) => !v)}
            aria-label={rawExpanded ? 'Hide raw JSON' : 'Show raw JSON'}
          >
            {rawExpanded ? 'Hide raw' : 'Raw'}
          </button>
        )}
      </div>

      {/* Body */}
      <div className={styles.body}>
        {/* Thinking content */}
        {entry.thinkingContent && (
          <div>
            <div className={thinkingExpanded ? undefined : styles.collapsed}>
              <div className={styles.thinkingContent}>{entry.thinkingContent}</div>
            </div>
            <button
              type="button"
              className={styles.toggleBtn}
              onClick={() => setThinkingExpanded((v) => !v)}
            >
              {thinkingExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        )}

        {/* Text answer */}
        {entry.textContent && entry.outputType !== 'system' && (
          <div className={styles.textContent}>{entry.textContent}</div>
        )}

        {/* Tool calls */}
        {entry.toolCalls?.map((tc) => (
          <div
            key={tc.id}
            className={styles.toolCall}
            id={entryDomId(index, tc.blockIndex)}
          >
            <div className={styles.toolName}>
              <span className={styles.subAddress}>
                {formatAddress(index, tc.blockIndex)}
              </span>
              {tc.name}
            </div>
            <pre className={styles.toolInput}>{formatToolInput(tc.input)}</pre>
          </div>
        ))}

        {/* Tool results */}
        {entry.toolResults && entry.toolResults.length > 0 && (
          <div>
            {toolOutputExpanded ? (
              entry.toolResults.map((tr) => (
                <div
                  key={tr.toolUseId}
                  className={styles.toolResult}
                  id={entryDomId(index, tr.blockIndex)}
                >
                  <div className={styles.toolResultId}>
                    <span className={styles.subAddress}>
                      {formatAddress(index, tr.blockIndex)}
                    </span>
                    tool_use: {tr.toolUseId.substring(0, 12)}
                  </div>
                  <pre className={styles.toolResultContent}>{tr.content.substring(0, 1000)}</pre>
                </div>
              ))
            ) : (
              <div className={styles.toolResultId}>{entry.toolResults.length} tool result(s)</div>
            )}
            <button
              type="button"
              className={styles.toggleBtn}
              onClick={() => setToolOutputExpanded((v) => !v)}
            >
              {toolOutputExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        )}

        {/* System content */}
        {entry.outputType === 'system' && entry.textContent && (
          <div className={styles.systemContent}>{entry.textContent}</div>
        )}

        {/* Hook summary (structured detail) */}
        {entry.hookSummary && <HookSummaryBlock summary={entry.hookSummary} />}

        {/* Raw JSON (system entries, opt-in) */}
        {isSystem && rawExpanded && (
          <pre className={styles.rawJson}>{JSON.stringify(entry.rawEntry, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}

/**
 * Show each hook's command, duration, and any error/block signal. The
 * command string is often a long shell invocation with env-var interpolation;
 * we show it mono but wrapped.
 */
function HookSummaryBlock({ summary }: { summary: NonNullable<ClassifiedEntry['hookSummary']> }) {
  const { hooks, errors, preventedContinuation, stopReason, totalDurationMs, phase } = summary;
  return (
    <div className={styles.hookBlock}>
      <div className={styles.hookHeader}>
        <span className={styles.hookPhase}>{phase}</span>
        <span className={styles.hookMeta}>
          {hooks.length} hook{hooks.length === 1 ? '' : 's'} · {totalDurationMs}ms
        </span>
        {preventedContinuation && <span className={styles.hookBlocked}>BLOCKED</span>}
      </div>
      {hooks.length > 0 && (
        <ul className={styles.hookList}>
          {hooks.map((h, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: stable within a single entry
              key={i}
              className={`${styles.hookItem} ${h.error ? styles.hookItemError : ''}`}
            >
              <span className={styles.hookDuration}>{h.durationMs}ms</span>
              <code className={styles.hookCommand}>{h.command}</code>
              {h.error && <span className={styles.hookError}>{h.error}</span>}
            </li>
          ))}
        </ul>
      )}
      {errors.length > 0 && (
        <ul className={styles.hookErrorList}>
          {errors.map((e, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable within a single entry
            <li key={i} className={styles.hookError}>
              {e}
            </li>
          ))}
        </ul>
      )}
      {stopReason && <div className={styles.hookStopReason}>stop reason: {stopReason}</div>}
    </div>
  );
}

function formatToolInput(input: Record<string, unknown>): string {
  const entries = Object.entries(input);
  if (entries.length === 0) return '{}';
  // Show abbreviated form for readability
  const lines = entries.map(([k, v]) => {
    const val =
      typeof v === 'string'
        ? v.length > 120
          ? `"${v.substring(0, 120)}..."`
          : `"${v}"`
        : JSON.stringify(v);
    return `${k}: ${val}`;
  });
  return lines.join('\n');
}
