import type React from 'react';
import { useState } from 'react';
import styles from './EventBox.module.css';

export type EventType = 'system' | 'assistant' | 'result' | 'error' | 'unknown';

interface EventBoxProps {
  type: EventType;
  icon?: string;
  title: string;
  children: React.ReactNode;
  rawData?: unknown; // Original event data for raw copy
}

const getEventClass = (type: EventType): string => {
  switch (type) {
    case 'system':
      return styles.system;
    case 'assistant':
      return styles.assistant;
    case 'result':
      return styles.result;
    case 'error':
      return styles.error;
    default:
      return styles.unknown;
  }
};

export const EventBox: React.FC<EventBoxProps> = ({ type, icon, title, children, rawData }) => {
  const eventClass = getEventClass(type);
  const [copied, setCopied] = useState(false);

  const handleCopyRaw = async () => {
    if (!rawData) return;

    try {
      const rawJson = JSON.stringify(rawData, null, 2);
      await navigator.clipboard.writeText(rawJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy raw data:', err);
    }
  };

  return (
    <div className={`${styles.eventBox} ${eventClass}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {icon && <span className={styles.icon}>{icon}</span>}
          <strong className={styles.title}>{title}</strong>
        </div>
        {rawData && (
          <button
            type="button"
            className={styles.rawButton}
            onClick={handleCopyRaw}
            title="Copy raw event data"
          >
            {copied ? '✓ Copied' : 'Raw'}
          </button>
        )}
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};
