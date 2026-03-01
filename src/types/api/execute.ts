/**
 * ExecuteAPI type contract
 */

import type { ExecutionInfo, ExecutionRequest } from '../execution';
import type { StreamEvent } from '../stream-events';

export interface ExecuteAPI {
  execute: (request: ExecutionRequest) => Promise<string>; // returns sessionId
  getExecution: (sessionId: string) => Promise<ExecutionInfo | null>;
  getAllExecutions: () => Promise<ExecutionInfo[]>;
  killExecution: (sessionId: string) => Promise<void>;
  cleanupExecution: (sessionId: string) => Promise<void>;
  onStream: (callback: (sessionId: string, event: StreamEvent) => void) => () => void;
  onComplete: (callback: (sessionId: string) => void) => () => void;
  onError: (callback: (sessionId: string, error: string) => void) => () => void;
}
