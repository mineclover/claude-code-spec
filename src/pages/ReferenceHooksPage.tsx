import { useSearchParams } from 'react-router-dom';
import { REFERENCE_PROVIDERS } from '../types/reference-assets';
import { ReferenceAssetsPage } from './ReferenceAssetsPage';

type ProviderParam = (typeof REFERENCE_PROVIDERS)[number];

function resolveProvider(value: string | null): 'all' | ProviderParam {
  return REFERENCE_PROVIDERS.includes(value as ProviderParam)
    ? (value as ProviderParam)
    : 'all';
}

export function ReferenceHooksPage() {
  const [searchParams] = useSearchParams();

  return (
    <ReferenceAssetsPage
      assetType="hooks"
      title="Reference Hooks"
      description="Inspect and compare hook assets from Claude Code references."
      initialProvider={resolveProvider(searchParams.get('provider'))}
    />
  );
}
