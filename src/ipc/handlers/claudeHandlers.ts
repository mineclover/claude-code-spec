/**
 * Claude IPC Handlers
 * Handles Claude CLI execution and session management with ProcessManager
 */

import { BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { SessionManager } from '../../lib/SessionManager';
import type { StreamEvent } from '../../lib/StreamParser';
import { extractSessionId, isResultEvent, isSystemInitEvent } from '../../lib/types';
import type { SessionLogger } from '../../services/logger';
import { processManager } from '../../services/ProcessManager';
import type { IPCRouter } from '../IPCRouter';

interface ClaudeHandlersContext {
  sessionManager: SessionManager;
  logger: SessionLogger;
}

export function registerClaudeHandlers(router: IPCRouter, context: ClaudeHandlersContext): void {
  const { sessionManager, logger } = context;

  // Setup ProcessManager listener to broadcast execution changes
  processManager.setExecutionsChangeListener(() => {
    const activeExecutions = processManager.getActiveExecutions().map((exec) => ({
      sessionId: exec.sessionId,
      projectPath: exec.projectPath,
      query: exec.query,
      status: exec.status,
      pid: exec.pid,
      eventsCount: exec.events.length,
      errorsCount: exec.errors.length,
      startTime: exec.startTime,
      endTime: exec.endTime,
      mcpConfig: exec.mcpConfig,
      model: exec.model,
    }));

    // Broadcast to all renderer windows
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('executions:updated', activeExecutions);
    });
  });

  // Shared execution logic using ProcessManager
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
      // Start execution using ProcessManager (returns sessionId)
      const resultSessionId = await processManager.startExecution({
        projectPath,
        query,
        sessionId, // Resume sessionId if provided
        mcpConfig,
        model: model || 'sonnet',
        onStream: (sid: string, streamEvent: StreamEvent) => {
          // Forward stream event to renderer with sessionId
          event.sender.send('claude:stream', {
            sessionId: sid,
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
            sessionManager.updateSessionResult(sid, streamEvent.result);
            // Close logging session
            logger.closeSession();
          }
        },
        onError: (sid: string, error: string) => {
          event.sender.send('claude:error', {
            sessionId: sid,
            error,
          });
        },
        onComplete: (sid: string, code: number) => {
          console.log('[Main] Execution completed:', { sessionId: sid, code });
          event.sender.send('claude:complete', {
            sessionId: sid,
            code,
          });
        },
      });

      // Get execution info
      const execution = processManager.getExecution(resultSessionId);

      // Notify renderer
      event.sender.send('claude:started', {
        sessionId: resultSessionId,
        pid: execution?.pid || null,
      });

      return {
        success: true,
        sessionId: resultSessionId,
        pid: execution?.pid || null,
      };
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

  // ProcessManager handlers
  router.handle('get-execution', async (_, sessionId: string) => {
    const execution = processManager.getExecution(sessionId);
    if (!execution) {
      return null;
    }

    // Return execution info without the client object (not serializable)
    return {
      sessionId: execution.sessionId,
      projectPath: execution.projectPath,
      query: execution.query,
      status: execution.status,
      pid: execution.pid,
      events: execution.events,
      errors: execution.errors,
      startTime: execution.startTime,
      endTime: execution.endTime,
      mcpConfig: execution.mcpConfig,
      model: execution.model,
    };
  });

  router.handle('get-all-executions', async () => {
    const executions = processManager.getAllExecutions();

    return executions.map((exec) => ({
      sessionId: exec.sessionId,
      projectPath: exec.projectPath,
      query: exec.query,
      status: exec.status,
      pid: exec.pid,
      eventsCount: exec.events.length,
      errorsCount: exec.errors.length,
      startTime: exec.startTime,
      endTime: exec.endTime,
      mcpConfig: exec.mcpConfig,
      model: exec.model,
    }));
  });

  router.handle('get-active-executions', async () => {
    const executions = processManager.getActiveExecutions();

    return executions.map((exec) => ({
      sessionId: exec.sessionId,
      projectPath: exec.projectPath,
      query: exec.query,
      status: exec.status,
      pid: exec.pid,
      eventsCount: exec.events.length,
      errorsCount: exec.errors.length,
      startTime: exec.startTime,
      endTime: exec.endTime,
      mcpConfig: exec.mcpConfig,
      model: exec.model,
    }));
  });

  router.handle('kill-execution', async (_, sessionId: string) => {
    try {
      processManager.killExecution(sessionId);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  router.handle('cleanup-execution', async (_, sessionId: string) => {
    try {
      processManager.cleanupExecution(sessionId);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  router.handle('get-execution-stats', async () => {
    return processManager.getStats();
  });

  router.handle('kill-all-executions', async () => {
    try {
      processManager.killAll();
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  router.handle('cleanup-all-completed', async () => {
    try {
      const count = processManager.cleanupAllCompleted();
      return { success: true, count };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });
}
