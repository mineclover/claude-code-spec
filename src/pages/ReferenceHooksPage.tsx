import { useSearchParams } from 'react-router-dom';
import { ReferenceAssetsPage } from './ReferenceAssetsPage';

function resolveProvider(value: string | null): 'all' | 'moai' | 'ralph' {
  return value === 'moai' || value === 'ralph' ? value : 'all';
}

export function ReferenceHooksPage() {
  const [searchParams] = useSearchParams();

  return (
    <ReferenceAssetsPage
      assetType="hooks"
      title="Reference Hooks"
      description="Inspect and compare hook assets from MoAI and Ralph references."
      initialProvider={resolveProvider(searchParams.get('provider'))}
    />
  );
}
