import type React from 'react';
import type { AssistantEvent as AssistantEventType } from '../../../lib/types';
import { extractTextFromMessage, extractToolUsesFromMessage } from '../../../lib/types';
import { EventBox } from '../common/EventBox';
import { TokenUsage } from '../common/TokenUsage';
import { ToolUse } from '../common/ToolUse';
import styles from './AssistantEvent.module.css';

interface AssistantEventProps {
  event: AssistantEventType;
}

export const AssistantEvent: React.FC<AssistantEventProps> = ({ event }) => {
  const textContent = extractTextFromMessage(event.message);
  const toolUses = extractToolUsesFromMessage(event.message);

  return (
    <EventBox
      type="assistant"
      icon="🤖"
      title="Assistant Response"
      rawData={event}
      isSidechain={event.isSidechain}
    >
      {textContent && <div className={styles.textContent}>{textContent}</div>}

      {toolUses.length > 0 && (
        <div className={styles.toolsSection}>
          {toolUses.map((tool) => (
            <ToolUse key={tool.id} id={tool.id} name={tool.name} input={tool.input} />
          ))}
        </div>
      )}

      <TokenUsage
        inputTokens={event.message.usage.input_tokens}
        outputTokens={event.message.usage.output_tokens}
        cacheReadTokens={event.message.usage.cache_read_input_tokens}
        cacheCreationTokens={event.message.usage.cache_creation_input_tokens}
      />
    </EventBox>
  );
};
