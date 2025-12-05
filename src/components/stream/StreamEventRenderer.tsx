import type { StreamEvent } from '../../types/stream-events';
import type React from 'react';
import { UnifiedEventRenderer } from '../common/UnifiedEventRenderer';

interface StreamEventRendererProps {
  event: StreamEvent;
  index: number;
}

/**
 * Stream Event Renderer
 *
 * This component now uses the UnifiedEventRenderer system for consistent
 * event rendering across the application.
 */
export const StreamEventRenderer: React.FC<StreamEventRendererProps> = ({ event, index }) => {
  return <UnifiedEventRenderer event={event} index={index} />;
};
