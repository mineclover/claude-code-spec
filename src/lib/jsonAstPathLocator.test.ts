import { describe, expect, it } from 'vitest';
import { createJsonAstPathLocator } from './jsonAstPathLocator';

const SAMPLE_JSON = JSON.stringify(
  [
    {
      id: 'acme',
      tools: [
        {
          id: 'tool-a',
          updateCommand: {
            command: 'moai',
            args: ['update', '--binary', '--yes'],
          },
        },
      ],
    },
    {
      other: 1,
    },
  ],
  null,
  2,
);

describe('createJsonAstPathLocator', () => {
  it('locates nested array argument node precisely', () => {
    const locator = createJsonAstPathLocator(SAMPLE_JSON);
    const range = locator.findRange([0, 'tools', 0, 'updateCommand', 'args', 2]);
    const text = SAMPLE_JSON.slice(range.from, range.to);

    expect(text).toContain('--yes');
  });

  it('locates direct object property value node', () => {
    const locator = createJsonAstPathLocator(SAMPLE_JSON);
    const range = locator.findRange([0, 'id']);
    const text = SAMPLE_JSON.slice(range.from, range.to);

    expect(text).toContain('acme');
  });

  it('falls back to nearest existing parent when property does not exist', () => {
    const locator = createJsonAstPathLocator(SAMPLE_JSON);
    const range = locator.findRange([1, 'missing']);
    const text = SAMPLE_JSON.slice(range.from, range.to);

    expect(text).toContain('other');
  });

  it('returns root range for empty path', () => {
    const locator = createJsonAstPathLocator(SAMPLE_JSON);
    const range = locator.findRange([]);
    const text = SAMPLE_JSON.slice(range.from, range.to);

    expect(text.trim().startsWith('[')).toBe(true);
    expect(text.trim().endsWith(']')).toBe(true);
  });
});
