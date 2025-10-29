import type { StreamEvent } from '@context-action/code-api';
import type React from 'react';
import { CodeBlock } from '../common/CodeBlock';
import { EventBox } from '../common/EventBox';

interface UnknownEventProps {
  event: StreamEvent;
}

export const UnknownEvent: React.FC<UnknownEventProps> = ({ event }) => {
  const isSidechain = 'isSidechain' in event ? (event.isSidechain as boolean) : undefined;

  return (
    <EventBox
      type="unknown"
      icon="📦"
      title={`Unknown Event: ${event.type}`}
      rawData={event}
      isSidechain={isSidechain}
    >
      <CodeBlock code={JSON.stringify(event, null, 2)} language="json" />
    </EventBox>
  );
};
