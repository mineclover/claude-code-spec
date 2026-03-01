import type { UserEvent as UserEventType } from '../../../types/stream-events';
import type React from 'react';
import { EventBox } from '../common/EventBox';
import styles from './UserEvent.module.css';

interface UserEventProps {
  event: UserEventType;
}

/**
 * Creates a regex pattern to match and remove ANSI escape sequences (color codes, formatting).
 * Constructs the pattern dynamically using String.fromCharCode(27) for the ESC character
 * to avoid embedding literal control characters in the source code.
 */
function createAnsiEscapeRegex(): RegExp {
  return new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
}

export const UserEvent: React.FC<UserEventProps> = ({ event }) => {
  const content = event.message.content;

  // Handle tool_result content (array type)
  if (Array.isArray(content)) {
    return (
      <EventBox
        type="user"
        icon="🔧"
        title="Tool Result"
        rawData={event}
        isSidechain={event.isSidechain}
      >
        {content.map((item, index) => {
          // Safely extract text from content that might be a string or object
          const extractContent = (content: unknown): string => {
            if (typeof content === 'string') {
              return content;
            }
            if (
              typeof content === 'object' &&
              content !== null &&
              'type' in content &&
              'text' in content
            ) {
              // Handle text block objects like {type: 'text', text: '...'}
              if (content.type === 'text' && typeof content.text === 'string') {
                return content.text;
              }
            }
            if (typeof content === 'object' && content !== null) {
              // Otherwise stringify the object
              return JSON.stringify(content, null, 2);
            }
            return String(content);
          };

          const displayContent = extractContent(item.content);

          return (
            <div key={item.tool_use_id || `tool-result-${index}`} className={styles.toolResult}>
              <div className={styles.toolId}>Tool: {item.tool_use_id || 'Unknown'}</div>
              <pre className={styles.toolContent}>{displayContent}</pre>
            </div>
          );
        })}
      </EventBox>
    );
  }

  // Handle string content
  const isLocalCommand = content.includes('<local-command-stdout>');

  if (isLocalCommand) {
    // Extract content between tags
    const match = content.match(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/);
    let commandOutput = match ? match[1] : content;

    // Remove ANSI escape sequences but preserve newlines
    commandOutput = commandOutput.replace(createAnsiEscapeRegex(), '');

    return (
      <EventBox
        type="user"
        icon="💻"
        title="Local Command Output"
        rawData={event}
        isSidechain={event.isSidechain}
      >
        <pre className={styles.commandOutput}>{commandOutput}</pre>
      </EventBox>
    );
  }

  // Regular user message
  return (
    <EventBox
      type="user"
      icon="👤"
      title="User Message"
      rawData={event}
      isSidechain={event.isSidechain}
    >
      <div className={styles.content}>{content}</div>
    </EventBox>
  );
};
