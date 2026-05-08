/**
 * In-memory mock that fulfils the SessionDataSource contract.
 *
 * Used by the dev server until a host adapter (Electron IPC, Electrobun RPC,
 * or HTTP) is wired up. Generates deterministic synthetic sessions with
 * realistic cache_read / cache_write distributions so the viewer can render
 * meaningful gauges before any disk I/O exists.
 */

import {
  emptyCacheMetrics,
  type SessionMetaView,
} from '@context-action/session-core';
import type { SessionOutline } from '@context-action/session-core/outline';
import {
  BranchUnsupportedError,
  type BranchProgressEvent,
  type BranchRequest,
  type BranchResult,
  type OutlineProgressEvent,
  type ProjectListItem,
  type SessionDataSource,
} from '../../shared/dataSource';

const ADAPTER_NAME = 'mock';

interface SyntheticSession {
  sessionId: string;
  projectId: string;
  toolId: 'claude' | 'codex' | 'gemini';
  fingerprintHash: string;
  inputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  outputTokens: number;
  costUsd: number;
  turns: number;
  durationMs: number;
}

function buildView(s: SyntheticSession): SessionMetaView {
  const metrics = emptyCacheMetrics();
  metrics.inputTokens = s.inputTokens;
  metrics.outputTokens = s.outputTokens;
  metrics.cacheReadInputTokens = s.cacheReadInputTokens;
  metrics.cacheCreationInputTokens = s.cacheCreationInputTokens;
  metrics.costUsd = s.costUsd;
  metrics.turns = s.turns;
  metrics.durationMs = s.durationMs;
  const denom = metrics.cacheReadInputTokens + metrics.inputTokens;
  metrics.cacheHitRatio = denom > 0 ? metrics.cacheReadInputTokens / denom : 0;

  return {
    source: 'derived',
    sessionId: s.sessionId,
    fingerprintHash: s.fingerprintHash,
    metrics,
    toolId: s.toolId,
  };
}

const PROJECTS: ProjectListItem[] = [
  {
    id: 'proj-billing',
    path: '/Users/dev/work/billing-service',
    sessionCount: 4,
    toolId: 'claude',
  },
  {
    id: 'proj-ios-e2e',
    path: '/Users/dev/work/ios-e2e',
    sessionCount: 3,
    toolId: 'codex',
  },
  {
    id: 'proj-rfc-cache',
    path: '/Users/dev/notes/rfc-cache-sidecar',
    sessionCount: 2,
    toolId: 'gemini',
  },
];

const SESSIONS: SyntheticSession[] = [
  // High cache-hit, long live session (Claude)
  {
    sessionId: 'S-104A',
    projectId: 'proj-billing',
    toolId: 'claude',
    fingerprintHash: 'fp-billing-stripe-outbox',
    inputTokens: 3439,
    cacheReadInputTokens: 24902,
    cacheCreationInputTokens: 4120,
    outputTokens: 8714,
    costUsd: 0.142,
    turns: 24,
    durationMs: 1_047_000,
  },
  // Medium cache-hit, mid session (Codex)
  {
    sessionId: 'S-103F',
    projectId: 'proj-ios-e2e',
    toolId: 'codex',
    fingerprintHash: 'fp-ios-fixtures',
    inputTokens: 12898,
    cacheReadInputTokens: 39220,
    cacheCreationInputTokens: 7880,
    outputTokens: 11400,
    costUsd: 0.098,
    turns: 36,
    durationMs: 1_352_000,
  },
  // Low cache-hit (cold start, Gemini — no cache data on disk so synthetic)
  {
    sessionId: 'S-102B',
    projectId: 'proj-rfc-cache',
    toolId: 'gemini',
    fingerprintHash: 'fp-rfc-cache-sidecar',
    inputTokens: 11204,
    cacheReadInputTokens: 9180,
    cacheCreationInputTokens: 2300,
    outputTokens: 3210,
    costUsd: 0.067,
    turns: 9,
    durationMs: 132_000,
  },
  // No cache (regression case, Claude)
  {
    sessionId: 'S-101C',
    projectId: 'proj-billing',
    toolId: 'claude',
    fingerprintHash: 'fp-billing-stripe-outbox',
    inputTokens: 18800,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 18800,
    outputTokens: 4600,
    costUsd: 0.214,
    turns: 12,
    durationMs: 184_000,
  },
];

