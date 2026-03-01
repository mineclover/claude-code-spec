import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type ReferenceProviderSectionCountMap,
  resolveReferenceProviderSections,
} from '../lib/referenceProviderSections';
import type { ReferenceAssetType, ReferenceProvider } from '../types/reference-assets';

type Message = { type: 'success' | 'error'; text: string } | null;

const REFERENCE_ASSET_TYPES: ReferenceAssetType[] = ['hooks', 'outputStyles', 'skills'];

function createEmptyCountMap(): ReferenceProviderSectionCountMap {
  return {};
}

function collectCounts(
  assetsByType: Partial<Record<ReferenceAssetType, Array<{ provider: ReferenceProvider }>>>,
): ReferenceProviderSectionCountMap {
  const countsByProvider: ReferenceProviderSectionCountMap = {};

  for (const assetType of REFERENCE_ASSET_TYPES) {
    const items = assetsByType[assetType] ?? [];
    for (const item of items) {
      if (!countsByProvider[item.provider]) {
        countsByProvider[item.provider] = {};
      }
      const current = countsByProvider[item.provider]?.[assetType] ?? 0;
      countsByProvider[item.provider] = {
        ...countsByProvider[item.provider],
        [assetType]: current + 1,
      };
    }
  }

  return countsByProvider;
}

export function useReferenceProviderSections() {
  const [countsByProvider, setCountsByProvider] = useState<ReferenceProviderSectionCountMap>(
    createEmptyCountMap(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const [hooks, outputStyles, skills] = await Promise.all([
        window.toolsAPI.listReferenceAssets('hooks'),
        window.toolsAPI.listReferenceAssets('outputStyles'),
        window.toolsAPI.listReferenceAssets('skills'),
      ]);
      setCountsByProvider(
        collectCounts({
          hooks,
          outputStyles,
          skills,
        }),
      );
    } catch (error) {
      console.error('Failed to load reference provider sections:', error);
      setCountsByProvider(createEmptyCountMap());
      setMessage({ type: 'error', text: 'Failed to load reference provider sections.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const providers = useMemo(
    () => resolveReferenceProviderSections({ countsByProvider }),
    [countsByProvider],
  );

  return {
    providers,
    isLoading,
    message,
    load,
  };
}
