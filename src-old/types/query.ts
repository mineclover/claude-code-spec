/**
 * Query types
 * Migrated from @context-action/code-api
 */

export interface QueryOptions {
  outputStyle?: string;
  model?: 'sonnet' | 'opus' | 'haiku';
  mcpConfig?: string;
  filterThinking?: boolean;
  timeout?: number;
}

export interface QueryResult {
  result: string;
  messages: string[];
  events: unknown[];
  metadata: {
    totalCost: number;
    durationMs: number;
    numTurns: number;
    outputStyle?: string;
  };
}

export interface JSONExtractionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  raw?: string;
  cleanedText?: string;
}
