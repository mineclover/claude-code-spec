/**
 * Query API IPC handlers
 */
import { ClaudeQueryAPI, type QueryOptions, type QueryResult, type JSONExtractionResult } from '@context-action/code-api';
import type { IPCRouter } from '../IPCRouter';

// Singleton instance
let queryAPI: ClaudeQueryAPI | null = null;

function getQueryAPI(): ClaudeQueryAPI {
  if (!queryAPI) {
    queryAPI = new ClaudeQueryAPI();
  }
  return queryAPI;
}

/**
 * Register query API handlers
 */
export function registerQueryHandlers(router: IPCRouter): void {
  // Execute a query with output-style
  router.handle<
    [{ projectPath: string; query: string; options?: QueryOptions }],
    QueryResult
  >('executeQuery', async (_event, { projectPath, query, options }) => {
    try {
      const api = getQueryAPI();
      const result = await api.query(projectPath, query, options);
      return result;
    } catch (error) {
      console.error('[QueryHandlers] Failed to execute query:', error);
      throw error;
    }
  });

  // Kill running query
  router.handle('killQuery', async () => {
    try {
      const api = getQueryAPI();
      api.kill();
      return { success: true };
    } catch (error) {
      console.error('[QueryHandlers] Failed to kill query:', error);
      return { success: false, error: String(error) };
    }
  });

  // Test query with structured-json
  router.handle<
    [{ projectPath: string; query: string }],
    { success: boolean; result?: any; error?: string }
  >('testStructuredQuery', async (_event, { projectPath, query }) => {
    try {
      const api = getQueryAPI();
      const result = await api.query(projectPath, query, {
        outputStyle: 'structured-json',
        filterThinking: true,
        mcpConfig: '.claude/.mcp-empty.json',
        timeout: 60000
      });

      // Try to parse as JSON
      try {
        const parsed = JSON.parse(result.result);
        return {
          success: true,
          result: {
            data: parsed,
            metadata: result.metadata
          }
        };
      } catch (parseError) {
        return {
          success: false,
          error: 'Result is not valid JSON',
          result: {
            raw: result.result,
            metadata: result.metadata
          }
        };
      }
    } catch (error) {
      console.error('[QueryHandlers] Failed to test structured query:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  });

  // Execute JSON query with automatic extraction
  router.handle<
    [{ projectPath: string; query: string; requiredFields?: string[] }],
    JSONExtractionResult
  >('executeJSONQuery', async (_event, { projectPath, query, requiredFields }) => {
    try {
      const api = getQueryAPI();
      const result = await api.queryJSON(projectPath, query, {
        requiredFields,
        mcpConfig: '.claude/.mcp-empty.json',
        timeout: 60000
      });
      return result;
    } catch (error) {
      console.error('[QueryHandlers] Failed to execute JSON query:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  });
}
