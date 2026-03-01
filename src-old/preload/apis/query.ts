/**
 * Query API Preload
 */

import type { JSONExtractionResult, QueryOptions, QueryResult } from '../../services/ClaudeQueryAPI';
import { contextBridge, ipcRenderer } from 'electron';

export interface QueryAPI {
  /**
   * Execute a query with output-style and get clean results
   */
  executeQuery: (
    projectPath: string,
    query: string,
    options?: QueryOptions,
  ) => Promise<QueryResult>;

  /**
   * Kill running query
   */
  killQuery: () => Promise<{ success: boolean; error?: string }>;

  /**
   * Test structured JSON query
   */
  testStructuredQuery: (
    projectPath: string,
    query: string,
  ) => Promise<{ success: boolean; result?: any; error?: string }>;

  /**
   * Execute JSON query with automatic extraction and validation
   */
  executeJSONQuery: (
    projectPath: string,
    query: string,
    requiredFields?: string[],
  ) => Promise<JSONExtractionResult>;
}

export function exposeQueryAPI(): void {
  const queryAPI: QueryAPI = {
    executeQuery: (projectPath: string, query: string, options?: QueryOptions) =>
      ipcRenderer.invoke('query:executeQuery', { projectPath, query, options }),

    killQuery: () => ipcRenderer.invoke('query:killQuery'),

    testStructuredQuery: (projectPath: string, query: string) =>
      ipcRenderer.invoke('query:testStructuredQuery', { projectPath, query }),

    executeJSONQuery: (projectPath: string, query: string, requiredFields?: string[]) =>
      ipcRenderer.invoke('query:executeJSONQuery', { projectPath, query, requiredFields }),
  };

  contextBridge.exposeInMainWorld('queryAPI', queryAPI);
}
