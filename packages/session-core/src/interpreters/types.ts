/**
 * Interpreter contract — minimal shape that session-core depends on.
 *
 * The full CLI tool definition (schema, options, command segments, registry
 * metadata) lives in the application layer (src/types/cli-tool.ts). Only the
 * runtime parse interface is needed here, so session-core stays free of UI /
 * registry concerns.
 */

export interface CLIToolInterpreter {
  toolId: string;
  parseStreamLine(line: string): unknown | null;
}
