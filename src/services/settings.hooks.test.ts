import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listActiveHooks } from './settings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeSettingsJson(filePath: string, content: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
}

function userSettingsPath(tempHome: string): string {
  return path.join(tempHome, '.claude', 'settings.json');
}

function projectSettingsPath(projectRoot: string): string {
  return path.join(projectRoot, '.claude', 'settings.json');
}

// ---------------------------------------------------------------------------
// Test fixture: minimal valid hooks JSON
// ---------------------------------------------------------------------------

const HOOKS_WITH_PRE_AND_POST = {
  hooks: {
    PreToolUse: [
      {
        matcher: 'Bash',
        hooks: [{ type: 'command', command: 'echo pre-bash' }],
      },
    ],
    PostToolUse: [
      {
        hooks: [{ type: 'command', command: 'echo post-any', timeout: 5 }],
      },
    ],
  },
};

const HOOKS_STOP_AND_NOTIFY = {
  hooks: {
    Stop: [{ hooks: [{ type: 'command', command: 'notify-send stop', background: true }] }],
    Notification: [
      { matcher: '.*', hooks: [{ type: 'command', command: 'terminal-notifier' }] },
    ],
  },
};

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let tempRoot = '';
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-test-'));
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  // Point os.homedir() at the temp directory
  process.env.HOME = tempRoot;
  delete process.env.USERPROFILE;
});

