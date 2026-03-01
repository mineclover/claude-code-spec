/**
 * IPC Router - Centralized IPC handler management
 *
 * Provides a structured way to organize and register IPC handlers
 * with automatic error handling and logging.
 */

import type { IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';

// Type for handler functions
export type IPCHandler<TArgs extends unknown[] = unknown[], TReturn = unknown> = (
  event: IpcMainInvokeEvent,
  ...args: TArgs
) => Promise<TReturn> | TReturn;

// Options for handler registration
interface HandlerOptions {
  // Custom error handler
  onError?: (error: Error, channel: string, args: unknown[]) => void;
  // Enable logging
  enableLogging?: boolean;
}

/**
 * IPC Router class for organizing handlers by domain
 */
export class IPCRouter {
  private domain: string;
  private handlers: Map<string, IPCHandler> = new Map();
  private options: HandlerOptions;

  constructor(domain: string, options: HandlerOptions = {}) {
    this.domain = domain;
    this.options = {
      enableLogging: true,
      ...options,
    };
  }

  /**
   * Register a handler for a specific action
   */
  handle<TArgs extends unknown[] = unknown[], TReturn = unknown>(
    action: string,
    handler: IPCHandler<TArgs, TReturn>,
  ): this {
    const channel = `${this.domain}:${action}`;

    // Wrap handler with error handling and logging
    const wrappedHandler = async (event: IpcMainInvokeEvent, ...args: TArgs): Promise<TReturn> => {
      try {
        if (this.options.enableLogging) {
          console.log(`[IPC:${channel}] Invoked with args:`, args);
        }

        const result = await handler(event, ...args);

        if (this.options.enableLogging) {
          console.log(`[IPC:${channel}] Completed successfully`);
        }

        return result;
      } catch (error) {
        console.error(`[IPC:${channel}] Error:`, error);

        if (this.options.onError) {
          this.options.onError(error as Error, channel, args);
        }

        throw error;
      }
    };

    this.handlers.set(action, wrappedHandler as IPCHandler);
    ipcMain.handle(channel, wrappedHandler);

    return this;
  }

  /**
   * Remove a handler
   */
  removeHandler(action: string): this {
    const channel = `${this.domain}:${action}`;
    ipcMain.removeHandler(channel);
    this.handlers.delete(action);
    return this;
  }

  /**
   * Remove all handlers in this router
   */
  removeAllHandlers(): void {
    for (const action of this.handlers.keys()) {
      this.removeHandler(action);
    }
  }

  /**
   * Get all registered channels
   */
  getChannels(): string[] {
    return Array.from(this.handlers.keys()).map((action) => `${this.domain}:${action}`);
  }
}

/**
 * Central IPC Registry
 */
export class IPCRegistry {
  private routers: Map<string, IPCRouter> = new Map();

  /**
   * Create or get a router for a domain
   */
  router(domain: string, options?: HandlerOptions): IPCRouter {
    if (!this.routers.has(domain)) {
      this.routers.set(domain, new IPCRouter(domain, options));
    }
    const router = this.routers.get(domain);
    if (!router) {
      throw new Error(`Failed to get or create router for domain: ${domain}`);
    }
    return router;
  }

  /**
   * Get all registered channels across all routers
   */
  getAllChannels(): string[] {
    const channels: string[] = [];
    for (const router of this.routers.values()) {
      channels.push(...router.getChannels());
    }
    return channels;
  }

  /**
   * Remove all handlers across all routers
   */
  removeAllHandlers(): void {
    for (const router of this.routers.values()) {
      router.removeAllHandlers();
    }
    this.routers.clear();
  }
}

// Singleton instance
export const ipcRegistry = new IPCRegistry();
