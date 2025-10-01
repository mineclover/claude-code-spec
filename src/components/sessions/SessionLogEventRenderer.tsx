import type React from 'react';
import type { ClaudeSessionEntry } from '../../preload';
import { UnifiedEventRenderer } from '../common/UnifiedEventRenderer';

interface SessionLogEventRendererProps {
  event: ClaudeSessionEntry;
  index: number;
}

/**
 * Session Log Event Renderer
 *
 * This component now uses the UnifiedEventRenderer system for consistent
 * event rendering across the application.
 */
export const SessionLogEventRenderer: React.FC<SessionLogEventRendererProps> = ({
  event,
  index,
}) => {
  return <UnifiedEventRenderer event={event} index={index} />;
};
