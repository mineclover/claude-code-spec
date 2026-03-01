import { useSearchParams } from 'react-router-dom';
import { ReferenceAssetsPage } from './ReferenceAssetsPage';

function resolveProvider(value: string | null): 'all' | 'moai' | 'ralph' {
  return value === 'moai' || value === 'ralph' ? value : 'all';
}

export function ReferenceSkillsPage() {
  const [searchParams] = useSearchParams();

  return (
    <ReferenceAssetsPage
      assetType="skills"
      title="Reference Skills"
      description="Review upstream skill inventories and SKILL.md contents from MoAI and Ralph."
      initialProvider={resolveProvider(searchParams.get('provider'))}
    />
  );
}
