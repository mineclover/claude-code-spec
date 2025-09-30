import type React from 'react';
import type { StreamEvent } from '../../../lib/types';
import { CodeBlock } from '../common/CodeBlock';
import { EventBox } from '../common/EventBox';

interface UnknownEventProps {
  event: StreamEvent;
}

export const UnknownEvent: React.FC<UnknownEventProps> = ({ event }) => {
  return (
    <EventBox type="unknown" icon="📦" title={`Unknown Event: ${event.type}`}>
      <CodeBlock code={JSON.stringify(event, null, 2)} language="json" />
    </EventBox>
  );
};
