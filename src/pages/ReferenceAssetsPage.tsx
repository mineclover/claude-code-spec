import {
  type FavoriteSortMode,
  type ProviderFilter,
  type SortMode,
  useReferenceAssets,
} from '../hooks/useReferenceAssets';
import type { ReferenceAssetType } from '../types/reference-assets';
import styles from './ReferenceAssetsPage.module.css';

interface ReferenceAssetsPageProps {
  assetType: ReferenceAssetType;
  title: string;
  description: string;
}

const providerFilterOptions: Array<{ value: ProviderFilter; label: string }> = [
  { value: 'all', label: 'All providers' },
  { value: 'moai', label: 'MoAI' },
  { value: 'ralph', label: 'Ralph' },
];

const sortModeOptions: Array<{ value: SortMode; label: string }> = [
  { value: 'favoritesFirst', label: 'Sort: Favorites First' },
  { value: 'nameAsc', label: 'Sort: Name A-Z' },
  { value: 'pathAsc', label: 'Sort: Path A-Z' },
  { value: 'updatedDesc', label: 'Sort: Updated (Newest)' },
];

const favoriteSortModeOptions: Array<{ value: FavoriteSortMode; label: string }> = [
  { value: 'nameAsc', label: 'Favorites Sort: Name A-Z' },
  { value: 'pathAsc', label: 'Favorites Sort: Path A-Z' },
  { value: 'updatedDesc', label: 'Favorites Sort: Updated (Newest)' },
];

function formatUpdatedAt(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return '-';
  }
}

