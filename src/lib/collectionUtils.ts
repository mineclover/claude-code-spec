export function dedupeByLast<T, K>(items: Iterable<T>, keySelector: (item: T) => K): T[] {
  const map = new Map<K, T>();
  for (const item of items) {
    map.set(keySelector(item), item);
  }
  return Array.from(map.values());
}
