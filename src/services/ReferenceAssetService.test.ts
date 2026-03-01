import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ReferenceAssetService } from './ReferenceAssetService';

function createTempReferencesRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'reference-assets-test-'));
}

function writeFile(targetPath: string, content: string): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf-8');
}

describe('ReferenceAssetService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    tempRoots.length = 0;
  });

  it('lists hooks and output style assets by provider', () => {
    const root = createTempReferencesRoot();
    tempRoots.push(root);

    writeFile(
      path.join(root, 'moai-adk-upstream/.claude/hooks/pre-command.md'),
      '# Hook pre-command',
    );
    writeFile(
      path.join(root, 'ralph-tui-upstream/website/styles/theme.css'),
      'body { color: white; }',
    );

    const service = new ReferenceAssetService(root);
    const hooks = service.listAssets('hooks');
    const outputStyles = service.listAssets('outputStyles');

    expect(hooks.length).toBe(1);
    expect(hooks[0].provider).toBe('moai');
    expect(hooks[0].relativePath).toContain('moai-adk-upstream/.claude/hooks/pre-command.md');

    expect(outputStyles.length).toBe(1);
    expect(outputStyles[0].provider).toBe('ralph');
    expect(outputStyles[0].relativePath).toContain('ralph-tui-upstream/website/styles/theme.css');
  });

  it('lists skills and extracts description from SKILL.md frontmatter', () => {
    const root = createTempReferencesRoot();
    tempRoots.push(root);

    writeFile(
      path.join(root, 'moai-adk-upstream/.claude/skills/my-skill/SKILL.md'),
      `---
description: Sample skill description
---
# My Skill
`,
    );

    const service = new ReferenceAssetService(root);
    const skills = service.listAssets('skills', 'moai');

    expect(skills.length).toBe(1);
    expect(skills[0].name).toBe('my-skill');
    expect(skills[0].description).toBe('Sample skill description');
    expect(skills[0].provider).toBe('moai');
  });

  it('reads asset content and blocks path traversal', () => {
    const root = createTempReferencesRoot();
    tempRoots.push(root);

    const relativePath = 'ralph-tui-upstream/skills/ralph-tui-prd/SKILL.md';
    writeFile(path.join(root, relativePath), '# Ralph skill');

    const service = new ReferenceAssetService(root);

    const success = service.readAsset(relativePath);
    expect(success.success).toBe(true);
    expect(success.content).toContain('Ralph skill');

    const resolved = service.getAssetAbsolutePath(relativePath);
    expect(resolved.success).toBe(true);
    expect(resolved.absolutePath).toContain('ralph-tui-prd/SKILL.md');

    const blocked = service.readAsset('../outside.md');
    expect(blocked.success).toBe(false);
    expect(blocked.error).toContain('outside references root');

    const blockedResolve = service.getAssetAbsolutePath('../outside.md');
    expect(blockedResolve.success).toBe(false);
    expect(blockedResolve.error).toContain('outside references root');
  });
});
