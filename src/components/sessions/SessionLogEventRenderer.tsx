import type React from 'react';
import type { ClaudeSessionEntry } from '../../preload';
import { SummaryEvent } from './events/SummaryEvent';
import { MessageEvent } from './events/MessageEvent';
import { UnknownSessionEvent } from './events/UnknownSessionEvent';

interface SessionLogEventRendererProps {
  event: ClaudeSessionEntry;
  index: number;
}

export const SessionLogEventRenderer: React.FC<SessionLogEventRendererProps> = ({
  event,
  index,
}) => {
  // Handle summary entries
  if (event.type === 'summary' && event.summary) {
    return <SummaryEvent key={index} event={event} />;
  }

  // Handle message entries (user/assistant)
  if ('message' in event && event.message && typeof event.message === 'object') {
    return <MessageEvent key={index} event={event} />;
  }

  // Fallback for unknown events
  return <UnknownSessionEvent key={index} event={event} />;
};
