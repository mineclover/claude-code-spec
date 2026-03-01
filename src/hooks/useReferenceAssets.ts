import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ReferenceAssetItem,
  ReferenceAssetPreference,
  ReferenceAssetPreferenceMap,
  ReferenceAssetPreferenceUpdate,
  ReferenceAssetReadResult,
  ReferenceAssetType,
  ReferenceProvider,
} from '../types/reference-assets';

export type ProviderFilter = 'all' | ReferenceProvider;
export type MessageType = 'success' | 'error';
export type SortMode = 'favoritesFirst' | 'nameAsc' | 'pathAsc' | 'updatedDesc';
export type FavoriteSortMode = 'nameAsc' | 'pathAsc' | 'updatedDesc';

interface UseReferenceAssetsOptions {
  assetType: ReferenceAssetType;
}

interface TagInventoryItem {
  tag: string;
  count: number;
}

const EMPTY_PREFERENCE: ReferenceAssetPreference = { favorite: false, tags: [] };

function normalizeTag(tag: string): string {
  return tag.trim().replace(/\s+/g, '-');
}

function getPreference(
  preferences: ReferenceAssetPreferenceMap,
  relativePath: string,
): ReferenceAssetPreference {
  return preferences[relativePath] ?? EMPTY_PREFERENCE;
}

function getScopedPreferenceEntries(
  preferences: ReferenceAssetPreferenceMap,
  loadedAssetPathSet: Set<string>,
): Array<[string, ReferenceAssetPreference]> {
  const entries: Array<[string, ReferenceAssetPreference]> = [];
  for (const [relativePath, preference] of Object.entries(preferences)) {
    if (!loadedAssetPathSet.has(relativePath)) {
      continue;
    }
    entries.push([relativePath, preference]);
  }
  return entries;
}

function buildScopedPreferenceUpdates(
  preferences: ReferenceAssetPreferenceMap,
  loadedAssetPathSet: Set<string>,
  transform: (
    preference: ReferenceAssetPreference,
    relativePath: string,
  ) => ReferenceAssetPreference | null,
): ReferenceAssetPreferenceUpdate[] {
  const updates: ReferenceAssetPreferenceUpdate[] = [];
  for (const [relativePath, preference] of getScopedPreferenceEntries(
    preferences,
    loadedAssetPathSet,
  )) {
    const nextPreference = transform(preference, relativePath);
    if (!nextPreference) {
      continue;
    }
    updates.push({
      relativePath,
      preference: nextPreference,
    });
  }
  return updates;
}

function filterAssets(
  items: ReferenceAssetItem[],
  query: string,
  preferences: ReferenceAssetPreferenceMap,
  favoritesOnly: boolean,
  sortMode: SortMode,
  favoriteSortMode: FavoriteSortMode,
): ReferenceAssetItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = items.filter((item) => {
    const preference = getPreference(preferences, item.relativePath);
    if (favoritesOnly && !preference.favorite) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return (
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.relativePath.toLowerCase().includes(normalizedQuery) ||
      item.sourceRoot.toLowerCase().includes(normalizedQuery) ||
      item.provider.toLowerCase().includes(normalizedQuery) ||
      item.description?.toLowerCase().includes(normalizedQuery) === true ||
      preference.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
    );
  });

  const compareByBasicSortMode = (
    a: ReferenceAssetItem,
    b: ReferenceAssetItem,
    mode: SortMode | FavoriteSortMode,
  ): number => {
    if (mode === 'nameAsc') {
      return a.name.localeCompare(b.name);
    }
    if (mode === 'updatedDesc') {
      return b.updatedAt - a.updatedAt;
    }
    return a.relativePath.localeCompare(b.relativePath);
  };

  return filtered.sort((a, b) => {
    if (favoritesOnly) {
      const result = compareByBasicSortMode(a, b, favoriteSortMode);
      if (result !== 0) {
        return result;
      }
      return a.relativePath.localeCompare(b.relativePath);
    }

    if (sortMode === 'favoritesFirst') {
      const aFavorite = getPreference(preferences, a.relativePath).favorite;
      const bFavorite = getPreference(preferences, b.relativePath).favorite;
      if (aFavorite !== bFavorite) {
        return aFavorite ? -1 : 1;
      }
      if (a.provider !== b.provider) {
        return a.provider.localeCompare(b.provider);
      }
      return a.relativePath.localeCompare(b.relativePath);
    }

    const result = compareByBasicSortMode(a, b, sortMode);
    if (result !== 0) {
      return result;
    }
    if (a.provider !== b.provider) {
      return a.provider.localeCompare(b.provider);
    }
    return a.relativePath.localeCompare(b.relativePath);
  });
}

