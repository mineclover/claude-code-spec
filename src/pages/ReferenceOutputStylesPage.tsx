import { useSearchParams } from 'react-router-dom';
import { REFERENCE_PROVIDERS } from '../types/reference-assets';
import { ReferenceAssetsPage } from './ReferenceAssetsPage';

type ProviderParam = (typeof REFERENCE_PROVIDERS)[number];

function resolveProvider(value: string | null): 'all' | ProviderParam {
  return REFERENCE_PROVIDERS.includes(value as ProviderParam)
    ? (value as ProviderParam)
    : 'all';
}

export function ReferenceOutputStylesPage() {
  const [searchParams] = useSearchParams();

  return (
    <ReferenceAssetsPage
      assetType="outputStyles"
      title="Reference Output Styles"
      description="Browse output style definitions and theme assets in upstream references."
      initialProvider={resolveProvider(searchParams.get('provider'))}
    />
  );
}
