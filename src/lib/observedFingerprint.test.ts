import { describe, expect, it } from 'vitest';
import { detectDrift, extractObservedFingerprint } from './observedFingerprint';
import type { SystemInitEvent } from '../types/stream-events';
import type { StaticFingerprint } from '../types/prefix-fingerprint';

function init(overrides: Partial<SystemInitEvent> = {}): SystemInitEvent {
  return {
    type: 'system',
    subtype: 'init',
    cwd: '/tmp/x',
    session_id: 'sess-1',
    tools: ['Read', 'Edit'],
    mcp_servers: [{ name: 'serena', status: 'connected' }],
    model: 'claude-opus-4-7',
    permissionMode: 'default',
    slash_commands: ['help', 'clear'],
    apiKeySource: 'env',
    output_style: 'default',
    agents: ['planner'],
    uuid: 'u',
    ...overrides,
  };
}

describe('observedFingerprint', () => {
  it('produces the same hash regardless of input ordering', () => {
    const a = extractObservedFingerprint(init({ tools: ['Edit', 'Read'], slash_commands: ['clear', 'help'] }));
    const b = extractObservedFingerprint(init({ tools: ['Read', 'Edit'], slash_commands: ['help', 'clear'] }));
    expect(a.total).toBe(b.total);
    expect(a.components.tools).toBe(b.components.tools);
  });

  it('changes hash when a component changes', () => {
    const a = extractObservedFingerprint(init());
    const b = extractObservedFingerprint(init({ model: 'claude-sonnet-4-6' }));
    expect(a.total).not.toBe(b.total);
    expect(a.components.model).not.toBe(b.components.model);
  });

  it('detects presence drift on mcp and agents', () => {
    const staticFp: StaticFingerprint = {
      kind: 'static',
      total: 't',
      components: {
        claudeMd: 'c',
        imports: '',
        skills: '',
        agents: '', // static reports no agents
        mcpResolved: 'm', // static declares MCP
        systemPromptVersion: 'v',
      },
      sources: { claudeMdPath: null, importPaths: [], skillIds: [], agentIds: [], mcpConfigPath: null },
      computedAt: 0,
    };
    const observed = extractObservedFingerprint(init({
      mcp_servers: [], // observed reports no MCP
      agents: ['planner'], // but reports an agent
    }));
    const drift = detectDrift(staticFp, observed);
    expect(drift.detected).toBe(true);
    expect(drift.differingComponents).toEqual(expect.arrayContaining(['mcpResolved', 'agents']));
  });
});
