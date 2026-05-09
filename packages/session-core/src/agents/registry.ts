/**
 * Agent registry — single source of truth for per-CLI dispatch.
 *
 * Every higher-level consumer (cli-runner CLI, session-viewer bun
 * host) used to carry its own `if toolId === 'claude' { ... } else
 * if toolId === 'codex' { ... }` ladder. This registry replaces those
 * with a table lookup, so adding (or removing) an agent only edits
 * one place.
 *
 * The registry pairs each agent's raw-bytes reader with its outline
 * extractor. It also exposes `loadOutlineForSession(...)` which is
 * the canonical "read raw → extract outline" composition that both
 * the standalone CLI and the bun handler need.
 */

import { extractClaudeOutline } from './claude/outline';
import { extractCodexOutline } from './codex/outline';
import { extractGeminiOutline } from './gemini/outline';
import { readClaudeSessionRaw } from './claude/reader';
import { readCodexSessionRaw } from './codex/reader';
import { readGeminiSessionRaw } from './gemini/reader';
import type { SessionOutline } from '../outline/types';
import type { AgentDefinition, AgentId } from './types';

const claudeAgent: AgentDefinition = {
  id: 'claude',
  reader: { readSessionRaw: readClaudeSessionRaw },
  outline: { extract: extractClaudeOutline },
};

const codexAgent: AgentDefinition = {
  id: 'codex',
  reader: { readSessionRaw: readCodexSessionRaw },
  outline: { extract: extractCodexOutline },
};

const geminiAgent: AgentDefinition = {
  id: 'gemini',
  reader: { readSessionRaw: readGeminiSessionRaw },
  outline: { extract: extractGeminiOutline },
};

export const AGENTS: Readonly<Record<AgentId, AgentDefinition>> = {
  claude: claudeAgent,
  codex: codexAgent,
  gemini: geminiAgent,
} as const;

export function getAgent(id: AgentId): AgentDefinition {
  return AGENTS[id];
}

/**
 * Read raw bytes for a session and run the matching outline extractor.
 * Returns `null` when the source session can't be located on disk —
 * the caller is expected to surface that as a "session not found"
 * banner rather than throwing.
 *
 * `language` is forwarded to the extractor so the resulting outline
 * carries the operator's language preference; subsequent annotator
 * runs read it from `outline.language` when no explicit override is
 * given.
 */
export async function loadOutlineForSession(args: {
  agentId: AgentId;
  sessionId: string;
  cwd: string;
  language?: 'en' | 'ko';
}): Promise<SessionOutline | null> {
  const agent = AGENTS[args.agentId];
  const raw = await agent.reader.readSessionRaw(args.sessionId, args.cwd);
  if (raw === null) return null;
  return agent.outline.extract({
    raw,
    sourceSessionId: args.sessionId,
    cwd: args.cwd,
    language: args.language,
  });
}