afterEach(() => {
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  if (originalUserProfile === undefined) {
    delete process.env.USERPROFILE;
  } else {
    process.env.USERPROFILE = originalUserProfile;
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('listActiveHooks — file existence', () => {
  it('returns empty items and exists=false when neither settings file exists', () => {
    const result = listActiveHooks();

    expect(result.items).toHaveLength(0);
    expect(result.userSettingsExists).toBe(false);
    expect(result.projectSettingsExists).toBe(false);
    expect(result.userSettingsPath).toBe(path.join(tempRoot, '.claude', 'settings.json'));
    expect(result.projectSettingsPath).toBeNull();
    expect(result.userError).toBeUndefined();
    expect(result.projectError).toBeUndefined();
  });

  it('reports correct paths when a project is provided but settings file is absent', () => {
    const projectRoot = path.join(tempRoot, 'my-project');
    fs.mkdirSync(projectRoot, { recursive: true });

    const result = listActiveHooks(projectRoot);

    expect(result.projectSettingsPath).toBe(
      path.join(projectRoot, '.claude', 'settings.json'),
    );
    expect(result.projectSettingsExists).toBe(false);
    expect(result.items).toHaveLength(0);
  });

  it('sets userSettingsExists=true when user settings file is present', () => {
    writeSettingsJson(userSettingsPath(tempRoot), { hooks: {} });

    const result = listActiveHooks();

    expect(result.userSettingsExists).toBe(true);
    expect(result.items).toHaveLength(0);
  });

  it('sets projectSettingsExists=true when project settings file is present', () => {
    const projectRoot = path.join(tempRoot, 'proj');
    writeSettingsJson(projectSettingsPath(projectRoot), { hooks: {} });

    const result = listActiveHooks(projectRoot);

    expect(result.projectSettingsExists).toBe(true);
    expect(result.items).toHaveLength(0);
  });
});

describe('listActiveHooks — user scope parsing', () => {
  it('parses PreToolUse hook with matcher from user settings', () => {
    writeSettingsJson(userSettingsPath(tempRoot), HOOKS_WITH_PRE_AND_POST);

    const result = listActiveHooks();

    const pre = result.items.find((h) => h.event === 'PreToolUse');
    expect(pre).toBeDefined();
    expect(pre?.scope).toBe('user');
    expect(pre?.matcher).toBe('Bash');
    expect(pre?.command).toBe('echo pre-bash');
    expect(pre?.timeout).toBeUndefined();
    expect(pre?.background).toBeUndefined();
  });

  it('parses PostToolUse hook without matcher, with timeout', () => {
    writeSettingsJson(userSettingsPath(tempRoot), HOOKS_WITH_PRE_AND_POST);

    const result = listActiveHooks();

    const post = result.items.find((h) => h.event === 'PostToolUse');
    expect(post).toBeDefined();
    expect(post?.matcher).toBeUndefined();
    expect(post?.command).toBe('echo post-any');
    expect(post?.timeout).toBe(5);
  });

  it('parses Stop hook with background=true', () => {
    writeSettingsJson(userSettingsPath(tempRoot), HOOKS_STOP_AND_NOTIFY);

    const result = listActiveHooks();

    const stop = result.items.find((h) => h.event === 'Stop');
    expect(stop?.command).toBe('notify-send stop');
    expect(stop?.background).toBe(true);
  });

  it('parses Notification hook with matcher pattern', () => {
    writeSettingsJson(userSettingsPath(tempRoot), HOOKS_STOP_AND_NOTIFY);

    const result = listActiveHooks();

    const notify = result.items.find((h) => h.event === 'Notification');
    expect(notify?.matcher).toBe('.*');
    expect(notify?.command).toBe('terminal-notifier');
  });

  it('parses SubagentStop event', () => {
    writeSettingsJson(userSettingsPath(tempRoot), {
      hooks: {
        SubagentStop: [{ hooks: [{ type: 'command', command: 'echo subagent-done' }] }],
      },
    });

    const result = listActiveHooks();

    const sub = result.items.find((h) => h.event === 'SubagentStop');
    expect(sub?.command).toBe('echo subagent-done');
    expect(sub?.scope).toBe('user');
  });

  it('assigns scope=user and correct scopePath for all user items', () => {
    writeSettingsJson(userSettingsPath(tempRoot), HOOKS_WITH_PRE_AND_POST);

    const result = listActiveHooks();

    for (const item of result.items) {
      expect(item.scope).toBe('user');
      expect(item.scopePath).toBe(userSettingsPath(tempRoot));
    }
  });

  it('generates unique ids for all items', () => {
    writeSettingsJson(userSettingsPath(tempRoot), {
      hooks: {
        PreToolUse: [
          {
            hooks: [
              { type: 'command', command: 'cmd-a' },
              { type: 'command', command: 'cmd-b' },
            ],
          },
        ],
        PostToolUse: [{ hooks: [{ type: 'command', command: 'cmd-c' }] }],
      },
    });

    const result = listActiveHooks();
    const ids = result.items.map((h) => h.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('listActiveHooks — project scope parsing', () => {
  it('parses hooks from project settings with scope=project', () => {
    const projectRoot = path.join(tempRoot, 'proj');
    writeSettingsJson(projectSettingsPath(projectRoot), HOOKS_WITH_PRE_AND_POST);

    const result = listActiveHooks(projectRoot);

    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(item.scope).toBe('project');
      expect(item.scopePath).toBe(projectSettingsPath(projectRoot));
    }
  });

  it('returns no project items when no project path is given', () => {
    const projectRoot = path.join(tempRoot, 'proj');
    writeSettingsJson(projectSettingsPath(projectRoot), HOOKS_WITH_PRE_AND_POST);

    // call without projectPath — project file should be ignored
    const result = listActiveHooks();

    expect(result.items.filter((h) => h.scope === 'project')).toHaveLength(0);
  });
});

describe('listActiveHooks — combined user + project', () => {
  it('merges hooks from both scopes, user items before project items', () => {
    const projectRoot = path.join(tempRoot, 'proj');
    writeSettingsJson(userSettingsPath(tempRoot), {
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'user-stop' }] }],
      },
    });
    writeSettingsJson(projectSettingsPath(projectRoot), {
      hooks: {
        PreToolUse: [{ hooks: [{ type: 'command', command: 'project-pre' }] }],
      },
    });

    const result = listActiveHooks(projectRoot);

    const userItems = result.items.filter((h) => h.scope === 'user');
    const projItems = result.items.filter((h) => h.scope === 'project');

    expect(userItems).toHaveLength(1);
    expect(userItems[0].command).toBe('user-stop');
    expect(projItems).toHaveLength(1);
    expect(projItems[0].command).toBe('project-pre');

    // user items appear before project items in the array
    const userIdx = result.items.indexOf(userItems[0]);
    const projIdx = result.items.indexOf(projItems[0]);
    expect(userIdx).toBeLessThan(projIdx);
  });

  it('handles the same event in both scopes independently', () => {
    const projectRoot = path.join(tempRoot, 'proj');
    writeSettingsJson(userSettingsPath(tempRoot), {
      hooks: {
        PreToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'user-pre' }] }],
      },
    });
    writeSettingsJson(projectSettingsPath(projectRoot), {
      hooks: {
        PreToolUse: [
          { matcher: 'Read', hooks: [{ type: 'command', command: 'proj-pre' }] },
        ],
      },
    });

    const result = listActiveHooks(projectRoot);
    const preHooks = result.items.filter((h) => h.event === 'PreToolUse');

    expect(preHooks).toHaveLength(2);
    expect(preHooks.map((h) => h.command)).toContain('user-pre');
    expect(preHooks.map((h) => h.command)).toContain('proj-pre');
  });
});

