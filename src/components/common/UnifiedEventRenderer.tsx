/**
 * Unified Event Renderer
 * Renders stream events using the centralized event registry.
 */

import type React from 'react';
import { EventType, eventRegistry, type UnifiedEvent } from '../../lib/event-registry';
import { AssistantEvent } from '../stream/events/AssistantEvent';
import { ErrorEvent } from '../stream/events/ErrorEvent';
import { ResultEvent } from '../stream/events/ResultEvent';
import { SystemInitEvent } from '../stream/events/SystemInitEvent';
import { UnknownEvent } from '../stream/events/UnknownEvent';
import { UserEvent } from '../stream/events/UserEvent';
import { ErrorBoundary } from './ErrorBoundary';

// Register event renderers
if (!eventRegistry.getRenderer(EventType.SYSTEM_INIT)) {
  eventRegistry.registerRenderer({
    eventType: EventType.SYSTEM_INIT,
    component: SystemInitEvent as React.ComponentType<{ event: UnifiedEvent; index?: number }>,
  });

  eventRegistry.registerRenderer({
    eventType: EventType.USER,
    component: UserEvent as React.ComponentType<{ event: UnifiedEvent; index?: number }>,
  });

  eventRegistry.registerRenderer({
    eventType: EventType.ASSISTANT,
    component: AssistantEvent as React.ComponentType<{ event: UnifiedEvent; index?: number }>,
  });

  eventRegistry.registerRenderer({
    eventType: EventType.RESULT,
    component: ResultEvent as React.ComponentType<{ event: UnifiedEvent; index?: number }>,
  });

  eventRegistry.registerRenderer({
    eventType: EventType.ERROR,
    component: ErrorEvent as React.ComponentType<{ event: UnifiedEvent; index?: number }>,
  });

  eventRegistry.registerRenderer({
    eventType: EventType.UNKNOWN,
    component: UnknownEvent as React.ComponentType<{ event: UnifiedEvent; index?: number }>,
  });
}

export interface UnifiedEventRendererProps {
  event: UnifiedEvent;
  index?: number;
}

export const UnifiedEventRenderer: React.FC<UnifiedEventRendererProps> = ({ event, index = 0 }) => {
  const eventType = eventRegistry.detectEventType(event);
  const renderer = eventRegistry.getRenderer(eventType);

  if (!renderer) {
    const fallbackRenderer = eventRegistry.getRenderer(EventType.UNKNOWN);
    if (fallbackRenderer) {
      const Component = fallbackRenderer.component;
      return (
        <ErrorBoundary key={index}>
          <Component event={event} index={index} />
        </ErrorBoundary>
      );
    }
    return (
      <ErrorBoundary key={index}>
        <UnknownEvent event={event} />
      </ErrorBoundary>
    );
  }

  const Component = renderer.component;
  return (
    <ErrorBoundary key={index}>
      <Component event={event} index={index} />
    </ErrorBoundary>
  );
};
