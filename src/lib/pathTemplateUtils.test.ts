import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultDisabledRoot, normalizeDir, resolvePathTemplate } from './pathTemplateUtils';

describe('pathTemplateUtils', () => {
  it('resolves env template variables and home shortcuts', () => {
    const env = {
      TEST_HOME: '/tmp/test-home',
    } as NodeJS.ProcessEnv;

    expect(resolvePathTemplate(`\${TEST_HOME}/skills`, env)).toBe('/tmp/test-home/skills');
    expect(resolvePathTemplate('~/skills', env)).toBe(path.join(os.homedir(), 'skills'));
    expect(resolvePathTemplate('~', env)).toBe(os.homedir());
  });

  it('normalizes directory input by trimming and resolving templates', () => {
    const env = {
      CLI_HOME: '/tmp/cli',
    } as NodeJS.ProcessEnv;

    expect(normalizeDir(`  \${CLI_HOME}/skills  `, env)).toBe('/tmp/cli/skills');
    expect(normalizeDir('   ', env)).toBe('');
  });

  it('derives disabled skill roots safely', () => {
    expect(defaultDisabledRoot('/tmp/.codex/skills')).toBe('/tmp/.codex/skills-disabled');
    expect(defaultDisabledRoot('/tmp/skills-store')).toBe('/tmp/skills-store-disabled');
  });
});