export class MockSessionDataSource implements SessionDataSource {
  describe() {
    return { adapter: ADAPTER_NAME, readonly: true };
  }

  async listProjects(): Promise<ProjectListItem[]> {
    return PROJECTS;
  }

  async listSessions(projectId: string): Promise<SessionMetaView[]> {
    return SESSIONS.filter((s) => s.projectId === projectId).map(buildView);
  }

  async branch(_request: BranchRequest): Promise<BranchResult> {
    throw new BranchUnsupportedError(ADAPTER_NAME);
  }

  subscribeProgress(_listener: (event: BranchProgressEvent) => void): () => void {
    // The mock adapter never spawns a CLI, so no progress to surface.
    return () => undefined;
  }

  async listSummaries() {
    return [];
  }

  async getSummary() {
    return null;
  }

  async deleteSummary() {
    /* no-op */
  }

  async getOutline(sessionId: string): Promise<SessionOutline | null> {
    // Synthetic outline so the mock viewer can demo the Outline tab
    // without a real session backing it. Two segments, mixed kinds.
    const generatedAt = new Date().toISOString();
    return {
      toolId: 'claude',
      sourceSessionId: sessionId,
      cwd: '/mock/project',
      generatedAt,
      steps: [
        {
          index: 0,
          kind: 'meta',
          turnIndex: 0,
          blockIndex: 0,
          excerpt: 'system_init (mock)',
        },
        {
          index: 1,
          kind: 'user-instruction',
          turnIndex: 1,
          blockIndex: 0,
          excerpt: 'List the files in src',
        },
        {
          index: 2,
          kind: 'thinking',
          turnIndex: 1,
          blockIndex: 1,
          excerpt: 'plan: rg -l "src"',
          description: 'plans a recursive listing',
        },
        {
          index: 3,
          kind: 'tool-call',
          turnIndex: 1,
          blockIndex: 2,
          toolName: 'Bash',
          excerpt: '{"command":"ls src"}',
          description: 'lists src/ directory',
        },
        {
          index: 4,
          kind: 'tool-result',
          turnIndex: 1,
          blockIndex: 3,
          toolName: 'Bash',
          excerpt: 'a.ts\nb.ts\nc.ts',
          description: 'finds three files',
        },
        {
          index: 5,
          kind: 'assistant-text',
          turnIndex: 1,
          blockIndex: 4,
          excerpt: 'There are three files in src.',
          description: 'reports the count',
        },
      ],
      segments: [
        {
          openedByStep: null,
          closedByStep: 1,
          userInstructionExcerpt: '',
          steps: [
            {
              index: 0,
              kind: 'meta',
              turnIndex: 0,
              blockIndex: 0,
              excerpt: 'system_init (mock)',
            },
          ],
        },
        {
          openedByStep: 1,
          closedByStep: null,
          userInstructionExcerpt: 'List the files in src',
          steps: [
            {
              index: 2,
              kind: 'thinking',
              turnIndex: 1,
              blockIndex: 1,
              excerpt: 'plan: rg -l "src"',
              description: 'plans a recursive listing',
            },
            {
              index: 3,
              kind: 'tool-call',
              turnIndex: 1,
              blockIndex: 2,
              toolName: 'Bash',
              excerpt: '{"command":"ls src"}',
              description: 'lists src/ directory',
            },
            {
              index: 4,
              kind: 'tool-result',
              turnIndex: 1,
              blockIndex: 3,
              toolName: 'Bash',
              excerpt: 'a.ts\nb.ts\nc.ts',
              description: 'finds three files',
            },
            {
              index: 5,
              kind: 'assistant-text',
              turnIndex: 1,
              blockIndex: 4,
              excerpt: 'There are three files in src.',
              description: 'reports the count',
            },
          ],
        },
      ],
    };
  }

  async annotateOutline(_sessionId: string): Promise<SessionOutline> {
    throw new BranchUnsupportedError(ADAPTER_NAME);
  }

  subscribeOutlineProgress(
    _listener: (event: OutlineProgressEvent) => void,
  ): () => void {
    return () => undefined;
  }

  async deleteOutline(): Promise<void> {
    /* no-op */
  }
}
