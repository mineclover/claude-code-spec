/**
 * MCP policy — pure sanitization.
 *
 * Accepts an arbitrary value and returns a well-formed `McpPolicyFile`.
 * Non-array lists are replaced with `[]`; non-string items are dropped.
 * `schemaVersion` is always normalized to 1.
 */

import type { McpPolicyFile } from '../../types/mcp-policy';

export function sanitizePolicy(input: unknown): McpPolicyFile {
  const p = (input ?? {}) as Partial<McpPolicyFile>;
  return {
    schemaVersion: 1,
    defaultEnabled: Array.isArray(p.defaultEnabled)
      ? p.defaultEnabled.filter((s): s is string => typeof s === 'string')
      : [],
    allowed: Array.isArray(p.allowed)
      ? p.allowed.filter((s): s is string => typeof s === 'string')
      : [],
    forbidden: Array.isArray(p.forbidden)
      ? p.forbidden.filter((s): s is string => typeof s === 'string')
      : [],
  };
}
