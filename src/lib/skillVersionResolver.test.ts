import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import {
  formatSkillVersionHint,
  resolveSkillVersionInfo,
  SKILL_VERSION_HINT_FALLBACK,
} from './skillVersionResolver';

function readFixture(provider: string): {
  frontmatter: Record<string, unknown>;
  metadata: Record<string, unknown>;
} {
  const fixturePath = path.join(
    __dirname,
    '__fixtures__',
    'skill-version-resolver',
    provider,
    'SKILL.md',
  );
  const content = readFileSync(fixturePath, 'utf-8');
  const parsed = matter(content);
  const frontmatter = parsed.data as Record<string, unknown>;
  const metadata =
    typeof frontmatter.metadata === 'object' && frontmatter.metadata !== null
      ? (frontmatter.metadata as Record<string, unknown>)
      : {};
  return { frontmatter, metadata };
}

describe('skillVersionResolver', () => {
  it('resolves version hint chain using provider sample fixtures', () => {
    const claudeFixture = readFixture('claude');
    const codexFixture = readFixture('codex');
    const geminiFixture = readFixture('gemini');
    const agentsFixture = readFixture('agents');

    expect(
      resolveSkillVersionInfo({
        ...claudeFixture,
        lock: {
          skillFolderHash: 'lock-claude',
          source: 'github.com/acme/claude-skill@v0.0.1',
        },
      }),
    ).toMatchObject({
      versionHint: '1.2.3',
      source: 'github.com/acme/claude-skill@v0.0.1',
    });

    expect(
      resolveSkillVersionInfo({
        ...codexFixture,
        lock: {
          skillFolderHash: 'lock-codex',
          source: 'github.com/acme/codex-skill@v0.0.1',
        },
      }),
    ).toMatchObject({
      versionHint: '2.4.6',
      source: 'github.com/acme/codex-skill@v0.0.1',
    });

    expect(
      resolveSkillVersionInfo({
        ...geminiFixture,
        lock: {
          skillFolderHash: 'hash-gemini-20260301',
          source: 'github.com/acme/gemini-skill@v9.9.9',
        },
      }),
    ).toMatchObject({
      versionHint: 'hash-gemini-20260301',
      source: 'github.com/acme/gemini-skill@v9.9.9',
    });

    expect(
      resolveSkillVersionInfo({
        ...agentsFixture,
      }),
    ).toMatchObject({
      versionHint: 'stable-2026',
      source: 'github.com/acme/agents-skill#stable-2026',
    });
  });

  it('falls back to unknown when no version hint is available', () => {
    expect(
      resolveSkillVersionInfo({
        frontmatter: {},
        metadata: {},
      }),
    ).toMatchObject({
      versionHint: SKILL_VERSION_HINT_FALLBACK,
      source: null,
    });

    expect(formatSkillVersionHint(null)).toBe(SKILL_VERSION_HINT_FALLBACK);
    expect(formatSkillVersionHint('   ')).toBe(SKILL_VERSION_HINT_FALLBACK);
  });

  it('checks source candidates sequentially after lockfile', () => {
    expect(
      resolveSkillVersionInfo({
        frontmatter: {
          source: 'github.com/acme/source-frontmatter@v7.8.9',
        },
        metadata: {
          source: 'github.com/acme/source-metadata#release-7',
        },
        lock: {
          source: 'github.com/acme/source-lock',
        },
      }).versionHint,
    ).toBe('v7.8.9');
  });
});
