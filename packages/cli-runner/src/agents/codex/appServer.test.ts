/**
 * Integration tests for CodexAppServerClient — drive a fixture stub
 * (`test-fixtures/fake-codex-app-server.mjs`) that speaks just enough
 * of the JSON-RPC protocol to validate handshake, fork, and turn flow.
 *
 * Hits real `spawn` + stdio framing rather than mocking the protocol,
 * because the protocol shape is precisely what we want to pin.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { CodexAppServerClient } from './appServer';

const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'test-fixtures',
  'fake-codex-app-server.mjs',
);

let activeClient: CodexAppServerClient | null = null;

afterEach(async () => {
  if (activeClient) {
    await activeClient.shutdown().catch(() => undefined);
    activeClient = null;
  }
});

async function startClient(env: NodeJS.ProcessEnv = {}): Promise<CodexAppServerClient> {
  const client = await CodexAppServerClient.start({
    cwd: tmpdir(),
    command: FIXTURE_PATH,
    env: { ...process.env, ...env },
  });
  activeClient = client;
  return client;
}

describe('CodexAppServerClient — handshake + turn lifecycle', () => {
  it('initializes, forks a thread, and runs a turn end-to-end', async () => {
    const client = await startClient();
    const fork = (await client.request('thread/fork', {
      threadId: 'src-1',
      ephemeral: true,
      cwd: tmpdir(),
    })) as { thread: { id: string } };
    expect(fork.thread.id).toMatch(/^fork-thread-/);

    const result = await client.runTurn(
      { threadId: fork.thread.id, prompt: 'tag these steps' },
      { timeoutMs: 5_000 },
    );
    expect(result.status).toBe('completed');
    expect(result.finalAgentMessage).toContain('descriptions');
    expect(result.tokenUsage?.last.cachedInputTokens).toBe(1500);
    expect(result.durationMs).toBe(1234);
    expect(result.attemptedTool).toBe(false);
  });

  it('surfaces a turn/failed event as a rejection', async () => {
    const client = await startClient({ FAKE_CODEX_FAIL_TURN: '1' });
    const fork = (await client.request('thread/fork', {
      threadId: 'src-1',
      ephemeral: true,
    })) as { thread: { id: string } };
    await expect(
      client.runTurn(
        { threadId: fork.thread.id, prompt: 'fail' },
        { timeoutMs: 5_000 },
      ),
    ).rejects.toThrow(/turn\/failed/);
  });

  it('auto-denies a reverse-RPC approval mid-turn without crashing', async () => {
    const client = await startClient({ FAKE_CODEX_REVERSE_RPC: '1' });
    const fork = (await client.request('thread/fork', {
      threadId: 'src-1',
      ephemeral: true,
    })) as { thread: { id: string } };
    const result = await client.runTurn(
      { threadId: fork.thread.id, prompt: 'try something dangerous' },
      { timeoutMs: 5_000 },
    );
    // Auto-deny is fire-and-forget — the test passes if the turn
    // completes despite the server-initiated approval midstream.
    expect(result.status).toBe('completed');
  });

  it('rejects pending requests with a useful error when init fails', async () => {
    await expect(startClient({ FAKE_CODEX_INVALID_INIT: '1' })).rejects.toThrow(
      /initialize failed/,
    );
  });

  it('forwards onItem callbacks for agent messages', async () => {
    const client = await startClient();
    const fork = (await client.request('thread/fork', {
      threadId: 'src-1',
      ephemeral: true,
    })) as { thread: { id: string } };
    const seen: string[] = [];
    await client.runTurn(
      { threadId: fork.thread.id, prompt: 'hi' },
      {
        timeoutMs: 5_000,
        onItem: (item) => {
          if (item.type === 'agentMessage' && typeof item.text === 'string') {
            seen.push(item.text);
          }
        },
      },
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('descriptions');
  });
});
