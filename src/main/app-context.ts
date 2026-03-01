/**
 * Application context - service initialization and tool registration
 */

import { claudeToolDefinition } from '../data/cli-tools/claude';
import { codexToolDefinition } from '../data/cli-tools/codex';
import { geminiToolDefinition } from '../data/cli-tools/gemini';
import { toolRegistry } from '../services/ToolRegistry';

/**
 * Initialize all services and register tools
 */
export function initializeAppContext(): void {
  // Register CLI tools
  toolRegistry.register(claudeToolDefinition);
  toolRegistry.register(codexToolDefinition);
  toolRegistry.register(geminiToolDefinition);

  console.log(
    '[AppContext] Initialized. Registered tools:',
    toolRegistry.getAll().map((t) => t.id),
  );
}
