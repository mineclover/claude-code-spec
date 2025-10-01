import type React from 'react';
import type { ErrorEvent as ErrorEventType } from '../../../lib/types';
import { EventBox } from '../common/EventBox';
import styles from './ErrorEvent.module.css';

interface ErrorEventProps {
  event: ErrorEventType;
}

export const ErrorEvent: React.FC<ErrorEventProps> = ({ event }) => {
  return (
    <EventBox type="error" icon="❌" title="Error" rawData={event}>
      <div className={styles.errorType}>{event.error.type}</div>
      <div className={styles.errorMessage}>{event.error.message}</div>
    </EventBox>
  );
};
