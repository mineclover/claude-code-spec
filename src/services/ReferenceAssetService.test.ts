import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ReferenceAssetService } from './ReferenceAssetService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempReferencesRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'reference-assets-test-'));
}

function writeFile(targetPath: string, content = '# placeholder'): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf-8');
}

// Both dirs are scanned under the 'claude' provider
function moaiHooksDir(root: string): string {
  return path.join(root, 'moai-adk-upstream/.claude/hooks');
}
function moaiOutputStylesDir(root: string): string {
  return path.join(root, 'moai-adk-upstream/.claude/output-styles');
}
function moaiSkillsDir(root: string): string {
  return path.join(root, 'moai-adk-upstream/.claude/skills');
}
function ralphHooksDir(root: string): string {
  return path.join(root, 'ralph-tui-upstream/.claude/hooks');
}
function ralphOutputStylesDir(root: string): string {
  return path.join(root, 'ralph-tui-upstream/.claude/output-styles');
}
function ralphSkillsDir(root: string): string {
  return path.join(root, 'ralph-tui-upstream/.claude/skills');
}

// ---------------------------------------------------------------------------

const tempRoots: string[] = [];

afterEach(() => {
  for (const r of tempRoots) fs.rmSync(r, { recursive: true, force: true });
  tempRoots.length = 0;
});

function makeRoot(): string {
  const r = createTempReferencesRoot();
  tempRoots.push(r);
  return r;
}

// ===========================================================================
// HOOKS
// ===========================================================================

describe('ReferenceAssetService — hooks', () => {
  it('scans moai upstream hooks under claude provider', () => {
    const root = makeRoot();
    writeFile(path.join(moaiHooksDir(root), 'pre-commit.sh'));

    const items = new ReferenceAssetService(root).listAssets('hooks');

    expect(items).toHaveLength(1);
    expect(items[0].provider).toBe('claude');
    expect(items[0].type).toBe('hooks');
    expect(items[0].name).toBe('pre-commit.sh');
    expect(items[0].relativePath).toContain(
      path.join('moai-adk-upstream/.claude/hooks/pre-commit.sh'),
    );
    expect(items[0].sourceRoot).toContain('moai-adk-upstream/.claude/hooks');
  });

  it('scans ralph upstream hooks under claude provider', () => {
    const root = makeRoot();
    writeFile(path.join(ralphHooksDir(root), 'session-hook.md'));

    const items = new ReferenceAssetService(root).listAssets('hooks');

    expect(items).toHaveLength(1);
    expect(items[0].provider).toBe('claude');
    expect(items[0].sourceRoot).toContain(path.join('ralph-tui-upstream/.claude/hooks'));
  });

  it('accepts all allowed hook extensions', () => {
    const root = makeRoot();
    const dir = moaiHooksDir(root);
    const allowedExts = ['.md', '.json', '.yaml', '.yml', '.sh', '.js', '.ts'];
    for (const ext of allowedExts) writeFile(path.join(dir, `hook${ext}`));

    const items = new ReferenceAssetService(root).listAssets('hooks', 'claude');

    expect(items).toHaveLength(allowedExts.length);
    const names = items.map((i) => i.name);
    for (const ext of allowedExts) expect(names).toContain(`hook${ext}`);
  });

  it('rejects disallowed hook extensions', () => {
    const root = makeRoot();
    const dir = moaiHooksDir(root);
    const disallowed = ['.txt', '.css', '.toml', '.png', '.exe', '.py'];
    for (const ext of disallowed) writeFile(path.join(dir, `hook${ext}`));
    writeFile(path.join(dir, 'valid.sh')); // one valid file

    const items = new ReferenceAssetService(root).listAssets('hooks', 'claude');

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('valid.sh');
  });

  it('scans nested directories recursively', () => {
    const root = makeRoot();
    writeFile(path.join(moaiHooksDir(root), 'group/sub/deep-hook.md'));
    writeFile(path.join(moaiHooksDir(root), 'top-hook.sh'));

    const items = new ReferenceAssetService(root).listAssets('hooks', 'claude');

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.name).sort()).toEqual(['deep-hook.md', 'top-hook.sh'].sort());
  });

  it('skips hidden files and directories (names starting with .)', () => {
    const root = makeRoot();
    writeFile(path.join(moaiHooksDir(root), '.hidden-hook.sh'));
    writeFile(path.join(moaiHooksDir(root), '.hidden-dir/hook.sh'));
    writeFile(path.join(moaiHooksDir(root), 'visible.sh'));

    const items = new ReferenceAssetService(root).listAssets('hooks', 'claude');

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('visible.sh');
  });

  it('returns empty list when hooks directory does not exist', () => {
    const root = makeRoot();
    // No directories created

    const items = new ReferenceAssetService(root).listAssets('hooks');

    expect(items).toHaveLength(0);
  });

  it('filters by provider — claude scans both upstream dirs', () => {
    const root = makeRoot();
    writeFile(path.join(moaiHooksDir(root), 'moai-hook.md'));
    writeFile(path.join(ralphHooksDir(root), 'ralph-hook.md'));

    const items = new ReferenceAssetService(root).listAssets('hooks', 'claude');

    expect(items).toHaveLength(2);
    expect(items.every((i) => i.provider === 'claude')).toBe(true);
  });

  it('returns empty for gemini provider (no upstream reference dirs)', () => {
    const root = makeRoot();
    writeFile(path.join(moaiHooksDir(root), 'moai-hook.md'));

    const items = new ReferenceAssetService(root).listAssets('hooks', 'gemini');

    expect(items).toHaveLength(0);
  });

  it('returns empty for codex provider (no upstream reference dirs)', () => {
    const root = makeRoot();
    writeFile(path.join(moaiHooksDir(root), 'moai-hook.md'));

    const items = new ReferenceAssetService(root).listAssets('hooks', 'codex');

    expect(items).toHaveLength(0);
  });

  it('returns all claude items when no provider filter is given', () => {
    const root = makeRoot();
    writeFile(path.join(moaiHooksDir(root), 'moai-hook.md'));
    writeFile(path.join(ralphHooksDir(root), 'ralph-hook.md'));

    const items = new ReferenceAssetService(root).listAssets('hooks');

    expect(items).toHaveLength(2);
    expect(items.every((i) => i.provider === 'claude')).toBe(true);
  });

  it('sorts by relativePath within provider', () => {
    const root = makeRoot();
    writeFile(path.join(moaiHooksDir(root), 'z-hook.md'));
    writeFile(path.join(moaiHooksDir(root), 'a-hook.md'));
    writeFile(path.join(ralphHooksDir(root), 'r-hook.md'));

    const items = new ReferenceAssetService(root).listAssets('hooks');

    // moai-adk-upstream sorts before ralph-tui-upstream, a before z
    expect(items[0].name).toBe('a-hook.md');
    expect(items[1].name).toBe('z-hook.md');
    expect(items[2].name).toBe('r-hook.md');
  });

  it('item id has format provider:type:relativePath', () => {
    const root = makeRoot();
    writeFile(path.join(moaiHooksDir(root), 'my-hook.sh'));

    const items = new ReferenceAssetService(root).listAssets('hooks', 'claude');

    expect(items[0].id).toMatch(/^claude:hooks:/);
    expect(items[0].id).toContain('my-hook.sh');
  });

  it('updatedAt reflects file mtime', () => {
    const root = makeRoot();
    const filePath = path.join(moaiHooksDir(root), 'hook.md');
    writeFile(filePath);
    const mtime = fs.statSync(filePath).mtimeMs;

    const items = new ReferenceAssetService(root).listAssets('hooks', 'claude');

    expect(items[0].updatedAt).toBeCloseTo(mtime, -1);
  });
});

