import type React from 'react';
import type { UserEvent as UserEventType } from '../../../lib/types';
import { EventBox } from '../common/EventBox';
import styles from './UserEvent.module.css';

interface UserEventProps {
  event: UserEventType;
}

export const UserEvent: React.FC<UserEventProps> = ({ event }) => {
  const content = event.message.content;

  // Handle tool_result content (array type)
  if (Array.isArray(content)) {
    return (
      <EventBox type="user" icon="🔧" title="Tool Result">
        {content.map((item, idx) => (
          <div key={idx} className={styles.toolResult}>
            <div className={styles.toolId}>Tool: {item.tool_use_id}</div>
            <pre className={styles.toolContent}>{item.content}</pre>
          </div>
        ))}
      </EventBox>
    );
  }

  // Handle string content
  const isLocalCommand = content.includes('<local-command-stdout>');

  if (isLocalCommand) {
    // Extract content between tags
    const match = content.match(/<local-command-stdout>\s*([\s\S]*?)\s*<\/local-command-stdout>/);
    const commandOutput = match ? match[1] : content;

    return (
      <EventBox type="user" icon="💻" title="Local Command Output">
        <pre className={styles.commandOutput}>{commandOutput}</pre>
      </EventBox>
    );
  }

  // Regular user message
  return (
    <EventBox type="user" icon="👤" title="User Message">
      <div className={styles.content}>{content}</div>
    </EventBox>
  );
};
