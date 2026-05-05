/**
 * Stream event types — re-exported from @context-action/code-api.
 *
 * The canonical source lives in packages/code-api/src/parser/types.ts and is
 * shared across CLIs (Claude / Codex / Gemini) via the universal `toolId`
 * envelope. This shim keeps existing import paths stable; new code should
 * import from '@context-action/code-api' directly.
 */

export type {
  AssistantEvent,
  ErrorEvent,
  ResultEvent,
  StreamEvent,
  SystemInitEvent,
  UserEvent,
} from '@context-action/code-api';
export {
  isAssistantEvent,
  isErrorEvent,
  isResultEvent,
  isSystemInitEvent,
  isUserEvent,
} from '@context-action/code-api';
