import type React from 'react';
import type { StreamEvent } from '@context-action/code-api';
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
