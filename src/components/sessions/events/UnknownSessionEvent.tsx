import type React from 'react';
import type { ClaudeSessionEntry } from '../../../preload';
import { CodeBlock } from '../../stream/common/CodeBlock';
import { EventBox } from '../../stream/common/EventBox';

interface UnknownSessionEventProps {
  event: ClaudeSessionEntry;
}

export const UnknownSessionEvent: React.FC<UnknownSessionEventProps> = ({ event }) => {
  const eventType = event.type || 'unknown';

  return (
    <EventBox type="unknown" icon="📦" title={`Unknown Event: ${eventType}`} rawData={event}>
      <CodeBlock code={JSON.stringify(event, null, 2)} language="json" />
    </EventBox>
  );
};
