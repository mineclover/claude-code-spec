/**
 * Unified Event Type System
 *
 * This module provides a centralized registry for managing different event types
 * across both StreamOutput and SessionLogViewer contexts.
 */

import type React from 'react';
import type { StreamEvent } from './types';
import type { ClaudeSessionEntry } from '../preload';

// ============================================================================
// Unified Event Type
// ============================================================================

/**
 * Unified event type that can represent both stream events and session log entries
 */
export type UnifiedEvent = StreamEvent | ClaudeSessionEntry;

// ============================================================================
// Event Type Enum
// ============================================================================

/**
 * Centralized event type enumeration
 */
export enum EventType {
  SYSTEM_INIT = 'system_init',
  USER = 'user',
  ASSISTANT = 'assistant',
  RESULT = 'result',
  ERROR = 'error',
  SUMMARY = 'summary',
  MESSAGE = 'message',
  UNKNOWN = 'unknown',
}

// ============================================================================
// Event Type Detector Interface
// ============================================================================

/**
 * Interface for event type detection
 */
export interface EventTypeDetector {
  type: EventType;
  detect: (event: UnifiedEvent) => boolean;
  priority: number; // Higher priority detectors are checked first
}

/**
 * Interface for event renderer component
 */
export interface EventRendererComponent {
  component: React.ComponentType<{ event: UnifiedEvent; index?: number }>;
  eventType: EventType;
}

// ============================================================================
// Event Type Registry
// ============================================================================

/**
 * Registry for managing event type detection and rendering
 */
export class EventTypeRegistry {
  private detectors: Map<EventType, EventTypeDetector> = new Map();
  private renderers: Map<EventType, EventRendererComponent> = new Map();

  /**
   * Register an event type detector
   */
  registerDetector(detector: EventTypeDetector): void {
    this.detectors.set(detector.type, detector);
  }

  /**
   * Register an event renderer component
   */
  registerRenderer(renderer: EventRendererComponent): void {
    this.renderers.set(renderer.eventType, renderer);
  }

  /**
   * Detect event type from a unified event
   */
  detectEventType(event: UnifiedEvent): EventType {
    // Sort detectors by priority (descending)
    const sortedDetectors = Array.from(this.detectors.values()).sort(
      (a, b) => b.priority - a.priority
    );

    // Find the first matching detector
    for (const detector of sortedDetectors) {
      if (detector.detect(event)) {
        return detector.type;
      }
    }

    return EventType.UNKNOWN;
  }

  /**
   * Get renderer component for a specific event type
   */
  getRenderer(eventType: EventType): EventRendererComponent | undefined {
    return this.renderers.get(eventType);
  }

  /**
   * Get all registered event types
   */
  getRegisteredTypes(): EventType[] {
    return Array.from(this.detectors.keys());
  }
}

// ============================================================================
// Default Event Type Detectors
// ============================================================================

/**
 * Default detectors for standard event types
 */
export const defaultDetectors: EventTypeDetector[] = [
  // System Init Event (highest priority for specific matching)
  {
    type: EventType.SYSTEM_INIT,
    priority: 100,
    detect: (event: UnifiedEvent) =>
      'type' in event &&
      event.type === 'system' &&
      'subtype' in event &&
      event.subtype === 'init',
  },

  // User Event
  {
    type: EventType.USER,
    priority: 90,
    detect: (event: UnifiedEvent) =>
      'type' in event && event.type === 'user' && 'message' in event,
  },

  // Assistant Event
  {
    type: EventType.ASSISTANT,
    priority: 90,
    detect: (event: UnifiedEvent) =>
      'type' in event && event.type === 'assistant' && 'message' in event,
  },

  // Result Event
  {
    type: EventType.RESULT,
    priority: 90,
    detect: (event: UnifiedEvent) =>
      'type' in event && event.type === 'result' && 'result' in event,
  },

  // Error Event
  {
    type: EventType.ERROR,
    priority: 90,
    detect: (event: UnifiedEvent) =>
      'type' in event && event.type === 'error' && 'error' in event,
  },

  // Summary Event (for session logs)
  {
    type: EventType.SUMMARY,
    priority: 80,
    detect: (event: UnifiedEvent) =>
      'type' in event && event.type === 'summary' && 'summary' in event,
  },

  // Message Event (generic message, lower priority)
  {
    type: EventType.MESSAGE,
    priority: 50,
    detect: (event: UnifiedEvent) =>
      'message' in event && typeof event.message === 'object' && event.message !== null,
  },
];

// ============================================================================
// Global Registry Instance
// ============================================================================

/**
 * Global event type registry instance
 */
export const eventRegistry = new EventTypeRegistry();

// Register default detectors
for (const detector of defaultDetectors) {
  eventRegistry.registerDetector(detector);
}
