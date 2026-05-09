/**
 * Server-side agent registry — composes the per-CLI readers with their
 * outline extractors. Pulls node:fs (transitively, through the readers)
 * so this entry stays out of the renderer bundle.
 */

export {
  AGENTS,
  getAgent,
  loadOutlineForSession,
} from './agents/registry';
export type {
  AgentId,
  AgentReader,
  AgentOutlineExtractor,
  AgentDefinition,
} from './agents/types';
export { AGENT_IDS, isAgentId } from './agents/types';
