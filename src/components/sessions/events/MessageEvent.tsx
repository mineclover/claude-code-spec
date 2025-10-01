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
    // Check if content contains text blocks
    const textBlocks = message.content.filter(
      (item: any) => item && typeof item === 'object' && item.type === 'text'
    );
    const hasOnlyText = textBlocks.length === message.content.length;

    // If all items are text blocks, render them as plain text
    if (hasOnlyText && textBlocks.length > 0) {
      const combinedText = textBlocks.map((item: any) => item.text).join('\n');
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

    // Otherwise render as JSON for complex structures
    return (
      <EventBox
        type={isUser ? 'system' : 'assistant'}
        icon={isUser ? '🔧' : '🤖'}
        title={isUser ? 'Tool Result' : 'Assistant'}
        rawData={event}
      >
        <div className={styles.arrayContent}>
          {message.content.map((item, idx) => (
            <div key={idx} className={styles.contentItem}>
              <pre className={styles.contentPre}>{JSON.stringify(item, null, 2)}</pre>
            </div>
          ))}
        </div>
      </EventBox>
    );
  }

  return null;
};
