import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpDefaultConfig, getMcpServerCandidates } from './settings';

function writeMcpConfig(targetPath: string, servers: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify({ mcpServers: servers }, null, 2), 'utf-8');
}

describe('settings MCP source aggregation', () => {
  let tempRoot = '';
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-settings-'));
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
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

  it('merges global/project sources with deterministic conflict resolution', () => {
    const projectPath = path.join(tempRoot, 'project-alpha');
    const globalPath = path.join(tempRoot, '.claude.json');
    const additionalPath = path.join(tempRoot, 'extra-mcp.json');
    const projectRootPath = path.join(projectPath, '.mcp.json');
    const projectLocalPath = path.join(projectPath, '.mcp.local.json');
    const codexProjectPath = path.join(projectPath, '.codex', '.mcp.json');

    writeMcpConfig(globalPath, {
      sharedServer: { command: 'global-shared' },
      projectWinsServer: { command: 'global-project-wins' },
      globalOnlyServer: { command: 'global-only' },
    });
    writeMcpConfig(additionalPath, {
      sharedServer: { command: 'additional-shared' },
      additionalOnlyServer: { command: 'additional-only' },
    });
    writeMcpConfig(projectRootPath, {
      sharedServer: { command: 'project-shared' },
      projectWinsServer: { command: 'project-wins' },
      tieServer: { command: 'project-root' },
    });
    writeMcpConfig(projectLocalPath, {
      sharedServer: { command: 'project-local-shared' },
      localOnlyServer: { command: 'project-local-only' },
    });
    writeMcpConfig(codexProjectPath, {
      tieServer: { command: 'project-codex' },
    });

    const result = getMcpServerCandidates({
      projectPath,
      additionalPaths: [additionalPath],
    });

    expect(result.error).toBeUndefined();
    expect(result.sourcePaths).toEqual([
      path.resolve(globalPath),
      path.resolve(additionalPath),
      path.resolve(projectRootPath),
      path.resolve(projectLocalPath),
      path.resolve(codexProjectPath),
    ]);

    const byName = new Map(result.candidates.map((candidate) => [candidate.name, candidate]));

    expect(byName.get('sharedServer')).toMatchObject({
      command: 'project-local-shared',
      sourceScope: 'projectLocal',
      sourcePath: path.resolve(projectLocalPath),
    });
    expect(byName.get('projectWinsServer')).toMatchObject({
      command: 'project-wins',
      sourceScope: 'project',
      sourcePath: path.resolve(projectRootPath),
    });
    expect(byName.get('tieServer')).toMatchObject({
      command: 'project-codex',
      sourceScope: 'project',
      sourcePath: path.resolve(codexProjectPath),
    });
    expect(byName.get('globalOnlyServer')).toMatchObject({
      command: 'global-only',
      sourceScope: 'global',
      sourcePath: path.resolve(globalPath),
    });
  });

  it('reuses aggregated candidates when creating tool default configs', () => {
    const projectPath = path.join(tempRoot, 'project-beta');
    const globalPath = path.join(tempRoot, '.claude.json');
    const projectRootPath = path.join(projectPath, '.mcp.json');

    writeMcpConfig(globalPath, {
      sharedServer: { command: 'global-shared' },
      globalOnlyServer: { command: 'global-only' },
    });
    writeMcpConfig(projectRootPath, {
      sharedServer: { command: 'project-shared' },
    });

    const created = createMcpDefaultConfig(projectPath, 'codex', [
      'sharedServer',
      'globalOnlyServer',
    ]);
    expect(created.success).toBe(true);
    expect(created.path).toBe(path.join(projectPath, '.codex', '.mcp.json'));

    const createdRaw = fs.readFileSync(created.path as string, 'utf-8');
    const createdJson = JSON.parse(createdRaw) as {
      mcpServers: Record<string, { command: string }>;
    };

    expect(createdJson.mcpServers.sharedServer.command).toBe('project-shared');
    expect(createdJson.mcpServers.globalOnlyServer.command).toBe('global-only');
  });
});