// ===========================================================================
// OUTPUT STYLES
// ===========================================================================

describe('ReferenceAssetService — outputStyles', () => {
  it('scans moai output styles from .claude/output-styles', () => {
    const root = makeRoot();
    writeFile(path.join(moaiOutputStylesDir(root), 'dark.css'));

    const items = new ReferenceAssetService(root).listAssets('outputStyles', 'claude');

    expect(items).toHaveLength(1);
    expect(items[0].provider).toBe('claude');
    expect(items[0].name).toBe('dark.css');
    expect(items[0].sourceRoot).toContain('moai-adk-upstream/.claude/output-styles');
  });

  it('scans ralph output styles from .claude/output-styles', () => {
    const root = makeRoot();
    writeFile(path.join(ralphOutputStylesDir(root), 'main.css'));
    writeFile(path.join(ralphOutputStylesDir(root), 'dark.toml'));

    const items = new ReferenceAssetService(root).listAssets('outputStyles', 'claude');

    // Both moai and ralph are aggregated under claude
    expect(items).toHaveLength(2);
    const names = items.map((i) => i.name);
    expect(names).toContain('main.css');
    expect(names).toContain('dark.toml');
  });

  it('accepts all allowed output style extensions', () => {
    const root = makeRoot();
    const dir = moaiOutputStylesDir(root);
    const allowedExts = ['.md', '.json', '.yaml', '.yml', '.css', '.toml'];
    for (const ext of allowedExts) writeFile(path.join(dir, `style${ext}`));

    const items = new ReferenceAssetService(root).listAssets('outputStyles', 'claude');

    expect(items).toHaveLength(allowedExts.length);
  });

  it('rejects extensions not allowed for output styles (.sh .js .ts .txt)', () => {
    const root = makeRoot();
    const dir = moaiOutputStylesDir(root);
    const disallowed = ['.sh', '.js', '.ts', '.txt', '.png'];
    for (const ext of disallowed) writeFile(path.join(dir, `style${ext}`));
    writeFile(path.join(dir, 'valid.css'));

    const items = new ReferenceAssetService(root).listAssets('outputStyles', 'claude');

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('valid.css');
  });

  it('scans nested directories recursively', () => {
    const root = makeRoot();
    writeFile(path.join(moaiOutputStylesDir(root), 'themes/dark/dark.css'));
    writeFile(path.join(moaiOutputStylesDir(root), 'base.css'));

    const items = new ReferenceAssetService(root).listAssets('outputStyles', 'claude');

    expect(items).toHaveLength(2);
  });

  it('skips hidden files', () => {
    const root = makeRoot();
    writeFile(path.join(moaiOutputStylesDir(root), '.hidden.css'));
    writeFile(path.join(moaiOutputStylesDir(root), 'visible.css'));

    const items = new ReferenceAssetService(root).listAssets('outputStyles', 'claude');

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('visible.css');
  });

  it('returns empty list when output styles directory does not exist', () => {
    const root = makeRoot();

    const items = new ReferenceAssetService(root).listAssets('outputStyles');

    expect(items).toHaveLength(0);
  });

  it('ralph sourceRoot points to .claude/output-styles', () => {
    const root = makeRoot();
    writeFile(path.join(ralphOutputStylesDir(root), 'style.css'));

    const items = new ReferenceAssetService(root).listAssets('outputStyles', 'claude');

    const ralphItem = items.find((i) => i.sourceRoot.includes('ralph-tui-upstream'));
    expect(ralphItem?.sourceRoot).toContain('ralph-tui-upstream/.claude/output-styles');
  });
});

