import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReferenceProviderSectionFramework,
  type ReferenceProviderSectionGroup,
} from '../components/reference/ReferenceProviderSectionFramework';
import { useReferenceProviderSections } from '../hooks/useReferenceProviderSections';
import type { ReferenceAssetType } from '../types/reference-assets';
import styles from './ReferenceProvidersPage.module.css';

const SECTION_META: Record<
  ReferenceAssetType,
  {
    title: string;
    description: string;
    route: string;
  }
> = {
  hooks: {
    title: 'Hooks',
    description: 'Hook templates and trigger flows',
    route: '/references/hooks',
  },
  outputStyles: {
    title: 'Output Styles',
    description: 'Theme/style assets and formatting profiles',
    route: '/references/output-styles',
  },
  skills: {
    title: 'Skills',
    description: 'SKILL.md inventories and skill packages',
    route: '/references/skills',
  },
};

const SECTION_ORDER: ReferenceAssetType[] = ['hooks', 'outputStyles', 'skills'];

export function ReferenceProvidersPage() {
  const navigate = useNavigate();
  const { providers, isLoading, message, load } = useReferenceProviderSections();

  const groups = useMemo<ReferenceProviderSectionGroup[]>(() => {
    return providers.map((provider) => {
      const sections = SECTION_ORDER.map((sectionType) => {
        const cap = provider.capability[sectionType];
        const meta = SECTION_META[sectionType];
        return {
          id: sectionType,
          title: meta.title,
          description: meta.description,
          count: provider.counts[sectionType],
          supported: cap.supported,
          actionLabel: `Open ${meta.title}`,
          onOpen: () => navigate(`${meta.route}?provider=${provider.provider}`),
        };
      });

      return {
        provider: provider.provider,
        displayName: provider.displayName,
        description: provider.description,
        sections,
      };
    });
  }, [navigate, providers]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Reference Providers</h2>
        <div className={styles.description}>
          Compatibility matrix for hooks, output styles, and skills across CLI tools.
        </div>
      </div>

      <ReferenceProviderSectionFramework
        groups={groups}
        isLoading={isLoading}
        message={message}
        onRefresh={load}
        emptyText="No providers registered."
      />
    </div>
  );
}