export function ReferenceAssetsPage({ assetType, title, description }: ReferenceAssetsPageProps) {
  const {
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
    filteredAssets,
    isLoadingAssets,
    assetsError,
    selectedAssetId,
    setSelectedAssetId,
    selectedAsset,
    selectedPreference,
    getPreferenceForPath,
    readResult,
    isReadingAsset,
    message,
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
  } = useReferenceAssets({ assetType });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{title}</h2>
        <div className={styles.description}>{description}</div>
      </div>

      <div className={styles.controls}>
        <select
          className={styles.select}
          value={provider}
          onChange={(event) => setProvider(event.target.value as ProviderFilter)}
        >
          {providerFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          className={styles.input}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={`Search ${assetType} / tags...`}
        />
        <button
          type="button"
          className={`${styles.button} ${favoritesOnly ? styles.buttonPrimary : ''}`}
          onClick={() => setFavoritesOnly((prev) => !prev)}
        >
          {favoritesOnly ? 'Favorites: On' : 'Favorites: Off'}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={loadAssets}
          disabled={isLoadingAssets}
        >
          {isLoadingAssets ? 'Refreshing...' : 'Refresh'}
        </button>
        <select
          className={styles.select}
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as SortMode)}
          disabled={favoritesOnly}
        >
          {sortModeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {favoritesOnly && (
          <select
            className={styles.select}
            value={favoriteSortMode}
            onChange={(event) => setFavoriteSortMode(event.target.value as FavoriteSortMode)}
          >
            {favoriteSortModeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {assetsError && <div className={styles.error}>{assetsError}</div>}
      {message && (
        <div className={message.type === 'error' ? styles.error : styles.success}>
          {message.text}
        </div>
      )}

      <div className={styles.tagManager}>
        <div className={styles.tagManagerHeader}>
          <div>Tag Manager ({tagInventory.length})</div>
          <div className={styles.tagManagerHint}>Scope: current provider/page assets</div>
        </div>
        {tagInventory.length === 0 ? (
          <div className={styles.emptyState}>No tags in current scope.</div>
        ) : (
          <>
            <div className={styles.tagInventory}>
              {tagInventory.map((item) => (
                <button
                  key={`tag-inventory-${item.tag}`}
                  type="button"
                  aria-label={`tag:${item.tag}`}
                  className={`${styles.tagInventoryItem} ${selectedManagerTag === item.tag ? styles.tagInventoryItemActive : ''}`}
                  onClick={() => selectManagerTag(item.tag)}
                  title="Select and filter by this tag"
                >
                  <span>{item.tag}</span>
                  <span className={styles.tagCountBadge}>{item.count}</span>
                </button>
              ))}
            </div>

            <div className={styles.tagManagerActions}>
              <input
                className={styles.input}
                value={renameTagInput}
                onChange={(event) => setRenameTagInput(event.target.value)}
                placeholder={
                  selectedManagerTag
                    ? `Rename "${selectedManagerTag}" to...`
                    : 'Select a tag to rename'
                }
                disabled={!selectedManagerTag || isTagManagerPending}
              />
              <button
                type="button"
                className={styles.button}
                disabled={!selectedManagerTag || isTagManagerPending}
                onClick={renameManagerTagGlobally}
              >
                {isTagManagerPending ? 'Applying...' : 'Rename Tag'}
              </button>
              <button
                type="button"
                className={styles.button}
                disabled={!selectedManagerTag || isTagManagerPending}
                onClick={removeManagerTagGlobally}
              >
                {isTagManagerPending ? 'Applying...' : 'Remove Tag'}
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.dangerButton}`}
                disabled={isTagManagerPending || tagInventory.length === 0}
                onClick={clearAllTagsInScope}
              >
                {isTagManagerPending ? 'Applying...' : 'Clear All Tags'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className={styles.split}>
        <div className={styles.listPanel}>
          <div className={styles.panelHeader}>
            {assetType} ({filteredAssets.length})
          </div>
          <div className={styles.listBody}>
            {filteredAssets.length === 0 ? (
              <div className={styles.emptyState}>No assets found.</div>
            ) : (
              filteredAssets.map((item) => {
                const preference = getPreferenceForPath(item.relativePath);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.assetItem} ${selectedAssetId === item.id ? styles.assetItemActive : ''}`}
                    onClick={() => setSelectedAssetId(item.id)}
                  >
                    <div className={styles.assetTitleRow}>
                      <div className={styles.assetName}>{item.name}</div>
                      <div className={styles.favoriteIcon}>{preference.favorite ? '★' : '☆'}</div>
                    </div>
                    {item.description && (
                      <div className={styles.previewMeta}>{item.description}</div>
                    )}
                    {preference.tags.length > 0 && (
                      <div className={styles.tagList}>
                        {preference.tags.slice(0, 3).map((tag) => (
                          <span key={`${item.id}-${tag}`} className={styles.tagChip}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className={styles.assetMeta}>
                      <span className={styles.providerTag}>{item.provider}</span>
                      <span>{item.sourceRoot}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className={styles.previewPanel}>
          <div className={styles.panelHeader}>Preview</div>
          <div className={styles.previewBody}>
            {!selectedAsset ? (
              <div className={styles.emptyState}>Select an asset to preview.</div>
            ) : isReadingAsset ? (
              <div className={styles.emptyState}>Loading preview...</div>
            ) : (
              <>
                <div className={styles.previewTitle}>{selectedAsset.name}</div>
                {selectedAsset.description && (
                  <div className={styles.previewMeta}>{selectedAsset.description}</div>
                )}
                <div className={styles.previewMeta}>
                  <span className={styles.providerTag}>{selectedAsset.provider}</span>
                  <span>Updated: {formatUpdatedAt(selectedAsset.updatedAt)}</span>
                </div>
                <div className={styles.previewPath}>{selectedAsset.relativePath}</div>

                <div className={styles.controls}>
                  <button
                    type="button"
                    className={styles.button}
                    onClick={() => openSelectedAsset('open')}
                  >
                    Open File
                  </button>
                  <button
                    type="button"
                    className={styles.button}
                    onClick={() => openSelectedAsset('reveal')}
                  >
                    Reveal Folder
                  </button>
                  <button type="button" className={styles.button} onClick={toggleSelectedFavorite}>
                    {selectedPreference.favorite ? 'Unfavorite' : 'Favorite'}
                  </button>
                  <button
                    type="button"
                    className={styles.button}
                    onClick={() => copyToClipboard(selectedAsset.relativePath, 'Path')}
                  >
                    Copy Path
                  </button>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={!readResult?.success || !readResult.content}
                    onClick={() => copyToClipboard(readResult?.content ?? '', 'Content')}
                  >
                    Copy Content
                  </button>
                </div>

                <div className={styles.tagEditor}>
                  <input
                    className={styles.input}
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    placeholder="Add tag (e.g. pre-commit)"
                  />
                  <button type="button" className={styles.button} onClick={addTagToSelectedAsset}>
                    Add Tag
                  </button>
                </div>
                <div className={styles.tagList}>
                  {selectedPreference.tags.map((tag) => (
                    <button
                      key={`selected-tag-${tag}`}
                      type="button"
                      className={styles.tagChipButton}
                      onClick={() => removeTagFromSelectedAsset(tag)}
                      title="Remove tag"
                    >
                      {tag} ×
                    </button>
                  ))}
                </div>

                {readResult?.success ? (
                  <pre className={styles.pre}>{readResult.content}</pre>
                ) : (
                  <div className={styles.error}>
                    {readResult?.error || 'Failed to load content.'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
