// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReferenceAssetsPage } from './ReferenceAssetsPage';

function setupWindowApis() {
  const toolsAPI = {
    listReferenceAssets: vi.fn().mockResolvedValue([
      {
        id: 'claude:hooks:moai-adk-upstream/.claude/hooks/a.md',
        provider: 'claude',
        type: 'hooks',
        name: 'a.md',
        relativePath: 'moai-adk-upstream/.claude/hooks/a.md',
        sourceRoot: 'moai-adk-upstream/.claude/hooks',
        updatedAt: Date.now(),
      },
      {
        id: 'claude:hooks:moai-adk-upstream/.claude/hooks/b.md',
        provider: 'claude',
        type: 'hooks',
        name: 'b.md',
        relativePath: 'moai-adk-upstream/.claude/hooks/b.md',
        sourceRoot: 'moai-adk-upstream/.claude/hooks',
        updatedAt: Date.now() - 1000,
      },
      {
        id: 'claude:hooks:ralph-tui-upstream/.claude/hooks/c.md',
        provider: 'claude',
        type: 'hooks',
        name: 'c.md',
        relativePath: 'ralph-tui-upstream/.claude/hooks/c.md',
        sourceRoot: 'ralph-tui-upstream/.claude/hooks',
        updatedAt: Date.now() - 2000,
      },
    ]),
    readReferenceAsset: vi.fn().mockResolvedValue({ success: true, content: '# preview' }),
    openReferenceAsset: vi.fn().mockResolvedValue({ success: true }),
    revealReferenceAsset: vi.fn().mockResolvedValue({ success: true }),
    getReferenceAssetPreferences: vi.fn().mockResolvedValue({
      'moai-adk-upstream/.claude/hooks/a.md': {
        favorite: true,
        tags: ['alpha', 'common'],
      },
      'moai-adk-upstream/.claude/hooks/b.md': {
        favorite: false,
        tags: ['alpha'],
      },
      'ralph-tui-upstream/.claude/hooks/c.md': {
        favorite: false,
        tags: ['beta'],
      },
    }),
    setReferenceAssetPreference: vi.fn().mockResolvedValue({ success: true }),
    setReferenceAssetPreferencesBatch: vi
      .fn()
      .mockImplementation((updates: Array<unknown>) =>
        Promise.resolve({ success: true, updated: updates.length }),
      ),
  };

  Object.assign(window, { toolsAPI: toolsAPI as unknown });
  return { toolsAPI };
}

describe('ReferenceAssetsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows favorite-only sort selector when favorites filter is enabled', async () => {
    const user = userEvent.setup();
    setupWindowApis();

    render(<ReferenceAssetsPage assetType="hooks" title="Reference Hooks" description="desc" />);

    await screen.findByText('Tag Manager (3)');

    await user.click(screen.getByRole('button', { name: 'Favorites: Off' }));
    expect(screen.getByRole('button', { name: 'Favorites: On' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Favorites Sort: Name A-Z' })).toBeTruthy();
  });

  it('removes selected tag across all assets in current scope', async () => {
    const user = userEvent.setup();
    const { toolsAPI } = setupWindowApis();

    render(<ReferenceAssetsPage assetType="hooks" title="Reference Hooks" description="desc" />);

    await screen.findByText('Tag Manager (3)');

    await user.click(screen.getByRole('button', { name: 'tag:alpha' }));
    await user.click(screen.getByRole('button', { name: 'Remove Tag' }));

    await waitFor(() => {
      expect(toolsAPI.setReferenceAssetPreferencesBatch).toHaveBeenCalledTimes(1);
    });

    const updates = toolsAPI.setReferenceAssetPreferencesBatch.mock.calls[0]?.[0];
    expect(updates).toEqual([
      {
        relativePath: 'moai-adk-upstream/.claude/hooks/a.md',
        preference: { favorite: true, tags: ['common'] },
      },
      {
        relativePath: 'moai-adk-upstream/.claude/hooks/b.md',
        preference: { favorite: false, tags: [] },
      },
    ]);
  });
});
