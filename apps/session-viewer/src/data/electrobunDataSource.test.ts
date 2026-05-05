/**
 * Wiring tests for the Electrobun-backed SessionDataSource.
 *
 * The actual Electrobun runtime needs a hosting BrowserWindow + websocket
 * transport that we can't (and shouldn't) stand up in unit tests. Instead
 * we feed the adapter a stub `rpc` shaped like the real one and verify:
 *   - request.* calls are forwarded with the expected params
 *   - the description handshake is cached after the first listProjects()
 *   - the adapter translates "not implemented" branch errors into
 *     BranchUnsupportedError
 */

import { describe, expect, it, vi } from 'vitest';
import { BranchUnsupportedError } from './dataSource';
import {
  ElectrobunSessionDataSource,
  type ElectrobunRpcClient,
} from './electrobunDataSource';

function makeRpc(overrides: Partial<ElectrobunRpcClient['request']> = {}): {
  rpc: ElectrobunRpcClient;
  describeAdapter: ReturnType<typeof vi.fn>;
  listProjects: ReturnType<typeof vi.fn>;
  listSessions: ReturnType<typeof vi.fn>;
  branch: ReturnType<typeof vi.fn>;
} {
  const describeAdapter = vi.fn(async () => ({
    adapter: 'electrobun',
    readonly: true,
  }));
  const listProjects = vi.fn(async () => []);
  const listSessions = vi.fn(async () => []);
  const branch = vi.fn(async () => {
    throw new Error('branch: not implemented in PoC adapter');
  });
  const rpc: ElectrobunRpcClient = {
    request: { describeAdapter, listProjects, listSessions, branch, ...overrides },
    send: { logToBun: vi.fn() },
  };
  return { rpc, describeAdapter, listProjects, listSessions, branch };
}

describe('ElectrobunSessionDataSource', () => {
  it('reports a placeholder description before the first list call', () => {
    const { rpc } = makeRpc();
    const ds = new ElectrobunSessionDataSource(rpc);
    expect(ds.describe()).toMatchObject({
      adapter: expect.stringContaining('electrobun'),
    });
  });

  it('caches describeAdapter handshake after first listProjects', async () => {
    const { rpc, describeAdapter } = makeRpc();
    const ds = new ElectrobunSessionDataSource(rpc);
    await ds.listProjects();
    await ds.listProjects();
    expect(describeAdapter).toHaveBeenCalledTimes(1);
    expect(ds.describe()).toEqual({ adapter: 'electrobun', readonly: true });
  });

  it('forwards listSessions params unchanged', async () => {
    const { rpc, listSessions } = makeRpc();
    const ds = new ElectrobunSessionDataSource(rpc);
    await ds.listSessions('proj-billing');
    expect(listSessions).toHaveBeenCalledWith({ projectId: 'proj-billing' });
  });

  it('translates "not implemented" branch error to BranchUnsupportedError', async () => {
    const { rpc } = makeRpc();
    const ds = new ElectrobunSessionDataSource(rpc);
    await expect(
      ds.branch({ sessionId: 'S-1', evaluationPrompt: 'eval' }),
    ).rejects.toBeInstanceOf(BranchUnsupportedError);
  });

  it('rethrows non-unsupported errors verbatim', async () => {
    const { rpc, branch } = makeRpc();
    branch.mockImplementationOnce(async () => {
      throw new Error('socket disconnected');
    });
    const ds = new ElectrobunSessionDataSource(rpc);
    await expect(
      ds.branch({ sessionId: 'S-1', evaluationPrompt: 'eval' }),
    ).rejects.toThrow('socket disconnected');
  });
});
