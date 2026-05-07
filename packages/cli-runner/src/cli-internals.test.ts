/**
 * Pinned behaviour for the cli-internals helpers.
 *
 * The renderer's filter/search/format logic intentionally mirrors what
 * these CLI helpers do — these tests guard the pure transforms so a
 * regression here would be caught before someone notices the GUI and
 * the CLI silently disagree on the same record set.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  buildSearchHaystack,
  formatProjects,
  formatSessions,
  formatSummaryRows,
  isLanguage,
  isToolId,
  parseArgs,
  parseSinceFlag,
  prettyPrint,
} from './cli-internals';
import type {
  ProjectListItem,
  SessionMetaView,
  SummaryRecord,
  SummaryResult,
} from '@context-action/session-core';

const SAMPLE_SUMMARY: SummaryResult = {
  oneLiner: 'one',
  narrative: 'two',
  keyDecisions: [
    { title: 'adopt outbox', rationale: 'avoid dual-write race', status: 'adopted' },
  ],
  references: [{ target: 'src/billing/outbox.ts', kind: 'code' }],
  openItems: [{ question: 'shadow run duration?', anchor: '#3.2' }],
  nextActions: [{ prompt: 'run shadow for 48h', label: 'shadow' }],
  generatedAt: '2026-05-08T00:00:00.000Z',
};

const SAMPLE_RECORD: SummaryRecord = {
  id: 'fork-1',
  sourceSessionId: 'src-1',
  toolId: 'claude',
  cwd: '/Users/jun/work/billing',
  createdAt: '2026-05-08T00:00:00.000Z',
  language: 'en',
  summary: SAMPLE_SUMMARY,
};

describe('parseArgs', () => {
  it('extracts the leading command and positional args', () => {
    expect(parseArgs(['summaries', 'get', 'abc123'])).toEqual({
      command: 'summaries',
      positional: ['get', 'abc123'],
      flags: {},
    });
  });

  it('parses --flag value pairs', () => {
    expect(parseArgs(['branch', 'claude', 'sid', '--language', 'ko'])).toEqual({
      command: 'branch',
      positional: ['claude', 'sid'],
      flags: { language: 'ko' },
    });
  });

  it('parses --flag=value form', () => {
    expect(parseArgs(['branch', '--language=ko'])).toEqual({
      command: 'branch',
      positional: [],
      flags: { language: 'ko' },
    });
  });

  it('treats a bare --flag (followed by another --flag) as boolean true', () => {
    expect(parseArgs(['branch', '--no-save', '--language', 'en'])).toEqual({
      command: 'branch',
      positional: [],
      flags: { 'no-save': true, language: 'en' },
    });
  });

  it('treats a trailing bare --flag as boolean true', () => {
    expect(parseArgs(['branch', '--json'])).toEqual({
      command: 'branch',
      positional: [],
      flags: { json: true },
    });
  });

  it('handles an empty argv as an empty command', () => {
    expect(parseArgs([])).toEqual({ command: '', positional: [], flags: {} });
  });
});

describe('parseSinceFlag', () => {
  it('returns null for missing / non-string / "all"', () => {
    expect(parseSinceFlag(undefined)).toBeNull();
    expect(parseSinceFlag(true)).toBeNull();
    expect(parseSinceFlag('')).toBeNull();
    expect(parseSinceFlag('all')).toBeNull();
  });

  it('parses unit shorthand against a frozen clock', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    try {
      expect(parseSinceFlag('30s')).toBe(Date.parse('2026-05-08T11:59:30.000Z'));
      expect(parseSinceFlag('5m')).toBe(Date.parse('2026-05-08T11:55:00.000Z'));
      expect(parseSinceFlag('2h')).toBe(Date.parse('2026-05-08T10:00:00.000Z'));
      expect(parseSinceFlag('7d')).toBe(Date.parse('2026-05-01T12:00:00.000Z'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('honours the english aliases', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    try {
      expect(parseSinceFlag('today')).toBe(Date.parse('2026-05-07T12:00:00.000Z'));
      expect(parseSinceFlag('week')).toBe(Date.parse('2026-05-01T12:00:00.000Z'));
      expect(parseSinceFlag('month')).toBe(Date.parse('2026-04-08T12:00:00.000Z'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns null on bogus formats', () => {
    expect(parseSinceFlag('5x')).toBeNull();
    expect(parseSinceFlag('abc')).toBeNull();
    expect(parseSinceFlag('-5d')).toBeNull();
  });
});

describe('buildSearchHaystack', () => {
  it('indexes every narrative section so a hit on a decision rationale matches', () => {
    const hay = buildSearchHaystack(SAMPLE_RECORD);
    expect(hay).toContain('one');
    expect(hay).toContain('two');
    expect(hay).toContain('avoid dual-write race');
    expect(hay).toContain('src/billing/outbox.ts');
    expect(hay).toContain('shadow run duration');
    expect(hay).toContain('run shadow for 48h');
    expect(hay).toContain('shadow'); // next action label
  });

  it('lowercases the haystack so case-insensitive search works', () => {
    const hay = buildSearchHaystack(SAMPLE_RECORD);
    expect(hay).toBe(hay.toLowerCase());
  });
});

describe('isToolId / isLanguage', () => {
  it('accepts the three known toolIds', () => {
    expect(isToolId('claude')).toBe(true);
    expect(isToolId('codex')).toBe(true);
    expect(isToolId('gemini')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isToolId('claude-code')).toBe(false);
    expect(isToolId('')).toBe(false);
  });

  it('accepts en/ko only', () => {
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('ko')).toBe(true);
    expect(isLanguage('ja')).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
  });
});

describe('format helpers', () => {
  it('formatProjects → empty produces a sentinel line', () => {
    expect(formatProjects([])).toBe('(no projects)\n');
  });

  it('formatProjects → renders a header and one row per project', () => {
    const projects: ProjectListItem[] = [
      {
        id: 'claude:-Users-jun-foo',
        path: '/Users/jun/foo',
        sessionCount: 3,
        lastSeenAt: Date.parse('2026-05-08T12:34:56.000Z'),
        toolId: 'claude',
      },
    ];
    const out = formatProjects(projects);
    expect(out.startsWith('TOOL\t')).toBe(true);
    expect(out).toContain('claude');
    expect(out).toContain('/Users/jun/foo');
    expect(out).toContain('2026-05-08 12:34:56');
    expect(out.split('\n').filter(Boolean)).toHaveLength(2);
  });

  it('formatSessions → empty produces a sentinel line', () => {
    expect(formatSessions([])).toBe('(no sessions)\n');
  });

  it('formatSessions → row order matches input', () => {
    const sessions: SessionMetaView[] = [
      {
        source: 'derived',
        sessionId: 'a',
        fingerprintHash: 'h',
        metrics: {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 0,
          ephemeral5mTokens: 0,
          ephemeral1hTokens: 0,
          cacheHitRatio: 0.5,
          costUsd: 0,
          turns: 4,
        },
        toolId: 'codex',
        lastModifiedMs: Date.parse('2026-05-08T01:02:03.000Z'),
      },
    ];
    const out = formatSessions(sessions);
    expect(out).toContain('codex');
    expect(out).toContain(' 50.0%');
    expect(out).toContain('   4');
    expect(out).toContain('a');
  });

  it('formatSummaryRows → empty produces a sentinel line', () => {
    expect(formatSummaryRows([])).toBe('(no summaries)\n');
  });

  it('formatSummaryRows → includes language tag when set', () => {
    const out = formatSummaryRows([SAMPLE_RECORD]);
    expect(out).toContain('en');
    expect(out).toContain('fork-1');
    expect(out).toContain('one');
  });
});

describe('prettyPrint', () => {
  it('always emits the headline, narrative, and any non-empty section', () => {
    const out = prettyPrint(SAMPLE_SUMMARY);
    expect(out.startsWith('# one')).toBe(true);
    expect(out).toContain('two');
    expect(out).toContain('Key decisions:');
    expect(out).toContain('adopt outbox [adopted]');
    expect(out).toContain('References:');
    expect(out).toContain('(code) src/billing/outbox.ts');
    expect(out).toContain('Open items:');
    expect(out).toContain("shadow run duration? [#3.2]");
    expect(out).toContain('Next actions:');
    expect(out).toContain('shadow: run shadow for 48h');
  });

  it('omits sections that are empty', () => {
    const minimal: SummaryResult = {
      oneLiner: 'short',
      narrative: 'desc',
      keyDecisions: [],
      references: [],
      openItems: [],
      nextActions: [],
      generatedAt: '2026-05-08T00:00:00.000Z',
    };
    const out = prettyPrint(minimal);
    expect(out).toContain('# short');
    expect(out).not.toContain('Key decisions:');
    expect(out).not.toContain('References:');
    expect(out).not.toContain('Open items:');
    expect(out).not.toContain('Next actions:');
  });

  it('shows cacheInvariants line when present', () => {
    const withCache: SummaryResult = {
      ...SAMPLE_SUMMARY,
      cacheInvariants: {
        forkSessionId: 'fork',
        sourceSessionId: 'src',
        inputTokens: 6,
        cacheReadTokens: 4017,
        cacheCreationTokens: 7250,
        prefixPreservedRatio: 0.999,
      },
    };
    expect(prettyPrint(withCache)).toContain('prefix preserved 99.9%');
  });
});
