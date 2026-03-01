import { describe, expect, it } from 'vitest';
import { dedupeByLast } from './collectionUtils';

describe('dedupeByLast', () => {
  it('keeps only the last item for each key while preserving insertion order', () => {
    const result = dedupeByLast(
      [
        { id: 'a', value: 1 },
        { id: 'b', value: 2 },
        { id: 'a', value: 3 },
      ],
      (item) => item.id,
    );

    expect(result).toEqual([
      { id: 'a', value: 3 },
      { id: 'b', value: 2 },
    ]);
  });
});
