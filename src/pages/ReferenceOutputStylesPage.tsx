import { useSearchParams } from 'react-router-dom';
import { ReferenceAssetsPage } from './ReferenceAssetsPage';

function resolveProvider(value: string | null): 'all' | 'moai' | 'ralph' {
  return value === 'moai' || value === 'ralph' ? value : 'all';
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