describe('listActiveHooks — multiple matchers and hooks per event', () => {
  it('expands multiple matchers under the same event', () => {
    writeSettingsJson(userSettingsPath(tempRoot), {
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'cmd-bash' }] },
          { matcher: 'Write', hooks: [{ type: 'command', command: 'cmd-write' }] },
          {
            matcher: 'Read',
            hooks: [
              { type: 'command', command: 'cmd-read-a' },
              { type: 'command', command: 'cmd-read-b' },
            ],
          },
        ],
      },
    });

    const result = listActiveHooks();
    const preHooks = result.items.filter((h) => h.event === 'PreToolUse');

    expect(preHooks).toHaveLength(4);
    expect(preHooks.map((h) => h.matcher)).toEqual(['Bash', 'Write', 'Read', 'Read']);
    expect(preHooks.map((h) => h.command)).toEqual([
      'cmd-bash',
      'cmd-write',
      'cmd-read-a',
      'cmd-read-b',
    ]);
  });
});

describe('listActiveHooks — edge cases and error handling', () => {
  it('ignores hooks with missing commands', () => {
    writeSettingsJson(userSettingsPath(tempRoot), {
      hooks: {
        PreToolUse: [
          {
            hooks: [
              { type: 'command', command: '' },
              { type: 'command' /* no command key */ },
              { type: 'command', command: 'valid-cmd' },
            ],
          },
        ],
      },
    });

    const result = listActiveHooks();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].command).toBe('valid-cmd');
  });

  it('ignores hooks with non-command type', () => {
    writeSettingsJson(userSettingsPath(tempRoot), {
      hooks: {
        Stop: [
          {
            hooks: [
              { type: 'webhook', url: 'https://example.com' },
              { type: 'command', command: 'valid' },
            ],
          },
        ],
      },
    });

    const result = listActiveHooks();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].command).toBe('valid');
  });

  it('returns empty items when settings.json has no hooks key', () => {
    writeSettingsJson(userSettingsPath(tempRoot), {
      permissions: { allowList: ['*'] },
    });

    const result = listActiveHooks();

    expect(result.items).toHaveLength(0);
    expect(result.userSettingsExists).toBe(true);
    expect(result.userError).toBeUndefined();
  });

  it('returns error and empty items when settings.json contains invalid JSON', () => {
    const p = userSettingsPath(tempRoot);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '{ "hooks": { INVALID JSON }', 'utf-8');

    const result = listActiveHooks();

    expect(result.items).toHaveLength(0);
    expect(result.userSettingsExists).toBe(true);
    expect(result.userError).toBeDefined();
    expect(typeof result.userError).toBe('string');
  });

  it('returns error for project settings and still returns user hooks', () => {
    const projectRoot = path.join(tempRoot, 'proj');
    writeSettingsJson(userSettingsPath(tempRoot), {
      hooks: { Stop: [{ hooks: [{ type: 'command', command: 'user-stop' }] }] },
    });
    const pPath = projectSettingsPath(projectRoot);
    fs.mkdirSync(path.dirname(pPath), { recursive: true });
    fs.writeFileSync(pPath, 'NOT JSON AT ALL', 'utf-8');

    const result = listActiveHooks(projectRoot);

    expect(result.userError).toBeUndefined();
    expect(result.projectError).toBeDefined();
    expect(result.items.filter((h) => h.scope === 'user')).toHaveLength(1);
    expect(result.items.filter((h) => h.scope === 'project')).toHaveLength(0);
  });

  it('ignores unknown event names not in the known event list', () => {
    writeSettingsJson(userSettingsPath(tempRoot), {
      hooks: {
        UnknownEvent: [{ hooks: [{ type: 'command', command: 'unknown-cmd' }] }],
        PreToolUse: [{ hooks: [{ type: 'command', command: 'known-cmd' }] }],
      },
    });

    const result = listActiveHooks();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].command).toBe('known-cmd');
  });

  it('ignores matcher entries whose hooks field is not an array', () => {
    writeSettingsJson(userSettingsPath(tempRoot), {
      hooks: {
        PreToolUse: [
          { hooks: 'not-an-array' },
          { hooks: [{ type: 'command', command: 'valid' }] },
        ],
      },
    });

    const result = listActiveHooks();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].command).toBe('valid');
  });

  it('handles hooks key being null gracefully', () => {
    writeSettingsJson(userSettingsPath(tempRoot), { hooks: null });

    const result = listActiveHooks();

    expect(result.items).toHaveLength(0);
    expect(result.userError).toBeUndefined();
  });

  it('handles event value being null/non-array gracefully', () => {
    writeSettingsJson(userSettingsPath(tempRoot), {
      hooks: {
        PreToolUse: null,
        PostToolUse: 'not-an-array',
        Stop: [{ hooks: [{ type: 'command', command: 'valid' }] }],
      },
    });

    const result = listActiveHooks();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].event).toBe('Stop');
  });
});
