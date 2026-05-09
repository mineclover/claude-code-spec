/**
 * Tests for the session-core agent registry.
 *
 * The registry's job is dispatching by `AgentId` to the right
 * reader+extractor pair. We pin two contract properties:
 *   1. Every supported AgentId has an entry, and the entry's `id`
 *      field matches the key (so callers can rely on
 *      `AGENTS[id].id === id`).
 *   2. `loadOutlineForSession` returns `null` (not throws) when the
 *      reader can't find the source bytes — this is what every
 *      caller relies on to render an empty-state banner.
 *
 * We avoid any real-disk I/O by stubbing the reader on the registry's
 * agent definitions inline. The extractor stub captures its args so
 * we can verify the registry forwards them faithfully.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AGENTS, loadOutlineForSession } from './registry';
import { AGENT_IDS, isAgentId } from './types';
import type { SessionOutline } from '../outline/types';

describe('session-core agent registry', () => {
  it('contains every AgentId in AGENT_IDS, with matching `id` field', () => {
    for (const id of AGENT_IDS) {
      const entry = AGENTS[id];
      expect(entry).toBeDefined();
      expect(entry.id).toBe(id);
      expect(typeof entry.reader.readSessionRaw).toBe('function');
      expect(typeof entry.outline.extract).toBe('function');
    }
  });

  it('isAgentId only accepts the three known ids', () => {
    expect(isAgentId('claude')).toBe(true);
    expect(isAgentId('codex')).toBe(true);
    expect(isAgentId('gemini')).toBe(true);
    expect(isAgentId('CLAUDE')).toBe(false);
    expect(isAgentId('opus')).toBe(false);
    expect(isAgentId(undefined)).toBe(false);
    expect(isAgentId(123)).toBe(false);
  });
});

describe('loadOutlineForSession', () => {
  // Each test temporarily monkey-patches the chosen agent's reader
  // and extractor, then restores them after. We use the registry's
  // mutability deliberately — the API is `Readonly` on the table
  // itself, but the leaf method properties stay assignable.
  let originalReader: typeof AGENTS.claude.reader.readSessionRaw;
  let originalExtract: typeof AGENTS.claude.outline.extract;

  beforeEach(() => {
    originalReader = AGENTS.claude.reader.readSessionRaw;
    originalExtract = AGENTS.claude.outline.extract;
  });
  afterEach(() => {
    AGENTS.claude.reader.readSessionRaw = originalReader;
    AGENTS.claude.outline.extract = originalExtract;
  });

  it('returns null when the reader yields null (raw bytes missing)', async () => {
    AGENTS.claude.reader.readSessionRaw = async () => null;
    const outline = await loadOutlineForSession({
      agentId: 'claude',
      sessionId: 'never',
      cwd: '/tmp',
    });
    expect(outline).toBeNull();
  });

  it('forwards sessionId / cwd / language to the extractor when raw bytes load', async () => {
    AGENTS.claude.reader.readSessionRaw = async () => 'raw-bytes';
    let captured:
      | { raw: string; sourceSessionId: string; cwd: string; language?: 'en' | 'ko' }
      | null = null;
    AGENTS.claude.outline.extract = (args): SessionOutline => {
      captured = args;
      return {
        toolId: 'claude',
        sourceSessionId: args.sourceSessionId,
        cwd: args.cwd,
        steps: [],
        segments: [],
        generatedAt: '2026-05-09T00:00:00.000Z',
        language: args.language,
      };
    };

    const outline = await loadOutlineForSession({
      agentId: 'claude',
      sessionId: 'sess-1',
      cwd: '/Users/jun/work',
      language: 'ko',
    });

    expect(outline).not.toBeNull();
    expect(outline!.sourceSessionId).toBe('sess-1');
    expect(captured).toEqual({
      raw: 'raw-bytes',
      sourceSessionId: 'sess-1',
      cwd: '/Users/jun/work',
      language: 'ko',
    });
  });

  it('dispatches by agentId — codex requests run the codex extractor', async () => {
    let claudeCalled = 0;
    let codexCalled = 0;
    const origClaudeRead = AGENTS.claude.reader.readSessionRaw;
    const origCodexRead = AGENTS.codex.reader.readSessionRaw;
    const origCodexExtract = AGENTS.codex.outline.extract;
    AGENTS.claude.reader.readSessionRaw = async () => {
      claudeCalled++;
      return null;
    };
    AGENTS.codex.reader.readSessionRaw = async () => {
      codexCalled++;
      return 'codex-bytes';
    };
    AGENTS.codex.outline.extract = (args): SessionOutline => ({
      toolId: 'codex',
      sourceSessionId: args.sourceSessionId,
      cwd: args.cwd,
      steps: [],
      segments: [],
      generatedAt: '2026-05-09T00:00:00.000Z',
    });
    try {
      const out = await loadOutlineForSession({
        agentId: 'codex',
        sessionId: 's',
        cwd: '/x',
      });
      expect(out?.toolId).toBe('codex');
      expect(claudeCalled).toBe(0);
      expect(codexCalled).toBe(1);
    } finally {
      AGENTS.claude.reader.readSessionRaw = origClaudeRead;
      AGENTS.codex.reader.readSessionRaw = origCodexRead;
      AGENTS.codex.outline.extract = origCodexExtract;
    }
  });
});
