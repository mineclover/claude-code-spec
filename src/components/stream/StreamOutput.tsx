import type React from 'react';
import { useEffect, useRef } from 'react';
import type { StreamEvent } from '@context-action/code-api';
import { StreamEventRenderer } from './StreamEventRenderer';
import styles from './StreamOutput.module.css';

interface StreamOutputProps {
  events: StreamEvent[];
  errors: Array<{ id: string; message: string }>;
  currentPid: number | null;
  sessionId?: string | null;
}

export const StreamOutput: React.FC<StreamOutputProps> = ({
  events,
  errors,
  currentPid,
  sessionId,
}) => {
  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new events arrive
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          Stream Output
          {sessionId && <span className={styles.pidBadge}>Session: {sessionId.slice(0, 8)}</span>}
          {currentPid && <span className={styles.pidBadge}>PID: {currentPid}</span>}
        </h3>
        <div className={styles.stats}>
          <span className={styles.statBadge}>Events: {events.length}</span>
          {errors.length > 0 && <span className={styles.errorBadge}>Errors: {errors.length}</span>}
        </div>
      </div>

      <div className={styles.content}>
        {events.length === 0 && errors.length === 0 ? (
          <p className={styles.emptyMessage}>
            No output yet. Execute a query to see stream-json output.
          </p>
        ) : (
          <>
            {events.map((event, index) => (
              <StreamEventRenderer
                key={`event-${index}-${Date.now()}`}
                event={event}
                index={index}
              />
            ))}
            {errors.map((error) => (
              <div key={error.id} className={styles.errorBox}>
                <strong>❌ Error</strong>
                <pre className={styles.errorMessage}>{error.message}</pre>
              </div>
            ))}
          </>
        )}
        <div ref={outputEndRef} />
      </div>
    </div>
  );
};
