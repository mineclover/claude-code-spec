/**
 * Browser-safe agent surface.
 *
 * Re-exports just the type-level abstractions so the renderer can
 * type-check `AgentId` enums and dispatch UI by agent without
 * dragging the server-side reader/registry into its bundle.
 */

export type {
  AgentId,
  AgentReader,
  AgentOutlineExtractor,
  AgentDefinition,
} from './agents/types';
export { AGENT_IDS, isAgentId } from './agents/types';