export function useReferenceAssets({ assetType }: UseReferenceAssetsOptions) {
  const [provider, setProvider] = useState<ProviderFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('favoritesFirst');
  const [favoriteSortMode, setFavoriteSortMode] = useState<FavoriteSortMode>('nameAsc');
  const [assets, setAssets] = useState<ReferenceAssetItem[]>([]);
  const [preferences, setPreferences] = useState<ReferenceAssetPreferenceMap>({});
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [readResult, setReadResult] = useState<ReferenceAssetReadResult | null>(null);
  const [isReadingAsset, setIsReadingAsset] = useState(false);
  const [message, setMessage] = useState<{ type: MessageType; text: string } | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [selectedManagerTag, setSelectedManagerTag] = useState<string | null>(null);
  const [renameTagInput, setRenameTagInput] = useState('');
  const [isTagManagerPending, setIsTagManagerPending] = useState(false);

  const filteredAssets = useMemo(
    () => filterAssets(assets, searchQuery, preferences, favoritesOnly, sortMode, favoriteSortMode),
    [assets, searchQuery, preferences, favoritesOnly, sortMode, favoriteSortMode],
  );

  const selectedAsset = useMemo(
    () => filteredAssets.find((item) => item.id === selectedAssetId) ?? null,
    [filteredAssets, selectedAssetId],
  );

  const selectedPreference = useMemo(
    () =>
      selectedAsset ? getPreference(preferences, selectedAsset.relativePath) : EMPTY_PREFERENCE,
    [preferences, selectedAsset],
  );

  const loadedAssetPathSet = useMemo(
    () => new Set(assets.map((item) => item.relativePath)),
    [assets],
  );

  const tagInventory = useMemo<TagInventoryItem[]>(() => {
    const counts = new Map<string, number>();
    for (const [, preference] of getScopedPreferenceEntries(preferences, loadedAssetPathSet)) {
      for (const tag of preference.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => {
        if (a.count !== b.count) {
          return b.count - a.count;
        }
        return a.tag.localeCompare(b.tag);
      });
  }, [preferences, loadedAssetPathSet]);

  const getPreferenceForPath = useCallback(
    (relativePath: string) => getPreference(preferences, relativePath),
    [preferences],
  );

  const loadAssets = useCallback(async () => {
    setIsLoadingAssets(true);
    setAssetsError(null);
    try {
      const result = await window.toolsAPI.listReferenceAssets(
        assetType,
        provider === 'all' ? undefined : provider,
      );
      setAssets(result);
    } catch (error) {
      console.error('Failed to load reference assets:', error);
      setAssets([]);
      setAssetsError('Failed to load reference assets.');
    } finally {
      setIsLoadingAssets(false);
    }
  }, [assetType, provider]);

  const loadPreferences = useCallback(async () => {
    try {
      const result = await window.toolsAPI.getReferenceAssetPreferences();
      setPreferences(result ?? {});
    } catch (error) {
      console.error('Failed to load reference asset preferences:', error);
      setMessage({ type: 'error', text: 'Failed to load favorites/tags.' });
    }
  }, []);

  const updatePreference = useCallback(
    async (relativePath: string, next: ReferenceAssetPreference) => {
      await window.toolsAPI.setReferenceAssetPreference(relativePath, next);
      setPreferences((prev) => {
        const updated = { ...prev };
        if (!next.favorite && next.tags.length === 0) {
          delete updated[relativePath];
        } else {
          updated[relativePath] = next;
        }
        return updated;
      });
    },
    [],
  );

  const applyPreferenceUpdates = useCallback(async (updates: ReferenceAssetPreferenceUpdate[]) => {
    if (updates.length === 0) {
      return 0;
    }

    const result = await window.toolsAPI.setReferenceAssetPreferencesBatch(updates);
    if (!result.success) {
      throw new Error('Failed to save preference batch');
    }

    setPreferences((prev) => {
      const next = { ...prev };
      for (const update of updates) {
        if (!update.preference.favorite && update.preference.tags.length === 0) {
          delete next[update.relativePath];
        } else {
          next[update.relativePath] = update.preference;
        }
      }
      return next;
    });

    return result.updated;
  }, []);

  const loadAssetContent = useCallback(async (item: ReferenceAssetItem) => {
    setIsReadingAsset(true);
    setReadResult(null);
    try {
      const result = await window.toolsAPI.readReferenceAsset(item.relativePath);
      setReadResult(result);
    } catch (error) {
      console.error('Failed to read reference asset:', error);
      setReadResult({ success: false, error: 'Failed to read asset content.' });
    } finally {
      setIsReadingAsset(false);
    }
  }, []);

  const copyToClipboard = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage({ type: 'success', text: `${label} copied.` });
    } catch {
      setMessage({ type: 'error', text: `Failed to copy ${label.toLowerCase()}.` });
    }
  }, []);

  const openSelectedAsset = useCallback(
    async (mode: 'open' | 'reveal') => {
      if (!selectedAsset) {
        return;
      }

      try {
        const result =
          mode === 'open'
            ? await window.toolsAPI.openReferenceAsset(selectedAsset.relativePath)
            : await window.toolsAPI.revealReferenceAsset(selectedAsset.relativePath);
        if (result.success) {
          setMessage({
            type: 'success',
            text: mode === 'open' ? 'Opened in system app.' : 'Opened containing folder.',
          });
        } else {
          setMessage({ type: 'error', text: result.error ?? 'Operation failed.' });
        }
      } catch (error) {
        console.error('Failed to open/reveal asset:', error);
        setMessage({ type: 'error', text: 'Failed to open asset.' });
      }
    },
    [selectedAsset],
  );

  const toggleSelectedFavorite = useCallback(async () => {
    if (!selectedAsset) {
      return;
    }
    const current = getPreference(preferences, selectedAsset.relativePath);
    try {
      await updatePreference(selectedAsset.relativePath, {
        favorite: !current.favorite,
        tags: current.tags,
      });
      setMessage({
        type: 'success',
        text: !current.favorite ? 'Added to favorites.' : 'Removed from favorites.',
      });
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      setMessage({ type: 'error', text: 'Failed to update favorite.' });
    }
  }, [preferences, selectedAsset, updatePreference]);

  const addTagToSelectedAsset = useCallback(async () => {
    if (!selectedAsset) {
      return;
    }
    const normalizedTag = normalizeTag(tagInput);
    if (!normalizedTag) {
      return;
    }

    const current = getPreference(preferences, selectedAsset.relativePath);
    if (current.tags.includes(normalizedTag)) {
      setMessage({ type: 'error', text: 'Tag already exists.' });
      return;
    }

    try {
      await updatePreference(selectedAsset.relativePath, {
        favorite: current.favorite,
        tags: [...current.tags, normalizedTag],
      });
      setTagInput('');
      setMessage({ type: 'success', text: 'Tag added.' });
    } catch (error) {
      console.error('Failed to add tag:', error);
      setMessage({ type: 'error', text: 'Failed to add tag.' });
    }
  }, [preferences, selectedAsset, tagInput, updatePreference]);

  const removeTagFromSelectedAsset = useCallback(
    async (tagToRemove: string) => {
      if (!selectedAsset) {
        return;
      }
      const current = getPreference(preferences, selectedAsset.relativePath);
      try {
        await updatePreference(selectedAsset.relativePath, {
          favorite: current.favorite,
          tags: current.tags.filter((tag) => tag !== tagToRemove),
        });
        setMessage({ type: 'success', text: 'Tag removed.' });
      } catch (error) {
        console.error('Failed to remove tag:', error);
        setMessage({ type: 'error', text: 'Failed to remove tag.' });
      }
    },
    [preferences, selectedAsset, updatePreference],
  );

  const selectManagerTag = useCallback((tag: string) => {
    setSelectedManagerTag(tag);
    setRenameTagInput(tag);
    setSearchQuery(tag);
  }, []);

  const removeManagerTagGlobally = useCallback(async () => {
    if (!selectedManagerTag) {
      return;
    }
    const updates = buildScopedPreferenceUpdates(preferences, loadedAssetPathSet, (preference) => {
      if (!preference.tags.includes(selectedManagerTag)) {
        return null;
      }
      return {
        favorite: preference.favorite,
        tags: preference.tags.filter((tag) => tag !== selectedManagerTag),
      };
    });

    if (updates.length === 0) {
      setMessage({ type: 'error', text: 'No assets found for selected tag.' });
      return;
    }

    setIsTagManagerPending(true);
    try {
      const count = await applyPreferenceUpdates(updates);
      setSelectedManagerTag(null);
      setRenameTagInput('');
      setMessage({
        type: 'success',
        text: `Removed "${selectedManagerTag}" from ${count} assets.`,
      });
    } catch (error) {
      console.error('Failed to remove manager tag globally:', error);
      setMessage({ type: 'error', text: 'Failed to remove tag globally.' });
    } finally {
      setIsTagManagerPending(false);
    }
  }, [applyPreferenceUpdates, loadedAssetPathSet, preferences, selectedManagerTag]);

  const renameManagerTagGlobally = useCallback(async () => {
    if (!selectedManagerTag) {
      return;
    }
    const renamedTag = normalizeTag(renameTagInput);
    if (!renamedTag) {
      setMessage({ type: 'error', text: 'Enter a new tag name.' });
      return;
    }
    if (renamedTag === selectedManagerTag) {
      setMessage({ type: 'error', text: 'New tag must be different from current tag.' });
      return;
    }

    const updates = buildScopedPreferenceUpdates(preferences, loadedAssetPathSet, (preference) => {
      if (!preference.tags.includes(selectedManagerTag)) {
        return null;
      }
      const nextTags = preference.tags.map((tag) =>
        tag === selectedManagerTag ? renamedTag : tag,
      );
      return {
        favorite: preference.favorite,
        tags: Array.from(new Set(nextTags)),
      };
    });

    if (updates.length === 0) {
      setMessage({ type: 'error', text: 'No assets found for selected tag.' });
      return;
    }

    setIsTagManagerPending(true);
    try {
      const count = await applyPreferenceUpdates(updates);
      setSelectedManagerTag(renamedTag);
      setRenameTagInput(renamedTag);
      setSearchQuery(renamedTag);
      setMessage({
        type: 'success',
        text: `Renamed "${selectedManagerTag}" to "${renamedTag}" on ${count} assets.`,
      });
    } catch (error) {
      console.error('Failed to rename manager tag globally:', error);
      setMessage({ type: 'error', text: 'Failed to rename tag globally.' });
    } finally {
      setIsTagManagerPending(false);
    }
  }, [applyPreferenceUpdates, loadedAssetPathSet, preferences, renameTagInput, selectedManagerTag]);

  const clearAllTagsInScope = useCallback(async () => {
    const updates = buildScopedPreferenceUpdates(preferences, loadedAssetPathSet, (preference) => {
      if (preference.tags.length === 0) {
        return null;
      }
      return {
        favorite: preference.favorite,
        tags: [],
      };
    });

    if (updates.length === 0) {
      setMessage({ type: 'error', text: 'No tags available to clear.' });
      return;
    }

    if (!window.confirm(`Clear all tags for ${updates.length} assets in current scope?`)) {
      return;
    }

    setIsTagManagerPending(true);
    try {
      const count = await applyPreferenceUpdates(updates);
      setSelectedManagerTag(null);
      setRenameTagInput('');
      setMessage({ type: 'success', text: `Cleared tags from ${count} assets.` });
    } catch (error) {
      console.error('Failed to clear tags in scope:', error);
      setMessage({ type: 'error', text: 'Failed to clear tags.' });
    } finally {
      setIsTagManagerPending(false);
    }
  }, [applyPreferenceUpdates, loadedAssetPathSet, preferences]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    if (filteredAssets.length === 0) {
      setSelectedAssetId(null);
      setReadResult(null);
      return;
    }
    if (!selectedAssetId || !filteredAssets.some((item) => item.id === selectedAssetId)) {
      setSelectedAssetId(filteredAssets[0].id);
    }
  }, [filteredAssets, selectedAssetId]);

  useEffect(() => {
    if (!selectedAsset) {
      setReadResult(null);
      return;
    }
    loadAssetContent(selectedAsset);
  }, [selectedAsset, loadAssetContent]);

  useEffect(() => {
    if (selectedAsset) {
      setTagInput('');
    }
  }, [selectedAsset]);

  useEffect(() => {
    if (!selectedManagerTag) {
      return;
    }
    const stillExists = tagInventory.some((item) => item.tag === selectedManagerTag);
    if (!stillExists) {
      setSelectedManagerTag(null);
      setRenameTagInput('');
    }
  }, [selectedManagerTag, tagInventory]);

  return {
    provider,
    setProvider,
    searchQuery,
    setSearchQuery,
    favoritesOnly,
    setFavoritesOnly,
    sortMode,
    setSortMode,
    favoriteSortMode,
    setFavoriteSortMode,
    assets,
    filteredAssets,
    isLoadingAssets,
    assetsError,
    selectedAssetId,
    setSelectedAssetId,
    selectedAsset,
    selectedPreference,
    preferences,
    getPreferenceForPath,
    readResult,
    isReadingAsset,
    message,
    setMessage,
    tagInput,
    setTagInput,
    selectedManagerTag,
    renameTagInput,
    setRenameTagInput,
    isTagManagerPending,
    tagInventory,
    loadAssets,
    copyToClipboard,
    openSelectedAsset,
    toggleSelectedFavorite,
    addTagToSelectedAsset,
    removeTagFromSelectedAsset,
    selectManagerTag,
    renameManagerTagGlobally,
    removeManagerTagGlobally,
    clearAllTagsInScope,
  };
}
