import type React from 'react';
import type { ClaudeSessionEntry } from '../../../preload';
import { EventBox } from '../../stream/common/EventBox';
import styles from './MessageEvent.module.css';

interface MessageEventProps {
  event: ClaudeSessionEntry;
}

export const MessageEvent: React.FC<MessageEventProps> = ({ event }) => {
  const message = event.message as { role?: string; content?: string | unknown[] };

  if (!message || !message.role) {
    return null;
  }

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  // Handle string content
  if (typeof message.content === 'string') {
    return (
      <EventBox
        type={isUser ? 'system' : 'assistant'}
        icon={isUser ? '👤' : '🤖'}
        title={isUser ? 'User' : 'Assistant'}
        rawData={event}
      >
        <div className={styles.content}>{message.content}</div>
      </EventBox>
    );
  }

  // Handle array content (tool results or complex content)
  if (Array.isArray(message.content)) {
    // Safely extract text from various content formats
    const extractText = (item: any): string | null => {
      if (!item) return null;
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item.type === 'text' && typeof item.text === 'string') {
        return item.text;
      }
      return null;
    };

    // Try to extract all text content
    const textParts = message.content.map(extractText).filter((t): t is string => t !== null);

    // If we successfully extracted text from all items, render as text
    if (textParts.length === message.content.length && textParts.length > 0) {
      const combinedText = textParts.join('\n');
      return (
        <EventBox
          type={isAssistant ? 'assistant' : 'system'}
          icon={isAssistant ? '🤖' : '👤'}
          title={isAssistant ? 'Assistant' : 'User'}
          rawData={event}
        >
          <div className={styles.content}>{combinedText}</div>
        </EventBox>
      );
    }

    // Otherwise render as JSON for complex structures (safely)
    return (
      <EventBox
        type={isUser ? 'system' : 'assistant'}
        icon={isUser ? '🔧' : '🤖'}
        title={isUser ? 'Tool Result' : 'Assistant'}
        rawData={event}
      >
        <div className={styles.arrayContent}>
          {message.content.map((item, idx) => {
            // Ensure we always render a string, never an object
            const displayContent = typeof item === 'string'
              ? item
              : JSON.stringify(item, null, 2);

            return (
              <div key={idx} className={styles.contentItem}>
                <pre className={styles.contentPre}>{displayContent}</pre>
              </div>
            );
          })}
        </div>
      </EventBox>
    );
  }

  return null;
};
