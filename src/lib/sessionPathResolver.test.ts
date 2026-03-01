import { describe, expect, it } from 'vitest';
import {
  extractSessionPathFromEvent,
  inferProjectPathFromDashDirName,
  resolveSessionPath,
} from './sessionPathResolver';

describe('sessionPathResolver', () => {
  it('extracts cwd from top-level session event payload', () => {
    const event = {
      type: 'system',
      subtype: 'init',
      cwd: '/Users/test/workspace/agent-town',
    };

    expect(extractSessionPathFromEvent(event)).toBe('/Users/test/workspace/agent-town');
  });

  it('extracts project path from nested metadata payload', () => {
    const event = {
      type: 'session_meta',
      metadata: {
        projectPath: '/Users/test/workspace/agent_town',
      },
    };

    expect(extractSessionPathFromEvent(event)).toBe('/Users/test/workspace/agent_town');
  });

  it('normalizes file:// URI path from metadata payload', () => {
    const event = {
      type: 'session_meta',
      session: {
        cwd: 'file:///Users/test/workspace/agent.town',
      },
    };

    expect(extractSessionPathFromEvent(event)).toBe('/Users/test/workspace/agent.town');
  });

  it('keeps fallback directory-name inference isolated from default resolution', () => {
    const inferred = inferProjectPathFromDashDirName('-Users-test-workspace-agent-town');

    expect(
      resolveSessionPath({
        explicitPath: '/Users/test/workspace/agent-town',
        inferredPath: inferred,
        safeDefaultPath: '/safe-default',
      }),
    ).toBe('/Users/test/workspace/agent-town');
  });

  it.each([
    '/Users/test/.claude/skills/agent-town/SKILL.md',
    '/Users/test/.claude/skills/agent_town/SKILL.md',
    '/Users/test/.claude/skills/agent.town/SKILL.md',
  ])('prefers explicit path for special character case: %s', (explicitPath) => {
    const inferred = inferProjectPathFromDashDirName(
      '-Users-test-.claude-skills-agent-town-SKILL.md',
    );

    expect(
      resolveSessionPath({
        explicitPath,
        inferredPath: inferred,
        safeDefaultPath: '/safe-default',
      }),
    ).toBe(explicitPath);
  });

  it('uses inferred path only when explicit path is missing', () => {
    expect(
      resolveSessionPath({
        explicitPath: null,
        inferredPath: '/Users/test/workspace/agent/town',
        safeDefaultPath: '/safe-default',
      }),
    ).toBe('/Users/test/workspace/agent/town');
  });
});
