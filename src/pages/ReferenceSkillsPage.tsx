import { useSearchParams } from 'react-router-dom';
import { REFERENCE_PROVIDERS } from '../types/reference-assets';
import { ReferenceAssetsPage } from './ReferenceAssetsPage';

type ProviderParam = (typeof REFERENCE_PROVIDERS)[number];

function resolveProvider(value: string | null): 'all' | ProviderParam {
  return REFERENCE_PROVIDERS.includes(value as ProviderParam)
    ? (value as ProviderParam)
    : 'all';
}

export function ReferenceSkillsPage() {
  const [searchParams] = useSearchParams();

  return (
    <ReferenceAssetsPage
      assetType="skills"
      title="Reference Skills"
      description="Review upstream skill inventories and SKILL.md contents from Claude Code references."
      initialProvider={resolveProvider(searchParams.get('provider'))}
    />
  );
}
