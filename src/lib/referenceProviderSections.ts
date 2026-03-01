import type { ReferenceAssetType, ReferenceProvider } from '../types/reference-assets';

export interface ReferenceSectionSwitch {
  enabled: boolean;
  supported: boolean;
}

export interface ReferenceSectionMatrix {
  hooks: ReferenceSectionSwitch;
  outputStyles: ReferenceSectionSwitch;
  skills: ReferenceSectionSwitch;
}

export interface ReferenceSectionMatrixDeclaration {
  hooks?: Partial<ReferenceSectionSwitch>;
  outputStyles?: Partial<ReferenceSectionSwitch>;
  skills?: Partial<ReferenceSectionSwitch>;
}

export const SAFE_REFERENCE_SECTION_MATRIX: ReferenceSectionMatrix = {
  hooks: { enabled: false, supported: true },
  outputStyles: { enabled: false, supported: true },
  skills: { enabled: false, supported: true },
};

interface ReferenceSectionFallbacks {
  hooks?: boolean;
  outputStyles?: boolean;
  skills?: boolean;
}

function toSectionSwitch(
  declared: Partial<ReferenceSectionSwitch> | undefined,
  fallbackEnabled: boolean,
): ReferenceSectionSwitch {
  return {
    supported: typeof declared?.supported === 'boolean' ? declared.supported : true,
    enabled: typeof declared?.enabled === 'boolean' ? declared.enabled : fallbackEnabled,
  };
}

export function resolveReferenceSectionMatrix(
  declared: ReferenceSectionMatrixDeclaration | undefined,
  fallbacks: ReferenceSectionFallbacks = {},
): ReferenceSectionMatrix {
  return {
    hooks: toSectionSwitch(
      declared?.hooks,
      fallbacks.hooks ?? SAFE_REFERENCE_SECTION_MATRIX.hooks.enabled,
    ),
    outputStyles: toSectionSwitch(
      declared?.outputStyles,
      fallbacks.outputStyles ?? SAFE_REFERENCE_SECTION_MATRIX.outputStyles.enabled,
    ),
    skills: toSectionSwitch(
      declared?.skills,
      fallbacks.skills ?? SAFE_REFERENCE_SECTION_MATRIX.skills.enabled,
    ),
  };
}

export interface ReferenceProviderSectionRegistration {
  provider: ReferenceProvider;
  displayName: string;
  description: string;
  capability?: ReferenceSectionMatrixDeclaration;
}

export interface ReferenceProviderSectionCounts {
  hooks: number;
  outputStyles: number;
  skills: number;
}

export type ReferenceProviderSectionCountMap = Partial<
  Record<ReferenceProvider, Partial<Record<ReferenceAssetType, number>>>
>;

export interface ResolvedReferenceProviderSection {
  provider: ReferenceProvider;
  displayName: string;
  description: string;
  capability: ReferenceSectionMatrix;
  counts: ReferenceProviderSectionCounts;
}

export const DEFAULT_REFERENCE_PROVIDER_SECTION_REGISTRATIONS: ReferenceProviderSectionRegistration[] =
  [
    {
      provider: 'claude',
      displayName: 'Claude Code',
      description: 'Hooks, output styles, and skills for Claude Code.',
    },
    {
      provider: 'gemini',
      displayName: 'Gemini CLI',
      description: 'Google Gemini CLI — hooks, output styles, and skills are not supported.',
      capability: {
        hooks: { supported: false, enabled: false },
        outputStyles: { supported: false, enabled: false },
        skills: { supported: false, enabled: false },
      },
    },
    {
      provider: 'codex',
      displayName: 'Codex',
      description: 'OpenAI Codex — hooks, output styles, and skills are not supported.',
      capability: {
        hooks: { supported: false, enabled: false },
        outputStyles: { supported: false, enabled: false },
        skills: { supported: false, enabled: false },
      },
    },
  ];

function readCount(
  countsByProvider: ReferenceProviderSectionCountMap,
  provider: ReferenceProvider,
  section: ReferenceAssetType,
): number {
  const raw = countsByProvider[provider]?.[section];
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function resolveSectionCounts(
  countsByProvider: ReferenceProviderSectionCountMap,
  provider: ReferenceProvider,
): ReferenceProviderSectionCounts {
  return {
    hooks: readCount(countsByProvider, provider, 'hooks'),
    outputStyles: readCount(countsByProvider, provider, 'outputStyles'),
    skills: readCount(countsByProvider, provider, 'skills'),
  };
}

export function resolveReferenceProviderSections({
  registrations = DEFAULT_REFERENCE_PROVIDER_SECTION_REGISTRATIONS,
  countsByProvider = {},
}: {
  registrations?: ReferenceProviderSectionRegistration[];
  countsByProvider?: ReferenceProviderSectionCountMap;
} = {}): ResolvedReferenceProviderSection[] {
  return registrations.map((registration) => {
    const counts = resolveSectionCounts(countsByProvider, registration.provider);
    const capability = resolveReferenceSectionMatrix(registration.capability, {
      hooks: counts.hooks > 0,
      outputStyles: counts.outputStyles > 0,
      skills: counts.skills > 0,
    });

    return {
      provider: registration.provider,
      displayName: registration.displayName,
      description: registration.description,
      capability,
      counts,
    };
  });
}
