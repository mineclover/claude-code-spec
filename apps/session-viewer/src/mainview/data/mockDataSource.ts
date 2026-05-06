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
import {
  BranchUnsupportedError,
  type BranchRequest,
  type BranchResult,
  type ProjectListItem,
  type SessionDataSource,
} from '../../shared/dataSource';

const ADAPTER_NAME = 'mock';

interface SyntheticSession {
  sessionId: string;
  projectId: string;
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
  };
}

const PROJECTS: ProjectListItem[] = [
  { id: 'proj-billing', path: '/Users/dev/work/billing-service', sessionCount: 4 },
  { id: 'proj-ios-e2e', path: '/Users/dev/work/ios-e2e', sessionCount: 3 },
  { id: 'proj-rfc-cache', path: '/Users/dev/notes/rfc-cache-sidecar', sessionCount: 2 },
];

const SESSIONS: SyntheticSession[] = [
  // High cache-hit, long live session
  {
    sessionId: 'S-104A',
    projectId: 'proj-billing',
    fingerprintHash: 'fp-billing-stripe-outbox',
    inputTokens: 3439,
    cacheReadInputTokens: 24902,
    cacheCreationInputTokens: 4120,
    outputTokens: 8714,
    costUsd: 0.142,
    turns: 24,
    durationMs: 1_047_000,
  },
  // Medium cache-hit, mid session
  {
    sessionId: 'S-103F',
    projectId: 'proj-ios-e2e',
    fingerprintHash: 'fp-ios-fixtures',
    inputTokens: 12898,
    cacheReadInputTokens: 39220,
    cacheCreationInputTokens: 7880,
    outputTokens: 11400,
    costUsd: 0.098,
    turns: 36,
    durationMs: 1_352_000,
  },
  // Low cache-hit (cold start)
  {
    sessionId: 'S-102B',
    projectId: 'proj-rfc-cache',
    fingerprintHash: 'fp-rfc-cache-sidecar',
    inputTokens: 11204,
    cacheReadInputTokens: 9180,
    cacheCreationInputTokens: 2300,
    outputTokens: 3210,
    costUsd: 0.067,
    turns: 9,
    durationMs: 132_000,
  },
  // No cache (regression case)
  {
    sessionId: 'S-101C',
    projectId: 'proj-billing',
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
}
