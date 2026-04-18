import { describe, expect, it } from 'vitest';
import type { McpRegistryEntry } from '../../types/mcp-policy';
import { filterEntries } from './filter';

function entry(overrides: Partial<McpRegistryEntry> = {}): McpRegistryEntry {
  return {
    id: overrides.id ?? 'serena',
    name: overrides.name,
    command: overrides.command ?? 'serena',
    args: overrides.args ?? [],
    env: overrides.env,
    category: overrides.category,
    description: overrides.description,
    type: overrides.type,
    scope: overrides.scope ?? 'user',
  };
}

describe('filterEntries', () => {
  const entries = [
    entry({ id: 'serena', name: 'Serena', category: 'analysis' }),
    entry({ id: 'context7', name: 'Context7', category: 'docs' }),
    entry({
      id: 'sequential-thinking',
      category: 'analysis',
      description: 'Stepwise reasoning helper',
    }),
  ];

  it('returns all entries for empty query', () => {
    expect(filterEntries(entries, '').map((e) => e.id)).toEqual([
      'serena',
      'context7',
      'sequential-thinking',
    ]);
  });

  it('returns all entries for whitespace-only query', () => {
    expect(filterEntries(entries, '   ').map((e) => e.id)).toEqual([
      'serena',
      'context7',
      'sequential-thinking',
    ]);
  });

  it('matches against id case-insensitively', () => {
    expect(filterEntries(entries, 'SERENA').map((e) => e.id)).toEqual(['serena']);
  });

  it('matches against name', () => {
    expect(filterEntries(entries, 'context7').map((e) => e.id)).toEqual(['context7']);
  });

  it('matches against category', () => {
    expect(filterEntries(entries, 'analysis').map((e) => e.id)).toEqual([
      'serena',
      'sequential-thinking',
    ]);
  });

  it('matches against description', () => {
    expect(filterEntries(entries, 'stepwise').map((e) => e.id)).toEqual([
      'sequential-thinking',
    ]);
  });

  it('returns empty when nothing matches', () => {
    expect(filterEntries(entries, 'nonexistent')).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const original = [...entries];
    filterEntries(entries, '');
    expect(entries).toEqual(original);
  });
});
