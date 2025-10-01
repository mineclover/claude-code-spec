/**
 * Unified Event Renderer
 *
 * This component provides a unified rendering system for both stream events
 * and session log entries using the centralized event registry.
 */

import type React from 'react';
import { eventRegistry, EventType, type UnifiedEvent } from '../../lib/event-registry';

// Import stream event components
import { SystemInitEvent } from '../stream/events/SystemInitEvent';
import { UserEvent } from '../stream/events/UserEvent';
import { AssistantEvent } from '../stream/events/AssistantEvent';
import { ResultEvent } from '../stream/events/ResultEvent';
import { ErrorEvent } from '../stream/events/ErrorEvent';
import { UnknownEvent } from '../stream/events/UnknownEvent';

// Import session event components
import { SummaryEvent } from '../sessions/events/SummaryEvent';
import { MessageEvent } from '../sessions/events/MessageEvent';
import { UnknownSessionEvent } from '../sessions/events/UnknownSessionEvent';

// ============================================================================
// Register Event Renderers
// ============================================================================

// Only register if not already registered (avoid duplicate registration)
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
    eventType: EventType.SUMMARY,
    component: SummaryEvent as React.ComponentType<{ event: UnifiedEvent; index?: number }>,
  });

  eventRegistry.registerRenderer({
    eventType: EventType.MESSAGE,
    component: MessageEvent as React.ComponentType<{ event: UnifiedEvent; index?: number }>,
  });

  eventRegistry.registerRenderer({
    eventType: EventType.UNKNOWN,
    component: UnknownEvent as React.ComponentType<{ event: UnifiedEvent; index?: number }>,
  });
}

// ============================================================================
// Unified Event Renderer Component
// ============================================================================

export interface UnifiedEventRendererProps {
  event: UnifiedEvent;
  index?: number;
}

/**
 * Unified event renderer that works for both stream events and session log entries
 */
export const UnifiedEventRenderer: React.FC<UnifiedEventRendererProps> = ({ event, index = 0 }) => {
  // Detect event type using the registry
  const eventType = eventRegistry.detectEventType(event);

  // Get the appropriate renderer
  const renderer = eventRegistry.getRenderer(eventType);

  if (!renderer) {
    // Fallback to unknown event if no renderer found
    const fallbackRenderer = eventRegistry.getRenderer(EventType.UNKNOWN);
    if (fallbackRenderer) {
      const Component = fallbackRenderer.component;
      return <Component event={event} index={index} key={index} />;
    }

    // Ultimate fallback
    return <UnknownEvent event={event} key={index} />;
  }

  // Render with the appropriate component
  const Component = renderer.component;
  return <Component event={event} index={index} key={index} />;
};
