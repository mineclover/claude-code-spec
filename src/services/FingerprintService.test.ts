import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FingerprintService } from './FingerprintService';

/**
 * Fixture: a throwaway project containing a CLAUDE.md with an @-import, a
 * skill, an agent, and a matching MCP config. We pin a fake home directory to
 * prevent the user's real ~/.claude state from leaking into hashes.
 */

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-'));
const projectDir = path.join(tmpRoot, 'proj');
const fakeHome = path.join(tmpRoot, 'home');

beforeAll(() => {
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, '.claude', 'skills', 'demo'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, '.claude', 'agents'), { recursive: true });
  fs.mkdirSync(fakeHome, { recursive: true });

  fs.writeFileSync(path.join(projectDir, 'CLAUDE.md'), 'hello\n@./notes.md\n');
  fs.writeFileSync(path.join(projectDir, 'notes.md'), 'imported body');
  fs.writeFileSync(
    path.join(projectDir, '.claude', 'skills', 'demo', 'SKILL.md'),
    '---\nname: demo\n---\nskill body',
  );
  fs.writeFileSync(
    path.join(projectDir, '.claude', 'agents', 'planner.md'),
    'agent body',
  );
  fs.writeFileSync(
    path.join(projectDir, 'mcp.json'),
    JSON.stringify({ mcpServers: { serena: { command: 'serena', args: [] } } }),
  );
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('FingerprintService.computeStatic', () => {
  const svc = new FingerprintService();

  it('produces non-empty sub-hashes for all present components', () => {
    const fp = svc.computeStatic({
      projectPath: projectDir,
      mcpConfigPath: path.join(projectDir, 'mcp.json'),
      homeDir: fakeHome,
    });
    expect(fp.components.claudeMd).not.toBe('');
    expect(fp.components.imports).not.toBe('');
    expect(fp.components.skills).not.toBe('');
    expect(fp.components.agents).not.toBe('');
    expect(fp.components.mcpResolved).not.toBe('');
    expect(fp.total).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for identical inputs', () => {
    const a = svc.computeStatic({
      projectPath: projectDir,
      mcpConfigPath: path.join(projectDir, 'mcp.json'),
      homeDir: fakeHome,
    });
    const b = svc.computeStatic({
      projectPath: projectDir,
      mcpConfigPath: path.join(projectDir, 'mcp.json'),
      homeDir: fakeHome,
    });
    expect(a.total).toBe(b.total);
  });

  it('changes total hash when CLAUDE.md changes', () => {
    const before = svc.computeStatic({
      projectPath: projectDir,
      mcpConfigPath: path.join(projectDir, 'mcp.json'),
      homeDir: fakeHome,
    });
    fs.writeFileSync(path.join(projectDir, 'CLAUDE.md'), 'changed content\n@./notes.md\n');
    try {
      const after = svc.computeStatic({
        projectPath: projectDir,
        mcpConfigPath: path.join(projectDir, 'mcp.json'),
        homeDir: fakeHome,
      });
      expect(after.total).not.toBe(before.total);
      expect(after.components.claudeMd).not.toBe(before.components.claudeMd);
      // imports component unchanged: the imported file wasn't edited
      expect(after.components.imports).toBe(before.components.imports);
    } finally {
      fs.writeFileSync(path.join(projectDir, 'CLAUDE.md'), 'hello\n@./notes.md\n');
    }
  });

  it('yields empty mcpResolved when no config path is provided', () => {
    const fp = svc.computeStatic({ projectPath: projectDir, homeDir: fakeHome });
    expect(fp.components.mcpResolved).toBe('');
  });

  it('ignores MCP key ordering (canonical JSON)', () => {
    const reordered = path.join(projectDir, 'mcp-reordered.json');
    fs.writeFileSync(
      reordered,
      JSON.stringify({ mcpServers: { serena: { args: [], command: 'serena' } } }),
    );
    const original = svc.computeStatic({
      projectPath: projectDir,
      mcpConfigPath: path.join(projectDir, 'mcp.json'),
      homeDir: fakeHome,
    });
    const reorderedFp = svc.computeStatic({
      projectPath: projectDir,
      mcpConfigPath: reordered,
      homeDir: fakeHome,
    });
    expect(original.components.mcpResolved).toBe(reorderedFp.components.mcpResolved);
  });
});
