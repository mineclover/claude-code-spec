import type React from 'react';
import type { ResultEvent as ResultEventType } from '../../../lib/types';
import { EventBox } from '../common/EventBox';
import { TokenUsage } from '../common/TokenUsage';
import styles from './ResultEvent.module.css';

interface ResultEventProps {
  event: ResultEventType;
}

export const ResultEvent: React.FC<ResultEventProps> = ({ event }) => {
  return (
    <EventBox
      type="result"
      icon="✅"
      title={`Result: ${event.subtype}`}
      rawData={event}
      isSidechain={event.isSidechain}
    >
      {event.result && <div className={styles.resultText}>{event.result}</div>}

      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Duration:</span>
          <span className={styles.statValue}>{event.duration_ms}ms</span>
          <span className={styles.statMuted}>(API: {event.duration_api_ms}ms)</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Turns:</span>
          <span className={styles.statValue}>{event.num_turns}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Cost:</span>
          <span className={styles.statValue}>${event.total_cost_usd.toFixed(6)}</span>
        </div>
      </div>

      <TokenUsage
        inputTokens={event.usage.input_tokens}
        outputTokens={event.usage.output_tokens}
        cacheReadTokens={event.usage.cache_read_input_tokens}
        cacheCreationTokens={event.usage.cache_creation_input_tokens}
      />
    </EventBox>
  );
};
