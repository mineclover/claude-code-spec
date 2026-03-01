export const REFERENCE_PROVIDERS = ['claude', 'gemini', 'codex'] as const;
export type ReferenceProvider = (typeof REFERENCE_PROVIDERS)[number];

export const REFERENCE_ASSET_TYPES = ['hooks', 'outputStyles', 'skills'] as const;
export type ReferenceAssetType = (typeof REFERENCE_ASSET_TYPES)[number];

export interface ReferenceAssetItem {
  id: string;
  provider: ReferenceProvider;
  type: ReferenceAssetType;
  name: string;
  description?: string;
  relativePath: string;
  sourceRoot: string;
  updatedAt: number;
}

export interface ReferenceAssetReadResult {
  success: boolean;
  content?: string;
  error?: string;
}

export interface ReferenceAssetActionResult {
  success: boolean;
  error?: string;
}

export interface ReferenceAssetPreference {
  favorite: boolean;
  tags: string[];
}

export type ReferenceAssetPreferenceMap = Record<string, ReferenceAssetPreference>;

export interface ReferenceAssetPreferenceUpdate {
  relativePath: string;
  preference: ReferenceAssetPreference;
}
