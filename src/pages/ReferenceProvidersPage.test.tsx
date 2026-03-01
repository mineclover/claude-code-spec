// @vitest-environment jsdom

import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReferenceProvidersPage } from './ReferenceProvidersPage';

function setupWindowApis() {
  const toolsAPI = {
    listReferenceAssets: vi.fn().mockImplementation((assetType: string) => {
      if (assetType === 'hooks') {
        return Promise.resolve([
          {
            id: 'moai:hooks:1',
            provider: 'moai',
            type: 'hooks',
            name: 'a.md',
            relativePath: 'moai/hooks/a.md',
            sourceRoot: 'moai/hooks',
            updatedAt: Date.now(),
          },
          {
            id: 'ralph:hooks:1',
            provider: 'ralph',
            type: 'hooks',
            name: 'b.md',
            relativePath: 'ralph/hooks/b.md',
            sourceRoot: 'ralph/hooks',
            updatedAt: Date.now(),
          },
        ]);
      }
      if (assetType === 'outputStyles') {
        return Promise.resolve([
          {
            id: 'ralph:outputStyles:1',
            provider: 'ralph',
            type: 'outputStyles',
            name: 'theme.css',
            relativePath: 'ralph/styles/theme.css',
            sourceRoot: 'ralph/styles',
            updatedAt: Date.now(),
          },
        ]);
      }
      return Promise.resolve([
        {
          id: 'moai:skills:1',
          provider: 'moai',
          type: 'skills',
          name: 'my-skill',
          relativePath: 'moai/skills/my-skill/SKILL.md',
          sourceRoot: 'moai/skills',
          updatedAt: Date.now(),
        },
      ]);
    }),
  };

  Object.assign(window, { toolsAPI: toolsAPI as unknown });
  return { toolsAPI };
}

describe('ReferenceProvidersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows provider sections dynamically from inferred capability counts', async () => {
    const { toolsAPI } = setupWindowApis();

    render(
      <MemoryRouter>
        <ReferenceProvidersPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(toolsAPI.listReferenceAssets).toHaveBeenCalledTimes(3);
    });

    const moaiCard = screen.getByRole('heading', { name: 'MoAI' }).closest('section');
    const ralphCard = screen.getByRole('heading', { name: 'Ralph' }).closest('section');
    expect(moaiCard).toBeTruthy();
    expect(ralphCard).toBeTruthy();

    const moai = within(moaiCard as HTMLElement);
    expect(moai.getByText('Hooks')).toBeTruthy();
    expect(moai.getByText('Skills')).toBeTruthy();
    expect(moai.queryByText('Output Styles')).toBeNull();

    const ralph = within(ralphCard as HTMLElement);
    expect(ralph.getByText('Hooks')).toBeTruthy();
    expect(ralph.getByText('Output Styles')).toBeTruthy();
    expect(ralph.queryByText('Skills')).toBeNull();
  });
});
