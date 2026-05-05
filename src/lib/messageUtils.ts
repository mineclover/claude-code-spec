/**
 * Re-exported message helpers from @context-action/code-api.
 *
 * Historically these were inlined here to avoid a node-deps bundle into the
 * renderer; now that the parser package is renderer-safe (pure TS + zod), we
 * route through the canonical implementation. Kept as a shim for import
 * stability — new code should import from '@context-action/code-api'.
 */

export {
  extractTextFromMessage,
  extractToolUsesFromMessage,
} from '@context-action/code-api';
