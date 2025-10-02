/**
 * Claude IPC Handlers
 * Handles Claude CLI execution and session management
 */

import type { IpcMainInvokeEvent } from 'electron';
import type { ClaudeClient } from '../../lib/ClaudeClient';
import { ClaudeClient as ClaudeClientClass } from '../../lib/ClaudeClient';
import type { SessionManager } from '../../lib/SessionManager';
import type { StreamEvent } from '../../lib/StreamParser';
import { extractSessionId, isResultEvent, isSystemInitEvent } from '../../lib/types';
import type { SessionLogger } from '../../services/logger';
import type { IPCRouter } from '../IPCRouter';

interface ClaudeHandlersContext {
  sessionManager: SessionManager;
  logger: SessionLogger;
  activeClients: Map<number, ClaudeClient>;
}

export function registerClaudeHandlers(router: IPCRouter, context: ClaudeHandlersContext): void {
  const { sessionManager, logger, activeClients } = context;

  // Shared execution logic
  const executeClaudeCommand = async (
    event: IpcMainInvokeEvent,
    projectPath: string,
    query: string,
    sessionId?: string,
    mcpConfig?: string,
    model?: 'sonnet' | 'opus',
  ) => {
    console.log('[Main] Execute request:', { projectPath, query, sessionId, mcpConfig, model });

    try {
      // Create Claude client
      const client = new ClaudeClientClass({
        cwd: projectPath,
        model: model || 'sonnet', // Use Sonnet by default for better speed/cost balance
        sessionId: sessionId || undefined,
        mcpConfig: mcpConfig || undefined,
        onStream: (streamEvent: StreamEvent) => {
          // Forward stream event to renderer
          event.sender.send('claude:stream', {
            pid: client.isRunning() ? process.pid : null,
            data: streamEvent,
          });

          // Extract and save session info from system init event
          if (isSystemInitEvent(streamEvent)) {
            sessionManager.saveSession(streamEvent.session_id, {
              cwd: projectPath,
              query,
              timestamp: Date.now(),
            });
            // Start logging session BEFORE logging the event
            logger.startSession(streamEvent.session_id);
          }

          // Log stream event (now session is started for system init events)
          const sessionIdFromEvent = extractSessionId(streamEvent);
          logger.logEvent(streamEvent, sessionIdFromEvent);

          // Save result from result event
          if (isResultEvent(streamEvent)) {
            const currentSessionId = client.getSessionId();
            if (currentSessionId) {
              sessionManager.updateSessionResult(currentSessionId, streamEvent.result);
            }
            // Close logging session
            logger.closeSession();
          }
        },
        onError: (error: string) => {
          event.sender.send('claude:error', {
            pid: client.isRunning() ? process.pid : null,
            error,
          });
        },
        onClose: (code: number) => {
          const pid = process.pid;
          console.log('[Main] Client closed:', code);
          event.sender.send('claude:complete', { pid, code });
          activeClients.delete(pid);
        },
      });

      // Execute query
      const childProcess = client.execute(query);
      const pid = childProcess.pid;

      if (!pid) {
        throw new Error('Failed to get process PID');
      }

      // Store active client
      activeClients.set(pid, client);

      // Notify renderer
      event.sender.send('claude:started', { pid });

      return { success: true, pid };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Main] Execution error:', error);
      event.sender.send('claude:error', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  // Execute Claude CLI
  router.handle(
    'execute',
    async (event: IpcMainInvokeEvent, projectPath: string, query: string, sessionId?: string, mcpConfig?: string, model?: 'sonnet' | 'opus') => {
      return executeClaudeCommand(event, projectPath, query, sessionId, mcpConfig, model);
    },
  );

  // Get session list
  router.handle('get-sessions', async () => {
    const sessions = sessionManager.getAllSessions();
    console.log('[Main] Returning sessions:', sessions.length);
    return sessions;
  });

  // Get current session
  router.handle('get-current-session', async () => {
    const sessionId = sessionManager.getCurrentSessionId();
    console.log('[Main] Current session:', sessionId);
    return sessionId;
  });

  // Resume session (delegates to execute with sessionId)
  router.handle(
    'resume-session',
    async (event: IpcMainInvokeEvent, sessionId: string, projectPath: string, query: string) => {
      console.log('[Main] Resume session:', sessionId);
      // Use shared execution logic with sessionId parameter
      return executeClaudeCommand(event, projectPath, query, sessionId);
    },
  );

  // Clear sessions
  router.handle('clear-sessions', async () => {
    sessionManager.clearSessions();
    console.log('[Main] Sessions cleared');
    return { success: true };
  });
}
