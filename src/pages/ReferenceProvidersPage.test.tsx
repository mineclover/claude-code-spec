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
            id: 'claude:hooks:moai-adk-upstream/.claude/hooks/a.md',
            provider: 'claude',
            type: 'hooks',
            name: 'a.md',
            relativePath: 'moai-adk-upstream/.claude/hooks/a.md',
            sourceRoot: 'moai-adk-upstream/.claude/hooks',
            updatedAt: Date.now(),
          },
          {
            id: 'claude:hooks:ralph-tui-upstream/.claude/hooks/b.md',
            provider: 'claude',
            type: 'hooks',
            name: 'b.md',
            relativePath: 'ralph-tui-upstream/.claude/hooks/b.md',
            sourceRoot: 'ralph-tui-upstream/.claude/hooks',
            updatedAt: Date.now(),
          },
        ]);
      }
      if (assetType === 'outputStyles') {
        return Promise.resolve([
          {
            id: 'claude:outputStyles:moai-adk-upstream/.claude/output-styles/theme.css',
            provider: 'claude',
            type: 'outputStyles',
            name: 'theme.css',
            relativePath: 'moai-adk-upstream/.claude/output-styles/theme.css',
            sourceRoot: 'moai-adk-upstream/.claude/output-styles',
            updatedAt: Date.now(),
          },
        ]);
      }
      return Promise.resolve([
        {
          id: 'claude:skills:moai-adk-upstream/.claude/skills/my-skill/SKILL.md',
          provider: 'claude',
          type: 'skills',
          name: 'my-skill',
          relativePath: 'moai-adk-upstream/.claude/skills/my-skill/SKILL.md',
          sourceRoot: 'moai-adk-upstream/.claude/skills',
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

  it('shows all three provider cards', async () => {
    const { toolsAPI } = setupWindowApis();

    render(
      <MemoryRouter>
        <ReferenceProvidersPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(toolsAPI.listReferenceAssets).toHaveBeenCalledTimes(3);
    });

    expect(screen.getByRole('heading', { name: 'Claude Code' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Gemini CLI' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Codex' })).toBeTruthy();
  });

  it('shows Claude Code sections with counts and action buttons', async () => {
    const { toolsAPI } = setupWindowApis();

    render(
      <MemoryRouter>
        <ReferenceProvidersPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(toolsAPI.listReferenceAssets).toHaveBeenCalledTimes(3);
    });

    const claudeCard = screen.getByRole('heading', { name: 'Claude Code' }).closest('section');
    expect(claudeCard).toBeTruthy();

    const claude = within(claudeCard as HTMLElement);
    expect(claude.getByText('Hooks')).toBeTruthy();
    expect(claude.getByText('Output Styles')).toBeTruthy();
    expect(claude.getByText('Skills')).toBeTruthy();
    // Should NOT show "Not supported" badge for claude
    expect(claude.queryByText('Not supported')).toBeNull();
  });

  it('shows Not supported badge for all gemini sections', async () => {
    const { toolsAPI } = setupWindowApis();

    render(
      <MemoryRouter>
        <ReferenceProvidersPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(toolsAPI.listReferenceAssets).toHaveBeenCalledTimes(3);
    });

    const geminiCard = screen.getByRole('heading', { name: 'Gemini CLI' }).closest('section');
    expect(geminiCard).toBeTruthy();

    const gemini = within(geminiCard as HTMLElement);
    const unsupportedBadges = gemini.getAllByText('Not supported');
    expect(unsupportedBadges).toHaveLength(3);
  });

  it('shows Not supported badge for all codex sections', async () => {
    const { toolsAPI } = setupWindowApis();

    render(
      <MemoryRouter>
        <ReferenceProvidersPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(toolsAPI.listReferenceAssets).toHaveBeenCalledTimes(3);
    });

    const codexCard = screen.getByRole('heading', { name: 'Codex' }).closest('section');
    expect(codexCard).toBeTruthy();

    const codex = within(codexCard as HTMLElement);
    const unsupportedBadges = codex.getAllByText('Not supported');
    expect(unsupportedBadges).toHaveLength(3);
  });
});
