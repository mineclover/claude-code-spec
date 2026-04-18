// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedRegistry } from '../types/mcp-policy';
import { McpRegistryPage } from './McpRegistryPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <McpRegistryPage />
    </MemoryRouter>,
  );
}

vi.mock('../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectPath: '/proj/sample',
    projectDirName: 'sample',
    setProjectPath: vi.fn(),
    setProjectDirName: vi.fn(),
    updateProject: vi.fn(),
    clearProject: vi.fn(),
    projectFolders: [],
    isLoadingFolders: false,
    refreshProjectFolders: vi.fn(),
  }),
}));

vi.mock('react-hot-toast', () => {
  const fn = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  });
  return { default: fn, __esModule: true };
});

interface MockMcpApi {
  getRegistry: ReturnType<typeof vi.fn>;
  saveRegistryEntry: ReturnType<typeof vi.fn>;
  deleteRegistryEntry: ReturnType<typeof vi.fn>;
  getPolicy: ReturnType<typeof vi.fn>;
  savePolicy: ReturnType<typeof vi.fn>;
  resolve: ReturnType<typeof vi.fn>;
  listPresets: ReturnType<typeof vi.fn>;
  savePreset: ReturnType<typeof vi.fn>;
  deletePreset: ReturnType<typeof vi.fn>;
}

function makeRegistry(): ResolvedRegistry {
  return {
    entries: [
      {
        id: 'serena',
        name: 'Serena',
        command: 'serena',
        args: [],
        category: 'analysis',
        scope: 'user',
      },
      {
        id: 'context7',
        name: 'Context7',
        command: 'npx',
        args: ['-y', '@context7/mcp'],
        category: 'docs',
        scope: 'user',
      },
    ],
    sources: { userPath: '/home/.claude/mcp-registry.json', projectPath: null },
  };
}

function setupMcpApi(initial?: ResolvedRegistry): MockMcpApi {
  const reg = initial ?? makeRegistry();
  const api: MockMcpApi = {
    getRegistry: vi.fn().mockResolvedValue(reg),
    saveRegistryEntry: vi.fn().mockResolvedValue({ success: true }),
    deleteRegistryEntry: vi.fn().mockResolvedValue({ success: true }),
    getPolicy: vi.fn().mockResolvedValue({
      schemaVersion: 1,
      defaultEnabled: [],
      allowed: [],
      forbidden: [],
    }),
    savePolicy: vi.fn().mockResolvedValue({ success: true }),
    resolve: vi.fn().mockResolvedValue({
      resolved: {
        enabledServerIds: [],
        hash: 'h',
        baselineServerIds: [],
        overrideAdd: [],
        overrideRemove: [],
        canonicalJson: '{}',
        disallowed: [],
      },
      registry: reg,
      policy: { schemaVersion: 1, defaultEnabled: [], allowed: [], forbidden: [] },
    }),
    listPresets: vi.fn().mockResolvedValue({ presets: [] }),
    savePreset: vi.fn().mockResolvedValue({ success: true }),
    deletePreset: vi.fn().mockResolvedValue({ success: true }),
  };
  Object.assign(window, { mcpAPI: api as unknown });
  return api;
}

describe('McpRegistryPage', () => {
  let api: MockMcpApi;

  beforeEach(() => {
    vi.clearAllMocks();
    api = setupMcpApi();
  });

  it('loads and renders registry entries on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(api.getRegistry).toHaveBeenCalledWith('/proj/sample');
    });
    expect(await screen.findByText('serena')).toBeTruthy();
    expect(screen.getByText('context7')).toBeTruthy();
  });

  it('filters entries by substring (id, name, category, description)', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('serena');

    const filterInput = screen.getByLabelText(/Filter MCP entries/i);
    await user.type(filterInput, 'docs');

    await waitFor(() => {
      expect(screen.queryByText('serena')).toBeNull();
    });
    expect(screen.getByText('context7')).toBeTruthy();
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  it('rejects invalid id and surfaces a toast', async () => {
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('serena');

    await user.click(screen.getByRole('button', { name: '+ User' }));
    const idInput = await screen.findByLabelText('id');
    fireEvent.change(idInput, { target: { value: 'has spaces!' } });
    fireEvent.change(screen.getByLabelText('command'), { target: { value: 'mybin' } });

    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(api.saveRegistryEntry).not.toHaveBeenCalled();
  });

  it('saves a valid new user-scope entry', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('serena');

    await user.click(screen.getByRole('button', { name: '+ User' }));
    await screen.findByText(/New user entry/i);

    fireEvent.change(screen.getByLabelText('id'), { target: { value: 'newsrv' } });
    fireEvent.change(screen.getByLabelText(/^name/), { target: { value: 'New Server' } });
    fireEvent.change(screen.getByLabelText('command'), { target: { value: 'mybin' } });

    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(api.saveRegistryEntry).toHaveBeenCalledTimes(1);
    });
    const [scope, entry] = api.saveRegistryEntry.mock.calls[0];
    expect(scope).toBe('user');
    expect(entry.id).toBe('newsrv');
    expect(entry.command).toBe('mybin');
    expect(entry.scope).toBe('user');
  });

  it('deletes the selected entry after confirmation', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    await user.click(await screen.findByText('serena'));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(api.deleteRegistryEntry).toHaveBeenCalledTimes(1);
    });
    const [scope, id] = api.deleteRegistryEntry.mock.calls[0];
    expect(scope).toBe('user');
    expect(id).toBe('serena');
    confirmSpy.mockRestore();
  });
});