// ===========================================================================
// SKILLS
// ===========================================================================

describe('ReferenceAssetService — skills', () => {
  it('collects only SKILL.md files, not other .md files', () => {
    const root = makeRoot();
    writeFile(path.join(moaiSkillsDir(root), 'my-skill/SKILL.md'), '# skill');
    writeFile(path.join(moaiSkillsDir(root), 'my-skill/README.md'), '# readme');
    writeFile(path.join(moaiSkillsDir(root), 'my-skill/notes.md'), '# notes');

    const items = new ReferenceAssetService(root).listAssets('skills', 'claude');

    expect(items).toHaveLength(1);
    expect(items[0].relativePath).toContain('SKILL.md');
  });

  it('uses parent directory name as item name', () => {
    const root = makeRoot();
    writeFile(path.join(moaiSkillsDir(root), 'code-reviewer/SKILL.md'), '# skill');

    const items = new ReferenceAssetService(root).listAssets('skills', 'claude');

    expect(items[0].name).toBe('code-reviewer');
  });

  it('extracts description from YAML frontmatter', () => {
    const root = makeRoot();
    writeFile(
      path.join(moaiSkillsDir(root), 'my-skill/SKILL.md'),
      `---
name: my-skill
description: A helpful skill for reviewing code
version: 1.0.0
---
# My Skill
`,
    );

    const items = new ReferenceAssetService(root).listAssets('skills', 'claude');

    expect(items[0].description).toBe('A helpful skill for reviewing code');
  });

  it('sets description undefined when frontmatter has no description field', () => {
    const root = makeRoot();
    writeFile(
      path.join(moaiSkillsDir(root), 'no-desc/SKILL.md'),
      `---
name: no-desc
version: 1.0.0
---
# No description
`,
    );

    const items = new ReferenceAssetService(root).listAssets('skills', 'claude');

    expect(items[0].description).toBeUndefined();
  });

  it('sets description undefined when SKILL.md has no frontmatter', () => {
    const root = makeRoot();
    writeFile(
      path.join(moaiSkillsDir(root), 'plain/SKILL.md'),
      '# Plain skill without frontmatter',
    );

    const items = new ReferenceAssetService(root).listAssets('skills', 'claude');

    expect(items[0].description).toBeUndefined();
  });

  it('sets description undefined when frontmatter description is empty string', () => {
    const root = makeRoot();
    writeFile(
      path.join(moaiSkillsDir(root), 'empty-desc/SKILL.md'),
      `---
description: "   "
---
`,
    );

    const items = new ReferenceAssetService(root).listAssets('skills', 'claude');

    expect(items[0].description).toBeUndefined();
  });

  it('scans ralph skills from .claude/skills under claude provider', () => {
    const root = makeRoot();
    writeFile(path.join(ralphSkillsDir(root), 'ralph-skill/SKILL.md'), '# ralph skill');

    const items = new ReferenceAssetService(root).listAssets('skills', 'claude');

    expect(items).toHaveLength(1);
    expect(items[0].provider).toBe('claude');
    expect(items[0].sourceRoot).toContain('ralph-tui-upstream/.claude/skills');
  });

  it('handles multiple skills in different subdirectories', () => {
    const root = makeRoot();
    writeFile(path.join(moaiSkillsDir(root), 'skill-a/SKILL.md'), '# A');
    writeFile(path.join(moaiSkillsDir(root), 'skill-b/SKILL.md'), '# B');
    writeFile(path.join(moaiSkillsDir(root), 'nested/skill-c/SKILL.md'), '# C');

    const items = new ReferenceAssetService(root).listAssets('skills', 'claude');

    expect(items).toHaveLength(3);
    expect(items.map((i) => i.name).sort()).toEqual(['skill-a', 'skill-b', 'skill-c']);
  });

  it('skips hidden directories when walking for skills', () => {
    const root = makeRoot();
    writeFile(path.join(moaiSkillsDir(root), '.hidden-skill/SKILL.md'), '# hidden');
    writeFile(path.join(moaiSkillsDir(root), 'visible-skill/SKILL.md'), '# visible');

    const items = new ReferenceAssetService(root).listAssets('skills', 'claude');

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('visible-skill');
  });

  it('returns empty list when skills directory does not exist', () => {
    const root = makeRoot();

    const items = new ReferenceAssetService(root).listAssets('skills');

    expect(items).toHaveLength(0);
  });

  it('item id has format provider:skills:relativePath', () => {
    const root = makeRoot();
    writeFile(path.join(moaiSkillsDir(root), 'my-skill/SKILL.md'), '# skill');

    const items = new ReferenceAssetService(root).listAssets('skills', 'claude');

    expect(items[0].id).toMatch(/^claude:skills:/);
    expect(items[0].id).toContain('SKILL.md');
  });
});

