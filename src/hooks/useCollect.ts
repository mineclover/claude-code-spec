import { useCallback, useRef, useState } from 'react';

export interface CollectResult<T> {
  output: T | null;
  collecting: boolean;
  error: string | null;
  collect: () => Promise<void>;
  /** Set to true to abort an in-flight collect (e.g. on unmount or project change). */
  abortRef: React.MutableRefObject<boolean>;
}

/**
 * Standard hook for one-shot async data collection with abort support.
 *
 * The fetcher is read via a ref so the returned `collect` function is stable
 * regardless of how often the fetcher closure is recreated.
 */
export function useCollect<T>(
  fetcher: () => Promise<{ output: T | null; error?: string }>,
): CollectResult<T> {
  const [output, setOutput] = useState<T | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const collect = useCallback(async () => {
    abortRef.current = false;
    setCollecting(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (abortRef.current) return;
      if (result.output !== null && result.output !== undefined) {
        setOutput(result.output);
      } else {
        setError(result.error ?? 'No output');
      }
    } finally {
      if (!abortRef.current) setCollecting(false);
    }
  }, []);

  return { output, collecting, error, collect, abortRef };
}
