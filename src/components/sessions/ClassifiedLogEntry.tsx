/**
 * ClassifiedLogEntry
 * Renders a session log entry with speaker badge and output type label.
 */

import { useState } from 'react';
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
}

export function ClassifiedLogEntry({ entry }: Props) {
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [toolOutputExpanded, setToolOutputExpanded] = useState(false);

  return (
    <div className={styles.entry}>
      {/* Header */}
      <div className={styles.header}>
        <span className={`${styles.speakerBadge} ${SPEAKER_CLASS[entry.speaker] || ''}`}>
          {entry.speaker}
        </span>
        <span className={`${styles.outputLabel} ${OUTPUT_CLASS[entry.outputType] || ''}`}>
          {entry.outputType}
        </span>
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
          <div key={tc.id} className={styles.toolCall}>
            <div className={styles.toolName}>{tc.name}</div>
            <pre className={styles.toolInput}>{formatToolInput(tc.input)}</pre>
          </div>
        ))}

        {/* Tool results */}
        {entry.toolResults && entry.toolResults.length > 0 && (
          <div>
            {toolOutputExpanded ? (
              entry.toolResults.map((tr) => (
                <div key={tr.toolUseId} className={styles.toolResult}>
                  <div className={styles.toolResultId}>
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
      </div>
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