// ===========================================================================
// readAsset / getAssetAbsolutePath
// ===========================================================================

describe('ReferenceAssetService — readAsset', () => {
  it('reads file content for a valid relative path', () => {
    const root = makeRoot();
    const rel = 'moai-adk-upstream/.claude/hooks/my-hook.md';
    writeFile(path.join(root, rel), '# My Hook\nsome content');

    const result = new ReferenceAssetService(root).readAsset(rel);

    expect(result.success).toBe(true);
    expect(result.content).toContain('My Hook');
  });

  it('returns error for a non-existent file', () => {
    const root = makeRoot();

    const result = new ReferenceAssetService(root).readAsset(
      'moai-adk-upstream/.claude/hooks/missing.md',
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error for empty path', () => {
    const root = makeRoot();

    const result = new ReferenceAssetService(root).readAsset('');

    expect(result.success).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('blocks path traversal with ../', () => {
    const root = makeRoot();
    // write a file outside the references root
    const outside = path.join(path.dirname(root), 'secret.txt');
    writeFile(outside, 'secret data');

    const result = new ReferenceAssetService(root).readAsset('../secret.txt');

    expect(result.success).toBe(false);
    expect(result.error).toContain('outside references root');

    // cleanup
    fs.rmSync(outside, { force: true });
  });

  it('blocks absolute path injection', () => {
    const root = makeRoot();
    writeFile('/tmp/injected.md', 'injected');

    // An absolute path resolves outside the references root
    const result = new ReferenceAssetService(root).readAsset('/tmp/injected.md');

    expect(result.success).toBe(false);
  });
});

describe('ReferenceAssetService — getAssetAbsolutePath', () => {
  it('resolves valid relative path to absolute path', () => {
    const root = makeRoot();
    const rel = 'ralph-tui-upstream/.claude/skills/my-skill/SKILL.md';
    writeFile(path.join(root, rel));

    const result = new ReferenceAssetService(root).getAssetAbsolutePath(rel);

    expect(result.success).toBe(true);
    expect(result.absolutePath).toBe(path.join(root, rel));
  });

  it('returns error for path traversal', () => {
    const root = makeRoot();

    const result = new ReferenceAssetService(root).getAssetAbsolutePath('../../etc/passwd');

    expect(result.success).toBe(false);
    expect(result.error).toContain('outside references root');
  });

  it('returns error for missing file', () => {
    const root = makeRoot();

    const result = new ReferenceAssetService(root).getAssetAbsolutePath(
      'moai-adk-upstream/.claude/hooks/nonexistent.sh',
    );

    expect(result.success).toBe(false);
  });
});
