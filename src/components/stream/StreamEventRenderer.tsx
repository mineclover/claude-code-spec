import type React from 'react';
import type { StreamEvent } from '../../lib/types';
import { isAssistantEvent, isErrorEvent, isResultEvent, isSystemInitEvent } from '../../lib/types';
import { AssistantEvent } from './events/AssistantEvent';
import { ErrorEvent } from './events/ErrorEvent';
import { ResultEvent } from './events/ResultEvent';
import { SystemInitEvent } from './events/SystemInitEvent';
import { UnknownEvent } from './events/UnknownEvent';

interface StreamEventRendererProps {
  event: StreamEvent;
  index: number;
}

export const StreamEventRenderer: React.FC<StreamEventRendererProps> = ({ event, index }) => {
  // Use type guards for routing
  if (isSystemInitEvent(event)) {
    return <SystemInitEvent key={index} event={event} />;
  }

  if (isAssistantEvent(event)) {
    return <AssistantEvent key={index} event={event} />;
  }

  if (isResultEvent(event)) {
    return <ResultEvent key={index} event={event} />;
  }

  if (isErrorEvent(event)) {
    return <ErrorEvent key={index} event={event} />;
  }

  // Fallback for unknown events
  return <UnknownEvent key={index} event={event} />;
};
