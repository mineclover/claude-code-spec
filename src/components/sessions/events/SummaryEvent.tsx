import type React from 'react';
import type { ClaudeSessionEntry } from '../../../preload';
import { EventBox } from '../../stream/common/EventBox';
import styles from './SummaryEvent.module.css';

interface SummaryEventProps {
  event: ClaudeSessionEntry;
}

export const SummaryEvent: React.FC<SummaryEventProps> = ({ event }) => {
  return (
    <EventBox type="system" icon="📋" title="Session Summary" rawData={event}>
      <div className={styles.content}>
        {event.summary}
      </div>
      {event.leafUuid && (
        <div className={styles.metadata}>
          <span className={styles.label}>Leaf UUID:</span>
          <span className={styles.value}>{event.leafUuid}</span>
        </div>
      )}
    </EventBox>
  );
};
